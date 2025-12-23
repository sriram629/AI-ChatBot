from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, UploadFile, File
from typing import List
from .auth import get_ws_user, get_current_user
from .models import ChatMessage, ChatSession, User, Attachment
import os
import json
import asyncio
import google.generativeai as genai
from datetime import datetime
from beanie import PydanticObjectId
from .utils import handle_file_upload
from .tools import generate_image_tool, search_web_tool
from .rag import add_to_vector_db, search_vector_db
import httpx
from PIL import Image
import io
from beanie.operators import Exists

router = APIRouter()

if not os.getenv("GOOGLE_API_KEY"):
    print("CRITICAL WARNING: GOOGLE_API_KEY is missing from environment variables.")

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def get_error_message(e):
    err_str = str(e)
    if "429" in err_str:
        return "Server Busy: High traffic detected. I tried 3 times but couldn't get through. Please wait 1 minute."
    if "Connection refused" in err_str:
        return "System Error: Database connection unavailable. Chat may not save."
    return "I encountered a technical error processing your request."

async def retry_gemini_call(func, *args, retries=3, delay=2, **kwargs):
    last_exception = None
    for attempt in range(retries):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            if "429" in str(e):
                print(f"Rate Limit Hit (429). Retrying in {delay}s... (Attempt {attempt+1}/{retries})")
                await asyncio.sleep(delay)
                delay *= 2
            else:
                raise e
    
    print("Max retries reached.")
    raise last_exception

available_tools = {
    "search_web_tool": search_web_tool,
    "generate_image_tool": generate_image_tool
}

current_date = datetime.now().strftime("%A, %B %d, %Y")

SYSTEM_PROMPT = f"""
You are an intelligent and analytical AI assistant. Current Date: {current_date}.

### YOUR CORE INSTRUCTIONS:
1. **Analyze First:** Before responding, analyze the user's request to understand the intent.
   - If they ask for **real-time data** (e.g., "Bitcoin price", "Weather in NY"), you MUST use the `search_web_tool`.
   - If they ask for **concepts**, explain them in depth.

2. **Comprehensive Responses (No One-Liners):** - Never provide a single-line answer for data queries. 
   - **Example:** If asked for "Bitcoin Price", do not just say "It is $98,000."
   - **Instead:** Provide the current price, followed by a **summary** of recent market movements, 24h change, or relevant news context found via search.

3. **Formatting:**
   - Use **Bold** for key figures.
   - Use Bullet points for lists.
   - Use small headers to separate sections if the answer is long.

4. **Image Rule (CRITICAL):** - If you use `generate_image_tool`, it returns a Markdown link (e.g., `![Image](https://...)`).
   - You **MUST** include this exact Markdown link in your final response.
   - Do not describe the image; show it.
"""

model = genai.GenerativeModel(
    model_name='gemini-2.5-flash',
    tools=[search_web_tool, generate_image_tool], 
    system_instruction=SYSTEM_PROMPT
)

title_model = genai.GenerativeModel('gemini-2.5-flash')

@router.post("/upload", tags=["Chat"])
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    return await handle_file_upload(file)

@router.post("/sessions", response_model=ChatSession, tags=["Chat"])
async def create_session(user: User = Depends(get_current_user)):
    session = ChatSession(user_email=user.email, title="New Chat")
    try:
        await session.insert()
    except Exception as e:
        print(f"DB Error creating session: {e}")
    return session

@router.get("/sessions", response_model=List[ChatSession], tags=["Chat"])
async def get_sessions(user: User = Depends(get_current_user)):
    try:
        return await ChatSession.find(ChatSession.user_email == user.email).sort(-ChatSession.updated_at).to_list()
    except Exception:
        return []

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessage], tags=["Chat"])
async def get_session_messages(session_id: str, user: User = Depends(get_current_user)):
    try:
        return await ChatMessage.find(ChatMessage.session_id == session_id).sort(+ChatMessage.timestamp).to_list()
    except Exception:
        return []

async def get_formatted_history(session_id: str, limit: int = 15):
    try:
        recent_history = await ChatMessage.find(ChatMessage.session_id == session_id)\
            .sort(-ChatMessage.timestamp).limit(limit).to_list()
        recent_history.reverse()
        
        valid_history = []
        for m in recent_history:
            if m.content and m.content.strip():
                valid_history.append({"role": "user" if m.role == "user" else "model", "parts": [m.content]})
        return valid_history
    except Exception:
        return []

async def speculative_rag_search(session_id: str, query: str):
    try:
        if len(query) < 5: return None
        if not await ChatMessage.find_one(ChatMessage.session_id == session_id):
            return None
            
        has_files = await ChatMessage.find(
            ChatMessage.session_id == session_id,
            Exists(ChatMessage.attachments, True)
        ).count() > 0
        if not has_files: return None
        return await asyncio.to_thread(search_vector_db, query)
    except Exception:
        return None

async def generate_smart_title(session_id: str, user_email: str, user_message: str, websocket: WebSocket):
    await asyncio.sleep(2)
    try:
        prompt = f"Summarize this into a 3-5 word title. No quotes. Text: {user_message}"
        response = await retry_gemini_call(title_model.generate_content_async, prompt)
        title = response.text.strip().replace('"', '')
        
        session = await ChatSession.find_one(ChatSession.session_id == session_id, ChatSession.user_email == user_email)
        if session:
            session.title = title
            await session.save()
            
            await websocket.send_text(json.dumps({
                "type": "title_update",
                "id": session_id,
                "title": title
            }))
    except Exception as e:
        print(f"Title Gen Error: {e}") 

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, token: str):
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=1008)
        return

    try:
        session = await ChatSession.find_one(ChatSession.session_id == session_id, ChatSession.user_email == user.email)
    except Exception:
        session = None

    if not session:
        session = ChatSession(session_id=session_id, user_email=user.email, title="New Chat")

    await websocket.accept()

    try:
        while True:
            full_response = ""
            data = await websocket.receive_text()
            
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue
            
            msg_type = payload.get("type", "message")
            user_msg_content = ""
            attachment = None
            should_save_user_msg = False
            temp_id = None

            if msg_type == "message":
                user_msg_content = payload.get("message", "")
                attachment = payload.get("attachment")
                temp_id = payload.get("tempId")
                should_save_user_msg = True
            
            elif msg_type == "regenerate":
                try:
                    last_msgs = await ChatMessage.find(ChatMessage.session_id == session_id)\
                        .sort(-ChatMessage.timestamp).limit(2).to_list()
                    if last_msgs and last_msgs[0].role == "assistant":
                        await last_msgs[0].delete()
                        if len(last_msgs) > 1 and last_msgs[1].role == "user":
                            user_msg_content = last_msgs[1].content
                except Exception:
                    continue

            if user_msg_content:
                try:
                    await websocket.send_text(json.dumps({"type": "start"}))

                    history_task = asyncio.create_task(get_formatted_history(session_id))
                    rag_task = asyncio.create_task(speculative_rag_search(session_id, user_msg_content))
                    
                    db_attachments = []
                    user_msg_content_for_ai = user_msg_content
                    
                    if attachment and should_save_user_msg:
                        try:
                            if attachment['type'] == 'text':
                                asyncio.create_task(asyncio.to_thread(add_to_vector_db, attachment['content'], attachment['filename']))
                                user_msg_content_for_ai += f"\n\n[Attached File Content]:\n{attachment['content']}\n"
                                db_attachments.append(Attachment(type='file', filename=attachment['filename'], file_type='pdf'))
                            elif attachment['type'] == 'image':
                                img_data = None
                                if attachment.get('url'):
                                    async with httpx.AsyncClient() as client:
                                        resp = await client.get(attachment['url'])
                                        img_data = Image.open(io.BytesIO(resp.content))
                                if img_data:
                                    user_msg_content_for_ai = [user_msg_content, img_data]
                                    db_attachments.append(Attachment(type='image', url=attachment['url'], filename=attachment['filename']))
                        except Exception as e:
                            print(f"Attachment Error: {e}")

                    save_msg_task = None
                    if should_save_user_msg:
                        try:
                            save_msg_task = asyncio.create_task(
                                ChatMessage(
                                    session_id=session_id, user_email=user.email, role="user", 
                                    content=user_msg_content, attachments=db_attachments
                                ).insert()
                            )
                        except Exception as e:
                            print(f"DB Save Failed (User): {e}")

                    history_data = await history_task
                    rag_context = None
                    try:
                        rag_context = await asyncio.wait_for(rag_task, timeout=2.0)
                    except Exception: pass

                    gemini_prompt = user_msg_content_for_ai
                    if rag_context:
                        sys_instruction = f"Context:\n{rag_context}\n\nQuestion: {user_msg_content}"
                        if isinstance(gemini_prompt, list):
                            gemini_prompt[0] = sys_instruction
                        else:
                            gemini_prompt = sys_instruction

                    chat_session = model.start_chat(history=history_data, enable_automatic_function_calling=False)
                    
                    function_call_found = None
                    fn_name = None
                    tool_result = None

                    response_stream = await retry_gemini_call(chat_session.send_message_async, gemini_prompt, stream=True)
                    
                    async for chunk in response_stream:
                        if chunk.candidates and chunk.candidates[0].content.parts:
                            part = chunk.candidates[0].content.parts[0]
                            if part.function_call and part.function_call.name:
                                function_call_found = part.function_call
                                break 
                        
                        try:
                            if chunk.text:
                                clean_chunk = chunk.text.replace(r"\!", "!")
                                full_response += clean_chunk
                                await websocket.send_text(json.dumps({"type": "chunk", "content": clean_chunk}))
                        except Exception:
                            pass

                    if function_call_found:
                        fn_name = function_call_found.name
                        fn_args = dict(function_call_found.args)
                        
                        friendly_name = "Generating Image..." if "generate_image" in fn_name else "Searching Web..."
                        await websocket.send_text(json.dumps({"type": "status", "content": f"{friendly_name}"}))
                        
                        tool_result = "Error."
                        if fn_name in available_tools:
                            try:
                                tool_result = await asyncio.to_thread(available_tools[fn_name], **fn_args)
                            except Exception as e:
                                tool_result = f"Tool Execution Failed: {str(e)}"
                        
                        part = genai.protos.Part(function_response=genai.protos.FunctionResponse(name=fn_name, response={'result': tool_result}))
                        
                        final_stream = await retry_gemini_call(chat_session.send_message_async, [part], stream=True)
                        async for chunk in final_stream:
                            try:
                                if chunk.text:
                                    clean_chunk = chunk.text.replace(r"\!", "!")
                                    full_response += clean_chunk
                                    await websocket.send_text(json.dumps({"type": "chunk", "content": clean_chunk}))
                            except Exception: pass

                    try:
                        asyncio.create_task(
                            ChatMessage(session_id=session_id, user_email=user.email, role="assistant", content=full_response).insert()
                        )
                    except Exception: pass
                    
                    if save_msg_task:
                        try:
                            saved_msg = await save_msg_task
                            if temp_id:
                                await websocket.send_text(json.dumps({"type": "id_update", "tempId": temp_id, "realId": str(saved_msg.id)}))
                        except Exception: pass

                except Exception as e:
                    error_msg = get_error_message(e)
                    
                    if function_call_found and fn_name == "generate_image_tool" and "pollinations" in str(tool_result):
                        await websocket.send_text(json.dumps({"type": "chunk", "content": f"{tool_result}\n\n(Note: AI context lost due to connection error, but here is your image.)"}))
                    else:
                        await websocket.send_text(json.dumps({"type": "chunk", "content": error_msg}))
                    
                    print(f"Handled Error: {e}")

                finally:
                    await websocket.send_text(json.dumps({"type": "end"}))
                
                if session.title == "New Chat" and user_msg_content and should_save_user_msg:
                    session.title = "Generating..." 
                    asyncio.create_task(generate_smart_title(session_id, user.email, user_msg_content, websocket))

    except WebSocketDisconnect:
        print("WS Disconnected")
    except Exception as e:
        print(f"WS Critical Error: {e}")
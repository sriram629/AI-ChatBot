from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List
from .auth import get_ws_user, get_current_user
from .models import ChatMessage, ChatSession, User
import os
import json
import base64
import httpx
import google.generativeai as genai
from datetime import datetime
from beanie import PydanticObjectId

router = APIRouter()

IMAGE_API_URL = "https://router.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
HF_HEADERS = {"Authorization": f"Bearer {os.getenv('HF_API_KEY')}"}

def generate_image_tool(prompt: str):
    print(f"🎨 Tool Triggered: {prompt}")
    try:
        response = httpx.post(
            IMAGE_API_URL, 
            headers=HF_HEADERS, 
            json={"inputs": prompt}, 
            timeout=60.0 
        )
        if response.status_code != 200:
            return f"Error: Image generation failed ({response.status_code})"
            
        image_data = base64.b64encode(response.content).decode("utf-8")
        return f"![Generated Image](data:image/jpeg;base64,{image_data})"
    except Exception as e:
        return f"Error: {str(e)}"

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

SYSTEM_PROMPT = """
You are a helpful AI assistant.
When you use the 'generate_image_tool', the tool will return a Markdown Image string.
You MUST output this Markdown string exactly as is.
DO NOT wrap it in code blocks.
DO NOT escape the exclamation mark.
Just display the image directly to the user.
"""

tools_config = [generate_image_tool]
model = genai.GenerativeModel(
    model_name='gemini-2.5-flash', 
    tools=tools_config,
    system_instruction=SYSTEM_PROMPT
)

@router.post("/sessions", response_model=ChatSession, tags=["Chat"])
async def create_session(user: User = Depends(get_current_user)):
    session = ChatSession(user_email=user.email, title="New Chat")
    await session.insert()
    return session

@router.get("/sessions", response_model=List[ChatSession], tags=["Chat"])
async def get_sessions(user: User = Depends(get_current_user)):
    sessions = await ChatSession.find(
        ChatSession.user_email == user.email
    ).sort(-ChatSession.updated_at).to_list()
    return sessions

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessage], tags=["Chat"])
async def get_session_messages(session_id: str, user: User = Depends(get_current_user)):
    session = await ChatSession.find_one(ChatSession.session_id == session_id, ChatSession.user_email == user.email)
    if not session: return []
    return await ChatMessage.find(ChatMessage.session_id == session_id).sort(+ChatMessage.timestamp).to_list()

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, token: str):
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=1008)
        return

    session = await ChatSession.find_one(ChatSession.session_id == session_id, ChatSession.user_email == user.email)
    if not session:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    
    history_msgs = await ChatMessage.find(ChatMessage.session_id == session_id).sort(+ChatMessage.timestamp).to_list()
    valid_history = []
    for m in history_msgs:
        if m.content and m.content.strip():
             valid_history.append({"role": "user" if m.role == "user" else "model", "parts": [m.content]})

    chat_session = model.start_chat(history=valid_history, enable_automatic_function_calling=True)

    try:
        while True:
            full_response = ""
            is_ai_turn = False

            data = await websocket.receive_text()
            payload = json.loads(data)
            
            msg_type = payload.get("type", "message")
            user_msg_content = ""

            if msg_type == "message":
                user_msg_content = payload.get("message")
                temp_id = payload.get("tempId")
                if not user_msg_content: continue

                user_msg = ChatMessage(
                    session_id=session_id, user_email=user.email, role="user", content=user_msg_content
                )
                await user_msg.insert()

                if temp_id:
                    await websocket.send_text(json.dumps({
                        "type": "id_update",
                        "tempId": temp_id,
                        "realId": str(user_msg.id)
                    }))

                if session.title == "New Chat":
                    session.title = user_msg_content[:40]
                    await session.save()

            elif msg_type == "edit":
                try:
                    msg_id = payload.get("messageId")
                    new_content = payload.get("newContent")
                    if not msg_id or not new_content: continue
                    
                    if not PydanticObjectId.is_valid(msg_id): continue

                    target_msg = await ChatMessage.get(PydanticObjectId(msg_id))
                    if not target_msg or target_msg.user_email != user.email: continue
                    
                    target_msg.content = new_content
                    await target_msg.save()
                    user_msg_content = new_content

                    await ChatMessage.find(
                        ChatMessage.session_id == session_id,
                        ChatMessage.timestamp > target_msg.timestamp
                    ).delete()

                    fresh_history = await ChatMessage.find(
                        ChatMessage.session_id == session_id,
                        ChatMessage.timestamp < target_msg.timestamp
                    ).sort(+ChatMessage.timestamp).to_list()

                    new_context = []
                    for m in fresh_history:
                        if m.content and m.content.strip():
                            new_context.append({"role": "user" if m.role == "user" else "model", "parts": [m.content]})
                    
                    chat_session = model.start_chat(history=new_context, enable_automatic_function_calling=True)

                except Exception:
                    continue

            elif msg_type == "regenerate":
                try:
                    last_ai_msg = await ChatMessage.find(
                        ChatMessage.session_id == session_id
                    ).sort(-ChatMessage.timestamp).first_or_none()

                    if not last_ai_msg or last_ai_msg.role != "assistant": continue

                    user_prompt_msg = await ChatMessage.find(
                        ChatMessage.session_id == session_id,
                        ChatMessage.timestamp < last_ai_msg.timestamp
                    ).sort(-ChatMessage.timestamp).first_or_none()

                    if not user_prompt_msg: continue
                    
                    user_msg_content = user_prompt_msg.content
                    await last_ai_msg.delete()

                    fresh_history = await ChatMessage.find(
                        ChatMessage.session_id == session_id,
                        ChatMessage.timestamp < user_prompt_msg.timestamp
                    ).sort(+ChatMessage.timestamp).to_list()

                    new_context = []
                    for m in fresh_history:
                        if m.content and m.content.strip():
                            new_context.append({"role": "user" if m.role == "user" else "model", "parts": [m.content]})
                    
                    chat_session = model.start_chat(history=new_context, enable_automatic_function_calling=True)

                except Exception:
                    continue

            session.updated_at = datetime.utcnow()
            await session.save()

            await websocket.send_text(json.dumps({"type": "start"}))
            is_ai_turn = True

            try:
                response = await chat_session.send_message_async(user_msg_content)
                
                if response.parts:
                    for part in response.parts:
                        text_chunk = part.text
                        if text_chunk:
                            clean_chunk = text_chunk.replace(r"\!", "!")
                            full_response += clean_chunk
                            await websocket.send_text(json.dumps({
                                "type": "chunk", 
                                "content": clean_chunk
                            }))
                else:
                    fallback = "I processed the request."
                    full_response = fallback
                    await websocket.send_text(json.dumps({"type": "chunk", "content": fallback}))

            except Exception:
                full_response = "**Error:** I couldn't process that request."
                await websocket.send_text(json.dumps({"type": "chunk", "content": full_response}))

            await ChatMessage(
                session_id=session_id, user_email=user.email, role="assistant", content=full_response
            ).insert()
            
            is_ai_turn = False
            await websocket.send_text(json.dumps({"type": "end"}))

    except WebSocketDisconnect:
        if is_ai_turn:
            final_content = full_response if full_response.strip() else "Generation stopped by user."
            await ChatMessage(
                session_id=session_id, 
                user_email=user.email, 
                role="assistant", 
                content=final_content
            ).insert()

    except Exception:
        try:
            await websocket.close()
        except:
            pass
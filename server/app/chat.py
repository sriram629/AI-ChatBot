from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List
from .auth import get_ws_user, get_current_user
from .models import ChatMessage, ChatSession, User
import os
import json
import urllib.parse
import random
import google.generativeai as genai
from datetime import datetime

router = APIRouter()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def generate_image_tool(prompt: str):
    """Generates an image URL using Pollinations.ai."""
    print(f"🎨 Tool Triggered: {prompt}")
    try:
        encoded_prompt = urllib.parse.quote(prompt)
        seed = random.randint(1, 100000)
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&nologo=true"
        
        return f"![Generated Image]({image_url})"

    except Exception as e:
        return f"Error generating image: {str(e)}"

tools_config = [generate_image_tool]

SYSTEM_PROMPT = """
You are a helpful AI assistant.
When you use the 'generate_image_tool', the tool will return a Markdown Image string (like ![alt](url)).
You MUST output this Markdown string exactly as is.
DO NOT wrap it in code blocks (```).
DO NOT escape the exclamation mark (don't type \!).
Just display the image directly to the user.
"""

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
            data = await websocket.receive_text()
            payload = json.loads(data)
            user_msg_content = payload.get("message")

            if not user_msg_content: continue

            await ChatMessage(
                session_id=session_id, user_email=user.email, role="user", content=user_msg_content
            ).insert()

            if session.title == "New Chat":
                session.title = user_msg_content[:40]
                await session.save()
            session.updated_at = datetime.utcnow()
            await session.save()

            await websocket.send_text(json.dumps({"type": "start"}))
            full_response = ""

            try:
                response = await chat_session.send_message_async(user_msg_content)
                
                # Iterate parts to handle text chunks
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

            except Exception as e:
                print(f"AI Error: {e}")
                err_msg = "**Error:** I couldn't process that request."
                await websocket.send_text(json.dumps({"type": "chunk", "content": err_msg}))
                full_response = err_msg

            await ChatMessage(
                session_id=session_id, user_email=user.email, role="assistant", content=full_response
            ).insert()

            await websocket.send_text(json.dumps({"type": "end"}))

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except:
            pass
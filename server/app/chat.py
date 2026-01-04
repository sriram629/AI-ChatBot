from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, HTTPException
from typing import List
from .auth import get_ws_user, get_current_user
from .models import ChatMessage, ChatSession, User, Attachment
import os
import json
import asyncio
import google.generativeai as genai
from groq import Groq
from mistralai import Mistral
from datetime import datetime
from beanie import PydanticObjectId
from .utils import handle_file_upload
from .tools import search_web_consensus, generate_image_tool
from .rag import add_to_vector_db, search_vector_db
from beanie.operators import Exists

router = APIRouter()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

hf_token = os.getenv("HF_API_KEY")

gemini_model = genai.GenerativeModel(model_name='gemini-2.0-flash-lite')
title_model = genai.GenerativeModel('gemini-2.0-flash-lite')

current_date = datetime.now().strftime("%A, %B %d, %Y")

BASE_CONSTRAINTS = """
STRICT OUTPUT GUIDELINES:
1. TABLES: Use Markdown tables for all data comparisons and structured lists.
2. MATH: Use $...$ for inline and $$...$$ for block LaTeX formulas.
3. CODE: Specify the language (e.g., ```typescript) for syntax highlighting.
4. IMAGES: If asked to create an image, acknowledge that the vision engine is processing it.
5. TONE: Professional, objective, and dense with information. Bold key concepts.
"""

GEMINI_PROMPT = f"Persona: Gemini. Date: {current_date}. {BASE_CONSTRAINTS}"
GROQ_PROMPT = f"Persona: Gemini (via Groq). Date: {current_date}. {BASE_CONSTRAINTS}"
MISTRAL_PROMPT = f"Persona: Gemini (via Mistral). Date: {current_date}. {BASE_CONSTRAINTS}"

async def safe_send(websocket: WebSocket, data: dict):
    try:
        await websocket.send_text(json.dumps(data))
    except:
        pass

async def detect_intent(user_msg: str) -> str:
    try:
        check_prompt = (
            f"Classify the user intent for this message: '{user_msg}'.\n"
            "Rules:\n"
            "- If the user wants to see, draw, or create an image/picture, reply exactly: IMAGE\n"
            "- If it is a greeting like hi, hello, or bye, reply exactly: SIMPLE\n"
            "- Otherwise, reply exactly: COMPLEX\n"
            "Response must be ONE word only."
        )
        resp = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[{"role": "user", "content": check_prompt}],
            max_tokens=5,
            temperature=0  # Keep it deterministic
        )
        return resp.choices[0].message.content.strip().upper()
    except:
        return "COMPLEX"

async def call_mistral(prompt, history, websocket, context):
    try:
        msgs = [{"role": "system", "content": MISTRAL_PROMPT}]
        for h in history:
            msgs.append({"role": "user" if h['role'] == 'user' else "assistant", "content": h['parts'][0]})
        msgs.append({"role": "user", "content": f"CONTEXT: {context}\n\nUSER: {prompt}"})
        full_resp = ""
        stream = mistral_client.chat.stream(model="mistral-small-latest", messages=msgs)
        for chunk in stream:
            content = chunk.data.choices[0].delta.content
            if content:
                full_resp += content
                await safe_send(websocket, {"type": "chunk", "content": content})
        return full_resp
    except:
        return "All AI systems are currently at capacity."

async def call_groq(prompt, history, websocket, context):
    try:
        msgs = [{"role": "system", "content": GROQ_PROMPT}]
        for h in history:
            msgs.append({"role": "user" if h['role'] == 'user' else "assistant", "content": h['parts'][0]})
        msgs.append({"role": "user", "content": f"CONTEXT: {context}\n\nUSER: {prompt}"})
        full_resp = ""
        comp = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=msgs, stream=True)
        for chunk in comp:
            content = chunk.choices[0].delta.content
            if content:
                full_resp += content
                await safe_send(websocket, {"type": "chunk", "content": content})
        return full_resp
    except:
        await safe_send(websocket, {"type": "status", "content": "Switching to safety fallback..."})
        return await call_mistral(prompt, history, websocket, context)

async def call_gemini(prompt, history, websocket, context):
    try:
        chat = gemini_model.start_chat(history=history)
        response_stream = await chat.send_message_async(f"CONTEXT: {context}\n\nUSER: {prompt}", stream=True)
        full_resp = ""
        async for chunk in response_stream:
            if chunk.text:
                full_resp += chunk.text
                await safe_send(websocket, {"type": "chunk", "content": chunk.text})
        return full_resp
    except:
        await safe_send(websocket, {"type": "status", "content": "Gemini busy, trying backup..."})
        return await call_groq(prompt, history, websocket, context)

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, token: str):
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=1008); return
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            msg_type, user_msg = payload.get("type", "message"), payload.get("message", "")
            temp_id, attachment = payload.get("tempId"), payload.get("attachment")
            
            session = await ChatSession.find_one(ChatSession.session_id == session_id)
            if not session:
                session = await ChatSession(session_id=session_id, user_email=user.email, title="New Chat").insert()
                await safe_send(websocket, {"type": "refresh-sessions"})
            
            if msg_type in ["edit", "regenerate"]:
                trigger = await ChatMessage.find_one(ChatMessage.session_id == session_id, ChatMessage.content == user_msg)
                if trigger:
                    await ChatMessage.find(ChatMessage.session_id == session_id, ChatMessage.timestamp > trigger.timestamp).delete()
            
            db_atts = []
            if attachment and attachment['type'] == 'text':
                try: 
                    await add_to_vector_db(attachment['content'], attachment['filename'], session_id)
                    db_atts.append(Attachment(type='file', filename=attachment['filename']))
                except: pass
            
            if msg_type == "message":
                await ChatMessage(session_id=session_id, user_email=user.email, role="user", content=user_msg, attachments=db_atts).insert()
            
            await safe_send(websocket, {"type": "start", "tempId": temp_id})
            
            intent = await detect_intent(user_msg)
            
            if "IMAGE" in intent:
                await safe_send(websocket, {"type": "status", "content": "Generating vision assets..."})
                img_md = await generate_image_tool(user_msg)
                if not img_md:
                     await safe_send(websocket, {
                        "type": "status", 
                        "content": "Generation failed. Try a simpler prompt." 
                    })
                await ChatMessage(session_id=session_id, user_email=user.email, role="assistant", content=img_md).insert()
                await safe_send(websocket, {"type": "chunk", "content": img_md})
                await safe_send(websocket, {"type": "end"})
            else:
                rag_task = asyncio.create_task(search_vector_db(session_id, user_msg))
                web_task = asyncio.create_task(search_web_consensus(user_msg))
                rag_ctx = await rag_task or "None"
                web_ctx = await web_task or "None"
                context = f"RAG: {rag_ctx}\nSEARCH: {web_ctx}"
                history = await get_formatted_history(session_id)
                
                if intent == "COMPLEX":
                    full_resp = await call_gemini(user_msg, history, websocket, context)
                else:
                    full_resp = await call_groq(user_msg, history, websocket, context)
                
                await ChatMessage(session_id=session_id, user_email=user.email, role="assistant", content=full_resp).insert()
                await safe_send(websocket, {"type": "end"})

            if session.title == "New Chat":
                asyncio.create_task(generate_smart_title(session_id, user_msg, websocket))

    except Exception: pass

async def get_formatted_history(session_id: str):
    msgs = await ChatMessage.find(ChatMessage.session_id == session_id).sort(-ChatMessage.timestamp).limit(5).to_list()
    msgs.reverse()
    return [{"role": "user" if m.role == "user" else "model", "parts": [m.content]} for m in msgs if m.content]

async def generate_smart_title(session_id, user_msg, websocket):
    try:
        title = user_msg[:30] + "..."
        try:
            res = await title_model.generate_content_async(f"Give a 3-word title for: {user_msg}")
            title = res.text.strip().replace('"', '')
        except:
            try:
                res = groq_client.chat.completions.create(model="llama-3.1-8b-instant", messages=[{"role":"user","content":f"Title in 3 words: {user_msg}"}], max_tokens=10)
                title = res.choices[0].message.content.strip().replace('"', '')
            except: pass
        
        session = await ChatSession.find_one(ChatSession.session_id == session_id)
        if session:
            session.title = title
            await session.save()
            await safe_send(websocket, {"type": "title_update", "id": session_id, "title": title})
    except: pass

@router.post("/sessions")
async def create_session(user: User = Depends(get_current_user)):
    return await ChatSession(session_id=str(PydanticObjectId()), user_email=user.email, title="New Chat").insert()

@router.get("/sessions")
async def get_sessions(user: User = Depends(get_current_user)):
    return await ChatSession.find(ChatSession.user_email == user.email).sort(-ChatSession.updated_at).to_list()

@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, user: User = Depends(get_current_user)):
    return await ChatMessage.find(ChatMessage.session_id == session_id).sort(+ChatMessage.timestamp).to_list()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    return await handle_file_upload(file)
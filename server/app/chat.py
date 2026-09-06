from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, HTTPException
from typing import List
from .auth import get_ws_user, get_current_user
from .models import ChatMessage, ChatSession, User, Attachment
import os
import json
import asyncio
import google.generativeai as genai
from groq import AsyncGroq
from mistralai import Mistral
from datetime import datetime
from beanie import PydanticObjectId
from .utils import handle_file_upload, image_part
from .tools import search_web_consensus, generate_image_tool
from .rag import add_to_vector_db, search_vector_db, has_session_documents
from beanie.operators import Exists
import logging
logger = logging.getLogger(__name__)

router = APIRouter()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"), timeout=30, max_retries=0) if os.getenv("GROQ_API_KEY") else None
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

hf_token = os.getenv("HF_API_KEY")

gemini_model = genai.GenerativeModel("gemini-3.5-flash-lite")
title_model = genai.GenerativeModel("gemini-3.5-flash-lite")

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
        await websocket.send_json(data)
    except (RuntimeError, OSError, WebSocketDisconnect):
        raise asyncio.CancelledError()


async def get_owned_session(session_id: str, user: User):
    session = await ChatSession.find_one(
        ChatSession.session_id == session_id, ChatSession.user_email == user.email)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


def detect_intent(message: str) -> str:
    import re
    if re.search(r"\b(draw|generate|create|make)\b.{0,60}\b(image|picture|photo|illustration)\b", message, re.I):
        return "IMAGE"
    return "COMPLEX"


def provider_messages(prompt, history, context, persona):
    # Text-only backups must never pretend to see an image.
    messages = [{"role": "system", "content": persona}]
    for h in history:
        text = "\n".join(part for part in h["parts"] if isinstance(part, str))
        messages.append({"role": "user" if h["role"] == "user" else "assistant", "content": text})
    messages.append({"role": "user", "content": f"CONTEXT: {context}\n\nUSER: {prompt}"})
    return messages


async def call_mistral(prompt, history, websocket, context):
    full = ""
    try:
        stream = await mistral_client.chat.stream_async(
            model="mistral-small-latest",
            messages=provider_messages(prompt, history, context, MISTRAL_PROMPT),
            timeout_ms=30000)
        async with stream:
            async for chunk in stream:
                text = chunk.data.choices[0].delta.content
                if isinstance(text, str):
                    full += text
                    await safe_send(websocket, {"type": "chunk", "content": text})
        if not full:
            raise ValueError("Empty Mistral response")
        return full
    except Exception:
        logger.exception("Mistral request failed")
        message = "\nResponse interrupted. Please try again." if full else "The AI services are temporarily unavailable. Please try again."
        await safe_send(websocket, {"type": "chunk", "content": message})
        return full + message


async def call_groq(prompt, history, websocket, context):
    full = ""
    try:
        if groq_client is None:
            raise ValueError("Groq is not configured")
        stream = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=provider_messages(prompt, history, context, GROQ_PROMPT), stream=True)
        async with stream:
            async for chunk in stream:
                if chunk.choices:
                    text = chunk.choices[0].delta.content
                    if text:
                        full += text
                        await safe_send(websocket, {"type": "chunk", "content": text})
        if not full:
            raise ValueError("Empty Groq response")
        return full
    except Exception:
        logger.exception("Groq request failed")
        if full:
            text = "\nResponse interrupted. Please try again."
            await safe_send(websocket, {"type": "chunk", "content": text})
            return full + text
        return await call_mistral(prompt, history, websocket, context)


async def call_gemini(prompt, history, websocket, context, attachments):
    full = ""
    parts = [f"{GEMINI_PROMPT}\nCONTEXT: {context}\n\nUSER: {prompt}"]
    for attachment in attachments:
        if attachment.type == "image":
            parts.append(image_part(attachment.content))
    try:
        chat = gemini_model.start_chat(history=history)
        stream = await chat.send_message_async(parts, stream=True)
        async for chunk in stream:
            if chunk.text:
                full += chunk.text
                await safe_send(websocket, {"type": "chunk", "content": chunk.text})
        if not full:
            raise ValueError("Empty Gemini response")
        return full
    except Exception:
        logger.exception("Gemini request failed")
        has_images = len(parts) > 1 or any(
            not isinstance(part, str) for h in history for part in h["parts"])
        if full or has_images:
            text = "\nResponse interrupted. Please try again." if full else "Image analysis is unavailable right now. Please try again."
            await safe_send(websocket, {"type": "chunk", "content": text})
            return full + text
        await safe_send(websocket, {"type": "status", "content": "Trying a backup model..."})
        return await call_groq(prompt, history, websocket, context)


async def process_message(websocket, session_id, user, payload):
    session = await get_owned_session(session_id, user)
    action = payload.get("type", "message")
    message = payload.get("message", "")
    if not isinstance(message, str) or len(message) > 20000:
        raise HTTPException(400, "Message is too long or invalid")
    attachments = []
    if action == "edit":
        try:
            message_id = PydanticObjectId(payload.get("messageId", ""))
        except Exception:
            raise HTTPException(400, "Invalid message ID")
        trigger = await ChatMessage.find_one(
            ChatMessage.id == message_id, ChatMessage.session_id == session_id,
            ChatMessage.user_email == user.email, ChatMessage.role == "user")
        message = payload.get("newContent", "")
        if not trigger or not isinstance(message, str) or not message.strip() or len(message) > 20000:
            raise HTTPException(400, "Invalid edit")
        attachments = trigger.attachments
        trigger.content = message
        await trigger.save()
    elif action == "regenerate":
        trigger = await ChatMessage.find(
            ChatMessage.session_id == session_id, ChatMessage.user_email == user.email,
            ChatMessage.role == "user").sort(-ChatMessage.timestamp).first_or_none()
        if not trigger:
            raise HTTPException(400, "There is no message to regenerate")
        message, attachments = trigger.content, trigger.attachments
    elif action == "message":
        raw = payload.get("attachment")
        if raw:
            if not isinstance(raw, dict) or raw.get("type") not in ("image", "text"):
                raise HTTPException(400, "Unsupported attachment")
            content = raw.get("content")
            if not isinstance(content, str) or len(content) > 4000000:
                raise HTTPException(400, "Invalid or oversized attachment")
            if raw["type"] == "image":
                image_part(content)
                attachments = [Attachment(type="image", content=content, url=raw.get("url"), filename=raw.get("filename"))]
            else:
                if not content.strip() or len(content) > 200000:
                    raise HTTPException(400, "Document is empty or too large")
                await safe_send(websocket, {"type": "status", "content": "Reading document..."})
                await asyncio.wait_for(add_to_vector_db(content, raw.get("filename", "document"), session_id), 90)
                attachments = [Attachment(type="file", filename=raw.get("filename", "document"))]
        if not message.strip() and not attachments:
            raise HTTPException(400, "Enter a message or attach a file")
        trigger = await ChatMessage(session_id=session_id, user_email=user.email,
                                    role="user", content=message, attachments=attachments).insert()
        await safe_send(websocket, {"type": "id_update", "tempId": payload.get("tempId"), "realId": str(trigger.id)})
    else:
        raise HTTPException(400, "Unknown chat action")
    if action in ("edit", "regenerate"):
        await ChatMessage.find(
            ChatMessage.session_id == session_id, ChatMessage.user_email == user.email,
            ChatMessage.timestamp > trigger.timestamp).delete()

    await safe_send(websocket, {"type": "start"})
    query = message[8:].strip() if message.lower().startswith("/search ") else message
    search = payload.get("web_search") is True or message.lower().startswith("/search ")
    if not search and not attachments and detect_intent(message) == "IMAGE":
        result = await generate_image_tool(message) or "Image generation failed. Please try again."
        await safe_send(websocket, {"type": "chunk", "content": result})
    else:
        context = "No external context available."
        try:
            if await asyncio.wait_for(has_session_documents(session_id), 5):
                context = await asyncio.wait_for(search_vector_db(session_id, query), 35) or "No matching document passages."
        except Exception:
            logger.exception("Document retrieval failed")
            context = "Document retrieval unavailable. Do not invent document contents."
        if search:
            try:
                context += "\nSEARCH: " + str(await asyncio.wait_for(search_web_consensus(query), 15))
            except Exception:
                logger.exception("Web search failed")
                context += "\nSearch unavailable. Do not claim current web verification."
        history = await get_formatted_history(session_id, trigger.timestamp)
        result = await call_gemini(query, history, websocket, context, attachments)
    reply = await ChatMessage(session_id=session_id, user_email=user.email,
                              role="assistant", content=result).insert()
    await safe_send(websocket, {"type": "id_update", "tempId": "ai-response", "realId": str(reply.id)})
    if session.title == "New Chat":
        session.title = (message.strip() or "Attachment conversation")[:60]
    await session.save()
    await safe_send(websocket, {"type": "title_update", "id": session_id, "title": session.title})
    await safe_send(websocket, {"type": "end"})


async def run_message(websocket, session_id, user, payload):
    try:
        await asyncio.wait_for(process_message(websocket, session_id, user, payload), 180)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception("Chat request failed")
        message = exc.detail if isinstance(exc, HTTPException) else "Chat failed or timed out. Please try again."
        await safe_send(websocket, {"type": "error", "content": message})


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, token: str):
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=1008)
        return
    try:
        await get_owned_session(session_id, user)
    except HTTPException:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    active = None
    try:
        while True:
            payload = await websocket.receive_json()
            if not isinstance(payload, dict):
                await safe_send(websocket, {"type": "error", "content": "Invalid request"})
                continue
            if payload.get("type") == "stop":
                if active and not active.done():
                    active.cancel()
                    await asyncio.gather(active, return_exceptions=True)
                await safe_send(websocket, {"type": "end"})
                continue
            if active and not active.done():
                await safe_send(websocket, {"type": "status", "content": "Wait for the current response or press Stop."})
                continue
            active = asyncio.create_task(run_message(websocket, session_id, user, payload))
    except WebSocketDisconnect:
        pass
    finally:
        if active:
            active.cancel()
            await asyncio.gather(active, return_exceptions=True)


async def get_formatted_history(session_id, before):
    messages = await ChatMessage.find(
        ChatMessage.session_id == session_id, ChatMessage.timestamp < before
    ).sort(-ChatMessage.timestamp).limit(10).to_list()
    history = []
    for message in reversed(messages):
        parts = [message.content or "Describe the attachment."]
        for attachment in message.attachments:
            if attachment.type == "image" and attachment.content:
                parts.append(image_part(attachment.content))
        history.append({"role": "user" if message.role == "user" else "model", "parts": parts})
    return history


@router.post("/sessions")
async def create_session(user: User = Depends(get_current_user)):
    return await ChatSession(session_id=str(PydanticObjectId()), user_email=user.email, title="New Chat").insert()

@router.get("/sessions")
async def get_sessions(user: User = Depends(get_current_user)):
    return await ChatSession.find(ChatSession.user_email == user.email).sort(-ChatSession.updated_at).to_list()

@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, user: User = Depends(get_current_user)):
    await get_owned_session(session_id, user)
    return await ChatMessage.find(
        ChatMessage.session_id == session_id,
        ChatMessage.user_email == user.email,
    ).sort(+ChatMessage.timestamp).to_list()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    return await handle_file_upload(file)

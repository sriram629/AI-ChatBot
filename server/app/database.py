from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from .models import User, ChatMessage, ChatSession
import os
import certifi

client = None

async def init_db():
    global client
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise RuntimeError("MONGO_URI is required")
    client = AsyncIOMotorClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
    await init_beanie(database=client.ai_chatbot_db, document_models=[User, ChatMessage, ChatSession])

async def ping_db():
    if client is None:
        raise RuntimeError("Database not initialized")
    await client.admin.command("ping")

def close_db():
    if client is not None:
        client.close()

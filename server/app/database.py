from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from .models import User, ChatMessage, ChatSession
import os
import certifi

async def init_db():
    mongo_uri = os.getenv("MONGO_URI")
    client = AsyncIOMotorClient(mongo_uri, tlsCAFile=certifi.where())
    
    await init_beanie(database=client.ai_chatbot_db, document_models=[User, ChatMessage, ChatSession])
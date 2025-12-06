from beanie import Document
from pydantic import EmailStr, Field
from datetime import datetime
from typing import Optional
import uuid

class User(Document):
    email: EmailStr = Field(unique=True)
    hashed_password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

class ChatSession(Document):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_email: str
    title: str = "New Chat"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_sessions"

class ChatMessage(Document):
    session_id: str
    user_email: str
    role: str 
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_messages"
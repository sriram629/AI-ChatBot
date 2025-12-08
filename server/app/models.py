from beanie import Document
from pydantic import EmailStr, Field, BaseModel
from datetime import datetime
from typing import Optional, List
import uuid

# 1. NEW: Schema for Attachments
class Attachment(BaseModel):
    type: str  # 'image' or 'file'
    url: Optional[str] = None
    filename: str
    file_type: Optional[str] = None # e.g. 'application/pdf'

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
    # 2. NEW: List of attachments
    attachments: List[Attachment] = [] 
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_messages"
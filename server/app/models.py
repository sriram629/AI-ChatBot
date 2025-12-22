from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

class Attachment(BaseModel):
    type: str
    content: Optional[str] = None
    url: Optional[str] = None
    filename: Optional[str] = None
    file_type: Optional[str] = None

    class Config:
        extra = "ignore"

class ChatMessage(Document):
    session_id: str
    user_email: str
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    attachments: List[Attachment] = []

    class Settings:
        name = "chat_messages"

class ChatSession(Document):
    session_id: str = Field(default_factory=lambda: str(PydanticObjectId()))
    user_email: str
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_sessions"
    
    async def save(self, *args, **kwargs):
        self.updated_at = datetime.utcnow()
        await super().save(*args, **kwargs)

class User(Document):
    email: EmailStr
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
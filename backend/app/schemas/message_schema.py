from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class MessageBase(BaseModel):
    sender_name: Optional[str] = "Anonymous"
    message_text: str = Field(..., min_length=2, max_length=2000)

class MessageOut(BaseModel):
    id: int
    teacher_id: int
    sender_name: Optional[str] = "Anonymous"
    message_text: str
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    approved: bool = False
    created_at: Optional[str] = None

class AdminMessageOut(BaseModel):
    id: int
    teacher_id: int
    teacher_name: str
    teacher_slug: str
    sender_name: Optional[str] = "Anonymous"
    message_text: str
    media_type: Optional[str] = None
    media_filename: Optional[str] = None
    media_url: Optional[str] = None
    approved: bool = False
    created_at: Optional[str] = None

class MessageActionResponse(BaseModel):
    success: bool
    message: str
    id: Optional[int] = None

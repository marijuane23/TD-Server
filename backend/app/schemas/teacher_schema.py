from typing import Optional, List
from pydantic import BaseModel
from app.schemas.message_schema import MessageOut

class TeacherListItem(BaseModel):
    id: int
    name: str
    department: Optional[str] = None
    slug: str
    photo_url: Optional[str] = None
    message_count: int = 0
    created_at: Optional[str] = None

class TeacherDetail(BaseModel):
    id: int
    name: str
    department: Optional[str] = None
    slug: str
    photo_url: Optional[str] = None
    messages: List[MessageOut] = []
    message_count: int = 0

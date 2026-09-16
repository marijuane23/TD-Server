from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response, status
from app.database import get_db
from app.services.media_service import process_media_upload
from app.schemas.message_schema import MessageActionResponse

router = APIRouter(tags=["messages"])

@router.post("/teachers/{slug}/messages", response_model=MessageActionResponse)
async def submit_message(
    slug: str,
    sender_name: Optional[str] = Form("Anonymous"),
    message_text: str = Form(...),
    media_file: Optional[UploadFile] = File(None),
    hp_check: Optional[str] = Form(None)
):
    """
    Submit a tribute message for a teacher with optional media file (image or short video).
    Media is stored directly in MySQL as a BLOB. Submission is pending until admin approval.
    """
    # 1. Anti-spam honeypot check: If the hidden honeypot field has a value, silently ignore bot
    if hp_check and hp_check.strip():
        return MessageActionResponse(
            success=True,
            message="Thank you! Your message has been submitted and is pending review.",
            id=0
        )

    # 2. Basic text validation
    clean_text = message_text.strip()
    if len(clean_text) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message text must be at least 2 characters."
        )
    if len(clean_text) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message text cannot exceed 2,000 characters."
        )

    clean_sender = (sender_name or "Anonymous").strip()
    if not clean_sender:
        clean_sender = "Anonymous"
    if len(clean_sender) > 100:
        clean_sender = clean_sender[:100]

    # 3. Verify teacher exists
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM teachers WHERE slug = %s", (slug,))
        teacher = cursor.fetchone()
        cursor.close()

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Teacher with slug '{slug}' was not found."
        )
    teacher_id = teacher["id"]

    # 4. Process media upload if provided
    binary_data, mime_type, filename, media_type = await process_media_upload(media_file)

    # 5. Insert into database
    insert_sql = """
    INSERT INTO messages (
        teacher_id, sender_name, message_text,
        media_data, media_mime_type, media_filename, media_type, approved
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        teacher_id,
        clean_sender,
        clean_text,
        binary_data,
        mime_type,
        filename,
        media_type,
        False  # Requires moderation
    )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(insert_sql, params)
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()

    return MessageActionResponse(
        success=True,
        message="Thank you! Your appreciation message has been submitted and is awaiting approval.",
        id=new_id
    )

@router.get("/messages/{id}/media")
def stream_media(id: int):
    """
    Streams media file (image or video BLOB) directly from MySQL with proper MIME headers.
    """
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT media_data, media_mime_type, media_filename FROM messages WHERE id = %s",
            (id,)
        )
        row = cursor.fetchone()
        cursor.close()

    if not row or not row.get("media_data"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media attachment not found."
        )

    mime_type = row.get("media_mime_type") or "application/octet-stream"
    filename = row.get("media_filename") or f"media_{id}"

    headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
    }

    return Response(
        content=row["media_data"],
        media_type=mime_type,
        headers=headers
    )

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header, Query, status
from app.database import get_db
from app.config import settings
from app.schemas.message_schema import AdminMessageOut, MessageActionResponse

router = APIRouter(prefix="/admin", tags=["admin"])

def verify_admin_auth(
    x_admin_token: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    provided_token = x_admin_token or token
    if not provided_token or provided_token.strip() != settings.ADMIN_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin authentication token."
        )

@router.get("/pending", response_model=List[AdminMessageOut])
def list_pending_messages(
    x_admin_token: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """
    List all pending/unapproved messages awaiting review.
    """
    verify_admin_auth(x_admin_token, token)

    query = """
    SELECT 
        m.id, m.teacher_id, t.name as teacher_name, t.slug as teacher_slug,
        m.sender_name, m.message_text, m.media_type, m.media_filename,
        m.approved, m.created_at
    FROM messages m
    JOIN teachers t ON m.teacher_id = t.id
    WHERE m.approved = FALSE
    ORDER BY m.created_at DESC
    """
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()

    results = []
    for r in rows:
        media_url = f"/api/messages/{r['id']}/media" if r.get("media_type") else None
        results.append(AdminMessageOut(
            id=r["id"],
            teacher_id=r["teacher_id"],
            teacher_name=r["teacher_name"],
            teacher_slug=r["teacher_slug"],
            sender_name=r["sender_name"] or "Anonymous",
            message_text=r["message_text"],
            media_type=r["media_type"],
            media_filename=r["media_filename"],
            media_url=media_url,
            approved=bool(r["approved"]),
            created_at=r["created_at"].isoformat() if r["created_at"] else None
        ))
    return results

@router.post("/approve/{id}", response_model=MessageActionResponse)
def approve_message(
    id: int,
    x_admin_token: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """
    Approve a pending message to make it visible on the teacher's profile.
    """
    verify_admin_auth(x_admin_token, token)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE messages SET approved = TRUE WHERE id = %s", (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()

    if affected == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message with ID {id} was not found."
        )

    return MessageActionResponse(
        success=True,
        message=f"Message {id} approved successfully!",
        id=id
    )

@router.delete("/reject/{id}", response_model=MessageActionResponse)
def reject_message(
    id: int,
    x_admin_token: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """
    Reject and delete a message (e.g., spam or inappropriate submission).
    """
    verify_admin_auth(x_admin_token, token)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages WHERE id = %s", (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()

    if affected == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message with ID {id} was not found."
        )

    return MessageActionResponse(
        success=True,
        message=f"Message {id} rejected and removed.",
        id=id
    )

@router.get("/stats")
def get_stats(
    x_admin_token: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """
    Overview statistics for event monitors.
    """
    verify_admin_auth(x_admin_token, token)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM teachers")
        total_teachers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM messages")
        total_messages = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM messages WHERE approved = TRUE")
        approved_messages = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM messages WHERE approved = FALSE")
        pending_messages = cursor.fetchone()[0]
        cursor.close()

    return {
        "total_teachers": total_teachers,
        "total_messages": total_messages,
        "approved_messages": approved_messages,
        "pending_messages": pending_messages
    }

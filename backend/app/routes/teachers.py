from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.database import get_db
from app.schemas.teacher_schema import TeacherListItem, TeacherDetail
from app.schemas.message_schema import MessageOut

router = APIRouter(prefix="/teachers", tags=["teachers"])

@router.get("", response_model=List[TeacherListItem])
def list_teachers(
    q: Optional[str] = Query(None, description="Search by teacher name or department"),
    department: Optional[str] = Query(None, description="Filter by department")
):
    """
    List all teachers with approved message counts, with optional search and department filter.
    """
    query = """
    SELECT 
        t.id, t.name, t.department, t.slug, t.photo_url, t.created_at,
        COUNT(CASE WHEN m.approved = TRUE THEN 1 END) AS message_count
    FROM teachers t
    LEFT JOIN messages m ON t.id = m.teacher_id
    """
    conditions = []
    params = []

    if department:
        conditions.append("t.department = %s")
        params.append(department)

    if q:
        search_pattern = f"%{q.strip()}%"
        conditions.append("(t.name LIKE %s OR t.department LIKE %s)")
        params.extend([search_pattern, search_pattern])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " GROUP BY t.id, t.name, t.department, t.slug, t.photo_url, t.created_at ORDER BY t.name ASC"

    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()

    results = []
    for r in rows:
        results.append(TeacherListItem(
            id=r["id"],
            name=r["name"],
            department=r["department"],
            slug=r["slug"],
            photo_url=r["photo_url"],
            message_count=r["message_count"],
            created_at=r["created_at"].isoformat() if r["created_at"] else None
        ))
    return results

@router.get("/{slug}", response_model=TeacherDetail)
def get_teacher_by_slug(slug: str):
    """
    Get teacher profile and their approved messages with media stream links.
    """
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        # Fetch teacher
        cursor.execute(
            "SELECT id, name, department, slug, photo_url FROM teachers WHERE slug = %s",
            (slug,)
        )
        teacher = cursor.fetchone()
        if not teacher:
            cursor.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Teacher with slug '{slug}' not found."
            )

        # Fetch approved messages
        cursor.execute("""
            SELECT id, teacher_id, sender_name, message_text, media_type, approved, created_at
            FROM messages
            WHERE teacher_id = %s AND approved = TRUE
            ORDER BY created_at DESC
        """, (teacher["id"],))
        message_rows = cursor.fetchall()
        cursor.close()

    messages_out = []
    for m in message_rows:
        media_url = f"/api/messages/{m['id']}/media" if m.get("media_type") else None
        messages_out.append(MessageOut(
            id=m["id"],
            teacher_id=m["teacher_id"],
            sender_name=m["sender_name"] or "Anonymous",
            message_text=m["message_text"],
            media_type=m["media_type"],
            media_url=media_url,
            approved=bool(m["approved"]),
            created_at=m["created_at"].isoformat() if m["created_at"] else None
        ))

    return TeacherDetail(
        id=teacher["id"],
        name=teacher["name"],
        department=teacher["department"],
        slug=teacher["slug"],
        photo_url=teacher["photo_url"],
        messages=messages_out,
        message_count=len(messages_out)
    )

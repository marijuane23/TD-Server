from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from app.utils.validators import validate_media_file

async def process_media_upload(file: Optional[UploadFile]) -> Tuple[Optional[bytes], Optional[str], Optional[str], Optional[str]]:
    """
    Reads and validates an uploaded media file.
    Returns (binary_data, mime_type, filename, media_type).
    """
    if file is None or not file.filename:
        return None, None, None, None

    # Read binary contents
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        return None, None, None, None

    content_type = file.content_type or "application/octet-stream"
    media_type, clean_content_type = validate_media_file(file.filename, content_type, file_size)

    return content, clean_content_type, file.filename, media_type

from typing import Tuple, Optional
from fastapi import HTTPException, status
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}

def validate_media_file(filename: str, content_type: str, file_size: int) -> Tuple[str, str]:
    """
    Validates uploaded media file type and size.
    Returns (media_type: 'image' | 'video', clean_content_type).
    Raises HTTPException if invalid.
    """
    if not content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to determine file content type."
        )

    content_type_lower = content_type.lower()

    if content_type_lower in ALLOWED_IMAGE_TYPES:
        if file_size > settings.MAX_IMAGE_SIZE_BYTES:
            max_mb = settings.MAX_IMAGE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image file exceeds the maximum allowed size of {max_mb}MB."
            )
        return "image", content_type_lower

    elif content_type_lower in ALLOWED_VIDEO_TYPES:
        if file_size > settings.MAX_VIDEO_SIZE_BYTES:
            max_mb = settings.MAX_VIDEO_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Video file exceeds the maximum allowed size of {max_mb}MB."
            )
        return "video", content_type_lower

    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type: '{content_type}'. Please upload a JPG, PNG, WEBP image or an MP4/WEBM short video."
        )

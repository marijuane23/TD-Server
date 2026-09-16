import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Database settings
    DB_HOST: str = os.getenv("DB_HOST", "194.59.164.40")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_NAME: str = os.getenv("DB_NAME", "u463580331_td_db")
    DB_USER: str = os.getenv("DB_USER", "u463580331_td")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "Teachersd4y@2026!")
    DB_POOL_NAME: str = "td_db_pool"
    DB_POOL_SIZE: int = 5

    # Admin secret key
    ADMIN_SECRET_KEY: str = os.getenv("ADMIN_SECRET_KEY", "bisu_bilar_td_secret_2026")

    # Allowed CORS Origins
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:4321,http://127.0.0.1:4321,http://localhost:3000,http://127.0.0.1:3000,https://teachersday.bisu-bilar.edu.ph"
    )

    # Server settings
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8000"))

    # File size limits (in bytes)
    MAX_IMAGE_SIZE_BYTES: int = 5 * 1024 * 1024       # 5 MB
    MAX_VIDEO_SIZE_BYTES: int = 30 * 1024 * 1024      # 30 MB

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()

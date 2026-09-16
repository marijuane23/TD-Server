from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import teachers, messages, admin

app = FastAPI(
    title="BISU Bilar Teacher's Day API",
    description="Backend API for BISU Bilar Teacher's Day Celebration 2026. Manages faculty records, appreciation tributes, BLOB media streaming, and moderation.",
    version="1.0.0"
)

# CORS Configuration
origins = settings.cors_origin_list
allow_all = "*" in origins or not origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_origin_regex=r"^https?://.*" if allow_all else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers (Both with /api prefix and directly for convenience)
app.include_router(teachers.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Also mount directly without /api prefix
app.include_router(teachers.router)
app.include_router(messages.router)
app.include_router(admin.router)

@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"])
def health_check():
    return {
        "status": "online",
        "service": "BISU Bilar Teacher's Day API",
        "environment": settings.ENVIRONMENT
    }

@app.get("/", tags=["info"])
def root_info():
    return {
        "event": "BISU Bilar Teacher's Day 2026",
        "date": "October 7, 2026",
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)

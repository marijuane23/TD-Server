# BISU Bilar Teacher's Day — Backend API (FastAPI)

REST API backend for the BISU Bilar Teacher's Day 2026 celebration platform.

## Stack
- **FastAPI** + **Uvicorn** (Python)
- **MySQL** (Hostinger) via `mysql-connector-python`
- Media (images & videos) stored directly as BLOBs in MySQL
- Deployed on **Render** (free tier, Singapore region)

## Local Development

```bash
# 1. Create virtual environment
py -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # Mac/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your DB credentials

# 4. Initialize database (creates tables + seeds faculty)
python scripts/init_db.py

# 5. Start dev server
uvicorn app.main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

## API Endpoints

| Method   | Route                         | Description                             |
|----------|-------------------------------|-----------------------------------------|
| GET      | `/api/health`                 | Health check                            |
| GET      | `/api/teachers`               | List all teachers (supports `?q=` and `?department=`) |
| GET      | `/api/teachers/{slug}`        | Teacher profile + approved messages     |
| POST     | `/api/teachers/{slug}/messages` | Submit tribute message + optional media |
| GET      | `/api/messages/{id}/media`    | Stream image/video BLOB from database   |
| GET      | `/api/admin/pending`          | List pending messages (token required)  |
| POST     | `/api/admin/approve/{id}`     | Approve a message (token required)      |
| DELETE   | `/api/admin/reject/{id}`      | Reject/delete a message (token required)|
| GET      | `/api/admin/stats`            | Dashboard statistics (token required)   |

## Environment Variables (set on Render dashboard)

| Variable          | Description                                 |
|-------------------|---------------------------------------------|
| `DB_HOST`         | Hostinger MySQL host IP                     |
| `DB_PORT`         | MySQL port (3306)                           |
| `DB_NAME`         | Database name                               |
| `DB_USER`         | Database username                           |
| `DB_PASSWORD`     | Database password                           |
| `ADMIN_SECRET_KEY`| Token for admin moderation endpoints        |
| `CORS_ORIGINS`    | Comma-separated list of allowed frontend origins |
| `ENVIRONMENT`     | `production` or `development`               |

## Deployment (Render)

See the deployment guide in the project documentation.
Root directory for Render: `backend/`
Build command: `pip install -r requirements.txt`
Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

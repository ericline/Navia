"""Navia API entry point — FastAPI app setup, CORS, and router registration."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

from sqlalchemy import inspect, text

from database import Base, engine
from routers import trips, days, activities, auth, ai

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)


def _ensure_new_columns():
    """Idempotent ALTER TABLE ADD COLUMN for fields added after initial deploy.
    SQLAlchemy's create_all only creates missing tables, not missing columns."""
    insp = inspect(engine)
    additions = [
        ("users", "pref_travel_style", "VARCHAR"),
        ("users", "pref_group_type", "VARCHAR"),
        ("users", "pref_interests", "VARCHAR"),
        ("days", "day_start", "TIME"),
        ("days", "day_end", "TIME"),
        ("activities", "google_place_id", "VARCHAR"),
    ]
    with engine.begin() as conn:
        for table, column, coltype in additions:
            try:
                existing = {c["name"] for c in insp.get_columns(table)}
            except Exception:
                continue
            if column in existing:
                continue
            try:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {coltype}'))
            except Exception:  # noqa: BLE001
                pass


_ensure_new_columns()

app = FastAPI(
    title="Navia API",
    version="0.1.0",
)

_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Navia API is running. Visit /docs for Swagger UI."}

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(days.router)
app.include_router(activities.router)
app.include_router(ai.router)

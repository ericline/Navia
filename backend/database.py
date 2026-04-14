# backend/database.py
"""SQLAlchemy engine, session factory, and declarative base.

Configures connection pooling for PostgreSQL (pool_pre_ping, recycle,
size limits) while leaving SQLite unchanged for local dev and tests.
"""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./navia.db")

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

pool_kwargs: dict = {}
if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    pool_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,   # Recycle connections every 30min to avoid idle-timeout drops
        "pool_pre_ping": True,  # Validate connections before use
    }

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, **pool_kwargs)

# Ensure pgvector extension exists on Postgres before any vector ops run.
# Idempotent — no-op when the extension is already installed.
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    @event.listens_for(engine, "connect")
    def _enable_pgvector(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            dbapi_conn.commit()
        finally:
            cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

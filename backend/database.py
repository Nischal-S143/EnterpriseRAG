"""
Pagani Zonda R – Database Configuration
SQLAlchemy engine, session factory, and Base class.
Supports PostgreSQL (production) and SQLite (local dev fallback).
"""

import os
import logging
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("pagani.database")

# ── Database URL ──
# Priority: DATABASE_URL env var → SQLite fallback
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///" + os.path.join(os.path.dirname(__file__), "pagani.db")
)

# SQLite needs check_same_thread=False for FastAPI
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# ── Engine & Session ──
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session, auto-closes after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session():
    """Context manager for standard DB writes (commits on exit)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_read():
    """Context manager for read-only actions (never commits)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Safe to call multiple times."""
    from models import (  # noqa
        User, ChatHistory, SystemLog, AnalyticsEvent, Document, DocumentVersion, RoleAuditLog,
        Evaluation, AuditLog, ReviewQueue, Feedback, StrategistReport, GoldenAnswer,
    )
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified successfully.")


def check_db_connection() -> bool:
    """Check if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False

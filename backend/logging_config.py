"""
Pagani Zonda R – Structured Logging Configuration
File + console logging with rotation and structured format.
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from concurrent.futures import ThreadPoolExecutor

# ── Log Directory ──
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "app.log")

# ── Formatter ──
LOG_FORMAT = "%(asctime)s | %(name)-28s | %(levelname)-7s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: str = "INFO"):
    """Configure structured logging with file rotation and console output."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers to avoid duplicates on reload
    root_logger.handlers.clear()

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler with rotation (10MB per file, 5 backups)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    logging.getLogger("pagani").info(
        f"Logging initialized | level={level} | file={LOG_FILE}"
    )


# Import moved to top
# Global thread pool for fire-and-forget DB logging
_log_executor = ThreadPoolExecutor(max_workers=2)


def _persist_log_to_db(action: str, user_id: str | None, metadata: dict | None):
    """Internal helper to write a log event to the database (synchronous)."""
    try:
        from database import get_db_session
        from models import SystemLog
        with get_db_session() as db:
            db.add(SystemLog(
                action=action,
                user_id=user_id,
                metadata_=metadata,
            ))
    except Exception:
        # Avoid crashing the logger if DB is unavailable
        pass


def log_event(
    logger_name: str,
    action: str,
    user_id: str | None = None,
    metadata: dict | None = None,
):
    """
    Log a structured event. The database write is completely non-blocking (fire-and-forget).
    """
    log = logging.getLogger(logger_name)
    parts = [f"action={action}"]
    if user_id:
        parts.append(f"user={user_id}")
    if metadata:
        parts.append(f"meta={metadata}")
    log.info(" | ".join(parts))

    # Fire-and-forget: offload database write to the thread pool instantly
    _log_executor.submit(_persist_log_to_db, action, user_id, metadata)

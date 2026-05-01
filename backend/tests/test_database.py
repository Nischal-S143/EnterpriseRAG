import pytest
from database import get_db, engine
from sqlalchemy.orm import Session

def test_get_db_yields_session():
    db_gen = get_db()
    db = next(db_gen)
    try:
        assert isinstance(db, Session)
        assert db.bind == engine
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass

def test_engine_initialization():
    assert engine is not None
    assert str(engine.url).startswith("sqlite") or "postgres" in str(engine.url)

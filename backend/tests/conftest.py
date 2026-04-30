"""
Shared test fixtures for the Enterprise RAG backend tests.
"""

import os
import sys
import pytest

# Ensure backend directory is on the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set test environment variables before importing any backend modules
os.environ["DATABASE_URL"] = "sqlite:///test_enterprise.db"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["GEMINI_API_KEY"] = "test-api-key"
os.environ["DEBUG_MODE"] = "true"
os.environ["TESTING"] = "true"


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create and tear down a test database."""
    from database import init_db
    init_db()
    yield
    # Cleanup
    try:
        from database import engine
        engine.dispose()
        os.remove("test_enterprise.db")
    except (FileNotFoundError, PermissionError) as e:
        import logging
        logging.debug(f"Test DB cleanup skipped: {e}")


@pytest.fixture(scope="session")
def test_client():
    """Create a FastAPI test client with rate limiter disabled."""
    from fastapi.testclient import TestClient
    from main import app

    # Disable rate limiting for tests by replacing the limiter
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address, default_limits=[])
    limiter.enabled = False
    app.state.limiter = limiter

    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def auth_headers(test_client):
    """Register a test user and return auth headers."""
    # Register
    test_client.post("/api/register", json={
        "username": "testuser",
        "password": "TestPass123!",
        "role": "admin",
    })
    # Login
    resp = test_client.post("/api/login", json={
        "username": "testuser",
        "password": "TestPass123!",
    })
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def super_admin_headers(test_client):
    """Register a super_admin user and return auth headers."""
    test_client.post("/api/register", json={
        "username": "superadmin",
        "password": "SuperPass123!",
        "role": "super_admin",
    })
    resp = test_client.post("/api/login", json={
        "username": "superadmin",
        "password": "SuperPass123!",
    })
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def viewer_headers(test_client):
    """Register a viewer user and return auth headers."""
    test_client.post("/api/register", json={
        "username": "testviewer",
        "password": "ViewerPass123!",
        "role": "viewer",
    })
    resp = test_client.post("/api/login", json={
        "username": "testviewer",
        "password": "ViewerPass123!",
    })
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}

import pytest
from fastapi import status
import uuid

def test_register_success(test_client):
    """Test successful user registration."""
    username = f"user_{uuid.uuid4().hex[:8]}"
    response = test_client.post("/api/register", json={
        "username": username,
        "password": "Password123!",
        "role": "viewer"
    })
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["username"] == username

def test_register_duplicate(test_client):
    """Test registration with an existing username."""
    username = f"dup_{uuid.uuid4().hex[:8]}"
    # First registration
    test_client.post("/api/register", json={
        "username": username,
        "password": "Password123!",
        "role": "viewer"
    })
    # Second registration with same username
    response = test_client.post("/api/register", json={
        "username": username,
        "password": "Password123!",
        "role": "viewer"
    })
    assert response.status_code == status.HTTP_409_CONFLICT

def test_login_success(test_client):
    """Test successful login."""
    username = f"login_{uuid.uuid4().hex[:8]}"
    test_client.post("/api/register", json={
        "username": username,
        "password": "LoginPass123!",
        "role": "viewer"
    })
    
    response = test_client.post("/api/login", json={
        "username": username,
        "password": "LoginPass123!"
    })
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()

def test_token_refresh(test_client):
    """Test refreshing an access token."""
    username = f"refresh_{uuid.uuid4().hex[:8]}"
    test_client.post("/api/register", json={
        "username": username,
        "password": "RefreshPass123!",
        "role": "viewer"
    })
    
    login_resp = test_client.post("/api/login", json={
        "username": username,
        "password": "RefreshPass123!"
    })
    data = login_resp.json()
    refresh_token = data["refresh_token"]
    
    response = test_client.post("/api/refresh", json={
        "refresh_token": refresh_token
    })
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()

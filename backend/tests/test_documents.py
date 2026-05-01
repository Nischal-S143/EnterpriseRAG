import pytest
from fastapi import status
from unittest.mock import patch, MagicMock
import io

@patch("main.vector_store")
def test_upload_document_admin(mock_vs, test_client, auth_headers):
    """Test that an admin can upload a document."""
    file_content = b"This is a test document about the Pagani Zonda R."
    file = io.BytesIO(file_content)
    
    response = test_client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", file, "text/plain")},
        headers=auth_headers
    )
    
    # The endpoint returns 200 OK by default
    assert response.status_code == status.HTTP_200_OK
    assert "uploaded successfully" in response.json()["message"].lower()

def test_upload_document_viewer_denied(test_client, viewer_headers):
    """Test that a viewer cannot upload documents."""
    file = io.BytesIO(b"Unauthorized content")
    response = test_client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", file, "text/plain")},
        headers=viewer_headers
    )
    # viewers don't have manage_users permission required for upload
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_list_documents(test_client, auth_headers):
    """Test listing documents."""
    response = test_client.get("/api/v1/documents", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "documents" in data or isinstance(data, list)

@patch("main.vector_store")
def test_delete_document_admin(mock_vs, test_client, auth_headers):
    """Test deleting a document as admin."""
    mock_vs.delete_document.return_value = True
    
    response = test_client.delete(
        "/api/v1/documents/test_doc_id",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert "deleted" in response.json()["message"].lower()

def test_delete_document_viewer_denied(test_client, viewer_headers):
    """Test that a viewer cannot delete documents."""
    response = test_client.delete(
        "/api/v1/documents/test_doc_id",
        headers=viewer_headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN

@patch("main.vector_store")
def test_document_versioning(mock_vs, test_client, auth_headers):
    """Test full document versioning flow: upload -> re-upload -> list -> restore."""
    # 1. Upload initial version
    filename = "version_test.txt"
    content1 = b"Version 1 content"
    response = test_client.post(
        "/api/v1/documents/upload",
        files={"file": (filename, io.BytesIO(content1), "text/plain")},
        headers=auth_headers
    )
    assert response.status_code == 200
    doc_id = response.json()["id"]
    assert response.json()["version"] == 1

    # 2. Upload version 2
    content2 = b"Version 2 content"
    response = test_client.post(
        "/api/v1/documents/upload",
        files={"file": (filename, io.BytesIO(content2), "text/plain")},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["version"] == 2

    # 3. List versions
    response = test_client.get(f"/api/v1/documents/{doc_id}/versions", headers=auth_headers)
    assert response.status_code == 200
    versions = response.json()["versions"]
    assert len(versions) == 2
    assert versions[0]["version_number"] == 2
    assert versions[1]["version_number"] == 1

    # 4. Restore version 1
    # Mocking os.path.exists to true for the restored file
    with patch("os.path.exists", return_value=True), patch("builtins.open", MagicMock(return_value=io.BytesIO(content1))):
        response = test_client.post(f"/api/v1/documents/{doc_id}/restore/1", headers=auth_headers)
        assert response.status_code == 200
        assert "restored to version 1" in response.json()["message"].lower()

    # 5. Verify document state in DB
    response = test_client.get("/api/v1/documents", headers=auth_headers)
    docs = response.json()["documents"]
    test_doc = next(d for d in docs if d["id"] == doc_id)
    assert test_doc["version"] == "1"


import os
import sys
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock dependencies before importing main
sys.modules["database"] = MagicMock()
sys.modules["models"] = MagicMock()
sys.modules["auth"] = MagicMock()
sys.modules["vector_store"] = MagicMock()

import main
from main import v1_get_document_content, Document

async def test_v1_get_document_content():
    mock_db = MagicMock()
    
    # Test 1: Document in DB
    mock_doc = MagicMock()
    mock_doc.id = "uuid-123"
    mock_doc.filename = "test.txt"
    mock_doc.file_path = "backend/data/test.txt"
    
    # Create the test file
    os.makedirs("backend/data", exist_ok=True)
    with open(mock_doc.file_path, "w") as f:
        f.write("Hello from DB file")
        
    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc
    
    result = await v1_get_document_content("uuid-123", db=mock_db, current_user={})
    print(f"DB Test Result: {result}")
    assert result["content"] == "Hello from DB file"
    
    # Test 2: Document not in DB, but in Vector Store
    mock_db.query.return_value.filter.return_value.first.return_value = None
    main.vector_store.get_document.return_value = {
        "content": "Hello from Vector Store",
        "filename": "VS Doc"
    }
    
    result = await v1_get_document_content("vs-0", db=mock_db, current_user={})
    print(f"VS Test Result: {result}")
    assert result["content"] == "Hello from Vector Store"
    
    # Test 3: Document found nowhere
    main.vector_store.get_document.return_value = None
    try:
        await v1_get_document_content("none", db=mock_db, current_user={})
    except Exception as e:
        print(f"Not Found Test Result (Exception): {e.detail}")
        assert e.status_code == 404
        assert e.detail == "Document not found"

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_v1_get_document_content())

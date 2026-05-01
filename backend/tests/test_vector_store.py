import pytest
from unittest.mock import patch, MagicMock
import numpy as np
from vector_store import VectorStore


@pytest.fixture
def store():
    """Create a fresh vector store for each test."""
    with patch("vector_store.genai.configure"):
        s = VectorStore()
        # Mock index and embeddings to avoid initialization logic
        s.index = MagicMock()
        s.embeddings = np.array([[0.1] * 768], dtype=np.float32)
        s.dimension = 768
        s._initialized = True
        return s


def test_embed_query(store):
    """Test embedding a single query."""
    mock_result = {"embedding": [0.1] * 768}
    with patch("vector_store.genai.embed_content", return_value=mock_result):
        emb = store._embed_query("test query")
        assert emb.shape == (1, 768)
        assert emb[0][0] == pytest.approx(0.1)


def test_search_basic(store):
    """Test the basic search flow with mocked components."""
    # Mock embedding
    store._embed_query = MagicMock(return_value=np.array([[0.1] * 768], dtype=np.float32))

    # Mock FAISS search with correct numpy types
    # FAISS search returns (distances, indices)
    store.index.search.return_value = (
        np.array([[0.9]], dtype=np.float32),
        np.array([[0]], dtype=np.int64)
    )
    store.index.ntotal = 1

    # Mock LLM rerank
    with patch.object(store, "_llm_rerank") as mock_rerank:
        mock_rerank.return_value = [{"doc": store.documents[0], "score": 95.0}]

        results = store.search("Who built Zonda?", user_role="admin")
        assert len(results) == 1
        assert results[0]["score"] == 95.0
        assert "Pagani" in results[0]["content"]


def test_role_filtering(store):
    """Test that role-based filtering works."""
    # Add a document that only admins can see
    store.documents = [
        {"content": "Secret doc", "role_access": ["admin"], "source": "s1"}
    ]
    store.index.ntotal = 1
    store.index.search.return_value = (
        np.array([[0.9]], dtype=np.float32),
        np.array([[0]], dtype=np.int64)
    )
    store._embed_query = MagicMock(return_value=np.array([[0.1] * 768], dtype=np.float32))

    # Search as viewer
    with patch.object(store, "_llm_rerank", side_effect=lambda q, c, **kwargs: c):
        results = store.search("secret", user_role="viewer")
        assert len(results) == 0

        # Search as admin
        results = store.search("secret", user_role="admin")
        assert len(results) == 1


def test_get_document(store):
    """Test retrieving a full document."""
    with patch.object(store, "_find_pdf_path", return_value=None):
        doc = store.get_document("0")
        assert doc is not None
        assert "Pagani" in doc["content"]
        assert doc["id"] == "0"

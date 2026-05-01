import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import rag_pipeline
from rag_pipeline import Planner, ToolExecution, ConditionalRouter, generate_response, _add_to_history, _get_history
import numpy as np

@pytest.mark.asyncio
async def test_history_helpers():
    """Test chat history management."""
    username = "history_user"
    _add_to_history(username, "Question 1", "Answer 1")
    history = _get_history(username)
    assert len(history) == 2
    assert history[0]["content"] == "Question 1"
    assert history[1]["content"] == "Answer 1"

@pytest.mark.asyncio
async def test_planner_complex():
    """Test the planner with a complex multi-hop result."""
    planner = Planner()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content='{"strategy": "multi_hop", "sub_queries": ["q1", "q2"], "complexity": "high"}'))
    ]
    
    with patch("rag_pipeline._gemini_call_with_retry", AsyncMock(return_value=mock_response)):
        plan = await planner.plan("Complex query")
        assert plan["strategy"] == "multi_hop"
        assert len(plan["sub_queries"]) == 2

@pytest.mark.asyncio
async def test_tool_execution_multi_hop():
    """Test multi-hop search execution."""
    mock_vs = MagicMock()
    mock_vs.documents = [{"content": "Doc", "source": "s", "chunk_id": "1"}]
    mock_vs.index.ntotal = 1
    mock_vs.index.search.return_value = (np.array([[0.9]]), np.array([[0]]))
    mock_vs.bm25_index.get_scores.return_value = np.array([0.5])
    
    executor = ToolExecution(mock_vs)
    plan = {"strategy": "multi_hop", "sub_queries": ["q1", "q2"]}
    
    with patch.object(executor, "_embed_query", AsyncMock(return_value=np.array([0.1]*1536))):
        results = await executor.execute(plan, "Complex query")
        assert len(results) > 0

@pytest.mark.asyncio
async def test_agentic_router():
    """Test the agentic router logic."""
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content='{"needs_search": true, "search_query": "optimized query"}'))
    ]
    
    with patch("rag_pipeline._gemini_call_with_retry", AsyncMock(return_value=mock_response)):
        result = await rag_pipeline.agentic_router("original query", [])
        assert result["needs_search"] is True
        assert result["search_query"] == "optimized query"

@pytest.mark.asyncio
async def test_conditional_router_low_confidence():
    """Test routing to human validation on zero confidence."""
    router = ConditionalRouter()
    route = await router.route([])
    assert route["decision"] == "human_validation"
    assert route["confidence"] == 0.0

@pytest.mark.asyncio
async def test_generate_response_stream():
    """Test streaming response generation."""
    async def mock_stream():
        yield MagicMock(choices=[MagicMock(delta=MagicMock(delta=MagicMock(content="Part 1")))]) # Mocking the complex delta structure
        yield MagicMock(choices=[MagicMock(delta=MagicMock(delta=MagicMock(content=" Part 2")))])

    # Adjusting the mock to match the structure in generate_response_stream
    async def mock_stream_simple():
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content="Part 1"))])
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content=" Part 2"))])

    with patch("rag_pipeline._gemini_call_with_retry", AsyncMock(return_value=mock_stream_simple())):
        chunks = []
        async for part in rag_pipeline.generate_response_stream("query", [], username="stream_user"):
            chunks.append(part)
        
        assert "".join(chunks) == "Part 1 Part 2"

def test_build_prompt():
    """Test prompt construction with context and history."""
    context = [{"content": "Context info", "source": "src1", "score": 90.0}]
    history = [{"role": "user", "content": "hi"}]
    prompt = rag_pipeline._build_prompt(context, "viewer", history, "question")
    assert "Context info" in prompt
    assert "User: hi" in prompt
    assert "question" in prompt

def test_assess_confidence():
    """Test confidence assessment logic."""
    high = rag_pipeline._assess_confidence([{"score": 90.0}])
    assert high["label"] == "high"
    low = rag_pipeline._assess_confidence([{"score": 20.0}])
    assert low["label"] == "low"
    none = rag_pipeline._assess_confidence([])
    assert none["label"] == "low" or none["label"] == "N/A"

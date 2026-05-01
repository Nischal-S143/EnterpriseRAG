import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import asyncio
from multi_agent import RetrieverAgent, SynthesisAgent, run_multi_agent, run_single_agent

@pytest.mark.asyncio
async def test_retriever_agent_deduplication():
    agent = RetrieverAgent()
    state = {
        "retrieved_docs": [
            {"chunk_id": "1", "score": 90.0, "text": "a"},
            {"chunk_id": "1", "score": 85.0, "text": "a"},
            {"chunk_id": "2", "score": 80.0, "text": "b"}
        ]
    }
    new_state = await agent.execute(state)
    assert len(new_state["retrieved_docs"]) == 2
    assert new_state["retrieved_docs"][0]["chunk_id"] == "1"

@pytest.mark.asyncio
async def test_synthesis_agent_success():
    agent = SynthesisAgent()
    state = {
        "query": "test?",
        "retrieved_docs": [{"content": "info", "source": "src1"}]
    }
    
    async def mock_stream():
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content="Final answer"))])

    with patch("multi_agent._gemini_call_with_retry", AsyncMock(return_value=mock_stream())):
        new_state = await agent.execute(state)
        assert "Final answer" in new_state["final_response"]

@pytest.mark.asyncio
async def test_run_multi_agent():
    sse_queue = asyncio.Queue()
    state_meta = {"format": "standard"}
    chunks = [{"content": "info", "source": "src1", "score": 90.0}]
    
    async def mock_stream():
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content="Final answer"))])

    with patch("multi_agent._gemini_call_with_retry", AsyncMock(return_value=mock_stream())):
        result = await run_multi_agent("query", chunks, state_meta, sse_queue)
        assert "Final answer" in result["final_response"]
        assert len(result["retrieved_docs"]) == 1

@pytest.mark.asyncio
async def test_run_single_agent():
    sse_queue = asyncio.Queue()
    chunks = [{"content": "info", "source": "src1"}]
    
    async def mock_stream():
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content="Single answer"))])

    with patch("multi_agent._gemini_call_with_retry", AsyncMock(return_value=mock_stream())):
        result = await run_single_agent("query", chunks, sse_queue)
        assert "Single answer" in result["final_response"]

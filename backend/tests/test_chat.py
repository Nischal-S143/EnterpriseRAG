from unittest.mock import patch
from fastapi import status


@patch("rag_pipeline.Planner.plan")
@patch("rag_pipeline.ToolExecution.execute")
@patch("rag_pipeline.ConditionalRouter.route")
@patch("multi_agent.run_single_agent")
def test_chat_sse_success(mock_single, mock_route, mock_exec, mock_plan, test_client, auth_headers):
    """Test successful chat SSE request with mocked pipeline steps."""
    mock_plan.return_value = {"strategy": "simple", "sub_queries": ["test"]}
    mock_exec.return_value = [{"content": "context", "source": "src1", "score": 90.0}]
    mock_route.return_value = {"decision": "single_agent", "confidence": 0.9}
    mock_single.return_value = {"final_response": "Mocked AI answer"}

    response = test_client.post(
        "/api/v1/chat/sse",
        json={"question": "What is the Zonda R?", "format": "default"},
        headers=auth_headers
    )

    assert response.status_code == status.HTTP_200_OK
    assert "text/event-stream" in response.headers["content-type"]
    # Verify events are emitted
    assert "Mocked AI answer" in response.text
    assert "event: done" in response.text


def test_chat_unauthorized(test_client):
    """Test that chat endpoint requires authentication."""
    response = test_client.post(
        "/api/v1/chat/sse",
        json={"question": "Unauthorized query"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_chat_empty_query(test_client, auth_headers):
    """Test chat with empty query."""
    response = test_client.post(
        "/api/v1/chat/sse",
        json={"question": ""},
        headers=auth_headers
    )
    # Pydantic validation (min_length=3 in ChatRequest)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@patch("rag_pipeline.Planner.plan")
def test_chat_error_handling(mock_plan, test_client, auth_headers):
    """Test chat behavior when pipeline raises an exception."""
    mock_plan.side_effect = Exception("Pipeline crash")

    response = test_client.post(
        "/api/v1/chat/sse",
        json={"question": "Crash me"},
        headers=auth_headers
    )
    # The SSE endpoint catches errors and sends an 'error' event, but the request itself might still return 200
    # because it's a streaming response.
    assert response.status_code == status.HTTP_200_OK
    assert "event: error" in response.text
    assert "Pipeline crash" in response.text

from unittest.mock import patch, MagicMock
from evaluator import IRMetrics, LatencyCostTracker, LLMJudge, Evaluator


def test_ir_metrics_compute():
    retrieved = ["1", "2", "3"]
    relevant = ["2", "3", "4"]
    # 2 true positives: "2", "3"
    # precision = 2/3 = 0.6667
    # recall = 2/3 = 0.6667
    metrics = IRMetrics.compute(retrieved, relevant)
    assert metrics["precision"] == 0.6667
    assert metrics["recall"] == 0.6667
    assert metrics["f1"] == 0.6667


def test_latency_cost_tracker():
    tracker = LatencyCostTracker()
    tracker.start()
    # No sleep needed, just check cost calculation
    data = tracker.stop(input_tokens=1000, output_tokens=1000)
    assert data["input_tokens"] == 1000
    assert data["estimated_cost_usd"] > 0
    assert "latency_seconds" in data


@patch("evaluator.client.chat.completions.create")
def test_llm_judge_score(mock_create):
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content='{"relevance": 9, "faithfulness": 8, "completeness": 9, "overall": 9, "reasoning": "Good"}'))
    ]
    mock_create.return_value = mock_response

    judge = LLMJudge()
    scores = judge.score("query", "response")
    assert scores["overall"] == 9
    assert scores["reasoning"] == "Good"


@patch.object(Evaluator, "_store_result")
@patch("evaluator.client.chat.completions.create")
def test_evaluator_full(mock_create, mock_store):
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content='{"relevance": 10, "faithfulness": 10, "completeness": 10, "overall": 10, "reasoning": "Perfect"}'))
    ]
    mock_create.return_value = mock_response

    evaluator = Evaluator()
    result = evaluator.evaluate(
        query="test query",
        response="test response",
        retrieved_ids=["1"],
        relevant_ids=["1"],
        latency_seconds=1.5
    )

    assert result["llm_judge"]["overall"] == 10
    assert result["ir_metrics"]["precision"] == 1.0
    assert result["cost_tracking"]["latency_seconds"] == 1.5
    assert mock_store.called

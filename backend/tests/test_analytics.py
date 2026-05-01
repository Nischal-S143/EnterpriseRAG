import pytest
from analytics import set_server_start_time, get_user_engagement_metrics
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

def test_set_server_start_time():
    t = datetime.now(timezone.utc)
    set_server_start_time(t)
    from analytics import _server_start_time
    assert _server_start_time == t

@patch("database.get_db_session")
def test_get_user_engagement_metrics(mock_db_session):
    mock_db = MagicMock()
    mock_db_session.return_value.__enter__.return_value = mock_db
    
    # Mock query results to return 10 for scalars
    mock_query = mock_db.query.return_value
    mock_query.filter.return_value.scalar.return_value = 10
    
    # For the breakdown (all())
    mock_query.filter.return_value.group_by.return_value.all.return_value = [("chat_started", 5)]
    
    metrics = get_user_engagement_metrics(days=7)
    
    if "error" in metrics:
        pytest.fail(f"Engagement metrics failed with error: {metrics['error']}")
        
    assert metrics["total_events"] == 10
    assert metrics["unique_active_users"] == 10
    assert metrics["event_breakdown"]["chat_started"] == 5

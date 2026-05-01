import pytest
from unittest.mock import patch, MagicMock
from audit import AuditLogger

@patch("database.get_db_session")
def test_audit_log(mock_db_session, caplog):
    mock_db = MagicMock()
    mock_db_session.return_value.__enter__.return_value = mock_db
    
    AuditLogger.log("test_action", user_id="test_user", metadata={"foo": "bar"})
    
    # Check logger output
    assert "AUDIT | action=test_action" in caplog.text
    
    # Check DB call
    assert mock_db.add.called
    log_obj = mock_db.add.call_args[0][0]
    assert log_obj.action == "test_action"
    assert log_obj.user_id == "test_user"
    assert log_obj.metadata_ == {"foo": "bar"}

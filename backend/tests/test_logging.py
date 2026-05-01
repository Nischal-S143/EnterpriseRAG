import pytest
import logging
from logging_config import setup_logging, log_event

def test_setup_logging():
    setup_logging("DEBUG")
    root_logger = logging.getLogger()
    assert root_logger.level == logging.DEBUG
    assert len(root_logger.handlers) >= 1

def test_log_event(caplog):
    with caplog.at_level(logging.INFO):
        log_event("test.logger", "test_action", user_id="test_user", metadata={"key": "val"})
        assert "action=test_action" in caplog.text
        assert "user=test_user" in caplog.text
        assert "meta={'key': 'val'}" in caplog.text

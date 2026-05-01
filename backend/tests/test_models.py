import pytest
from models import User, ChatHistory, SystemLog, AnalyticsEvent, Document, Evaluation, GoldenAnswer, Feedback, StrategistReport
from datetime import datetime

def test_user_model():
    user = User(name="test", email="test@example.com", password_hash="hash", role="admin")
    assert user.name == "test"
    assert user.role == "admin"
    assert "User" in str(user)

def test_chat_history_model():
    chat = ChatHistory(user_id="u1", question="q", response="r")
    assert chat.question == "q"
    assert chat.response == "r"
    assert "ChatHistory" in str(chat)

def test_system_log_model():
    log = SystemLog(action="act", user_id="u1", metadata_={"k": "v"})
    assert log.action == "act"
    assert log.metadata_ == {"k": "v"}
    assert "SystemLog" in str(log)

def test_analytics_event_model():
    event = AnalyticsEvent(event_type="click", user_id="u1")
    assert event.event_type == "click"
    assert "AnalyticsEvent" in str(event)

def test_document_model():
    doc = Document(filename="test.pdf", file_type="pdf", uploaded_by="admin")
    assert doc.filename == "test.pdf"

def test_evaluation_model():
    eval_res = Evaluation(query="q", overall=0.9, reasoning="Good")
    assert eval_res.query == "q"
    assert eval_res.overall == 0.9

def test_golden_answer_model():
    # Corrected field names
    golden = GoldenAnswer(query="q", expected_answer="a", tags=["test"])
    assert golden.query == "q"
    assert golden.tags == ["test"]
    assert "GoldenAnswer" in str(golden)

def test_feedback_model():
    fb = Feedback(query="q", rating=5, comment="cool")
    assert fb.rating == 5
    assert "Feedback" in str(fb)

def test_strategist_report_model():
    rep = StrategistReport(report="report text", analyzed_count=100)
    assert rep.analyzed_count == 100
    assert "StrategistReport" in str(rep)

"""
Pagani Zonda R – Database Models
SQLAlchemy ORM models for Users, ChatHistory, SystemLogs, and Analytics.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Float, Integer
from sqlalchemy.orm import relationship

from database import Base


def _generate_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    name = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    system_logs = relationship("SystemLog", back_populates="user", cascade="all, delete-orphan")
    analytics_events = relationship(
        "AnalyticsEvent",
        back_populates="user",
        cascade="all, delete-orphan")
    analytics_sessions = relationship(
        "AnalyticsSession",
        back_populates="user",
        cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(name='{self.name}', role='{self.role}')>"


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="chat_history")

    def __repr__(self):
        return f"<ChatHistory(user_id='{self.user_id}', q='{self.question[:40]}...')>"


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    action = Column(String(100), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="system_logs")

    def __repr__(self):
        return f"<SystemLog(action='{self.action}', user_id='{self.user_id}')>"


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    event_type = Column(String(100), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="analytics_events")

    def __repr__(self):
        return f"<AnalyticsEvent(event_type='{self.event_type}')>"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(10), nullable=False)
    file_size = Column(String(20), nullable=True)
    file_path = Column(String(500), nullable=True)
    uploaded_by = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    classification = Column(String(50), nullable=True)
    version = Column(String(10), nullable=False, default="1")
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    def __repr__(self):
        return f"<Document(filename='{self.filename}', uploaded_by='{self.uploaded_by}')>"


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=True)  # SHA-256 hash of file content
    file_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    created_by = Column(String(50), nullable=False)

    # Use string-based reference to avoid circular dependency if models are split
    document = relationship("Document", backref="versions")


class RoleAuditLog(Base):
    __tablename__ = "role_audit_logs"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    changed_by = Column(String(50), nullable=False, index=True)
    target_user = Column(String(50), nullable=False, index=True)
    old_role = Column(String(20), nullable=False)
    new_role = Column(String(20), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    def __repr__(self):
        return f"<RoleAuditLog(target='{self.target_user}', {self.old_role}->{self.new_role})>"


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    query = Column(Text, nullable=False)
    response_snippet = Column(Text, nullable=True)
    relevance = Column(Float, nullable=True)
    faithfulness = Column(Float, nullable=True)
    completeness = Column(Float, nullable=True)
    overall = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    latency_ms = Column(Float, nullable=True)
    estimated_cost_usd = Column(Float, nullable=True)
    reasoning = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)

    def __repr__(self):
        return f"<Evaluation(query='{self.query[:40]}...', overall={self.overall})>"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    action = Column(String(100), nullable=False, index=True)
    user_id = Column(String(50), nullable=True, index=True)
    details = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    def __repr__(self):
        return f"<AuditLog(action='{self.action}', user='{self.user_id}')>"


class ReviewQueue(Base):
    __tablename__ = "review_queue"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    username = Column(String(50), nullable=False, index=True)
    question = Column(Text, nullable=False)
    reason = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="pending_review", index=True)
    confidence = Column(Float, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<ReviewQueue(user='{self.username}', status='{self.status}')>"


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    user_id = Column(String(50), nullable=True, index=True)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)

    def __repr__(self):
        return f"<Feedback(user='{self.user_id}', rating={self.rating})>"


class StrategistReport(Base):
    __tablename__ = "strategist_reports"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    report = Column(Text, nullable=False)
    analyzed_count = Column(Integer, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)

    def __repr__(self):
        return f"<StrategistReport(analyzed={self.analyzed_count})>"


class GoldenAnswer(Base):
    __tablename__ = "golden_answers"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    query = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=False)
    relevant_chunk_ids = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    def __repr__(self):
        return f"<GoldenAnswer(query='{self.query[:40]}...')>"


class AnalyticsSession(Base):
    __tablename__ = "analytics_sessions"

    id = Column(String(36), primary_key=True, default=_generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="analytics_sessions")

    def __repr__(self):
        return f"<AnalyticsSession(user_id='{self.user_id}', duration={self.duration_seconds})>"

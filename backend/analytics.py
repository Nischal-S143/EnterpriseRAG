"""
Pagani Zonda R – Enterprise Analytics
Compute engagement metrics, query stats, AI performance, and system health.
"""

import logging
import platform
import asyncio
import json
import os
from openai import OpenAI
from dotenv import load_dotenv
from audit import Auditor
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger("pagani.analytics")

# ── Server start time (set from main.py) ──
_server_start_time: Optional[datetime] = None


def set_server_start_time(t: datetime):
    global _server_start_time
    _server_start_time = t


def get_user_engagement_metrics(days: int = 30) -> dict:
    """Aggregate user engagement from AnalyticsEvent table."""
    try:
        from database import get_db_session
        from models import AnalyticsEvent, User
        from sqlalchemy import func

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        with get_db_session() as db:
            total_events = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.timestamp >= cutoff
            ).scalar() or 0

            unique_users = db.query(func.count(func.distinct(AnalyticsEvent.user_id))).filter(
                AnalyticsEvent.timestamp >= cutoff
            ).scalar() or 0

            total_chats = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "chat_started",
                AnalyticsEvent.timestamp >= cutoff,
            ).scalar() or 0

            total_logins = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "login_success",
                AnalyticsEvent.timestamp >= cutoff,
            ).scalar() or 0

            total_registrations = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "user_registered",
                AnalyticsEvent.timestamp >= cutoff,
            ).scalar() or 0

            total_users = db.query(func.count(User.id)).scalar() or 0

            # Events by type
            event_breakdown = db.query(
                AnalyticsEvent.event_type,
                func.count(AnalyticsEvent.id)
            ).filter(
                AnalyticsEvent.timestamp >= cutoff
            ).group_by(AnalyticsEvent.event_type).all()

            return {
                "period_days": days,
                "total_events": total_events,
                "unique_active_users": unique_users,
                "total_users": total_users,
                "total_chats": total_chats,
                "total_logins": total_logins,
                "total_registrations": total_registrations,
                "event_breakdown": {row[0]: row[1] for row in event_breakdown},
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as e:
        logger.error(f"Failed to compute engagement metrics: {e}")
        return {"error": str(e)}


def get_query_success_rates(days: int = 30) -> dict:
    """Compute query success/failure rates from analytics events."""
    try:
        from database import get_db_session
        from models import AnalyticsEvent
        from sqlalchemy import func

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        with get_db_session() as db:
            total_queries = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "query_submitted",
                AnalyticsEvent.timestamp >= cutoff,
            ).scalar() or 0

            successful = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "response_received",
                AnalyticsEvent.timestamp >= cutoff,
            ).scalar() or 0

            failed = total_queries - successful if total_queries > successful else 0

            return {
                "period_days": days,
                "total_queries": total_queries,
                "successful": successful,
                "failed": failed,
                "success_rate": round(successful / total_queries, 3) if total_queries > 0 else 0.0,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as e:
        logger.error(f"Failed to compute query rates: {e}")
        return {"error": str(e)}


def get_ai_performance_metrics(days: int = 30) -> dict:
    """Compute AI performance metrics from analytics events."""
    try:
        from database import get_db_session
        from models import AnalyticsEvent

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        with get_db_session() as db:
            # Get response events with metadata
            events = db.query(AnalyticsEvent).filter(
                AnalyticsEvent.event_type == "response_received",
                AnalyticsEvent.timestamp >= cutoff,
            ).all()

            confidences = []
            latencies = []
            for ev in events:
                if ev.metadata_:
                    if "confidence" in ev.metadata_:
                        conf = ev.metadata_["confidence"]
                        if isinstance(conf, (int, float)):
                            confidences.append(conf)
                        elif conf == "high":
                            confidences.append(90)
                        elif conf == "medium":
                            confidences.append(60)
                        elif conf == "low":
                            confidences.append(30)
                    if "latency_s" in ev.metadata_:
                        latencies.append(ev.metadata_["latency_s"])

            return {
                "period_days": days,
                "total_responses": len(events),
                "confidence": {
                    "avg": round(sum(confidences) / len(confidences), 1) if confidences else 0,
                    "high_count": sum(1 for c in confidences if c >= 70),
                    "medium_count": sum(1 for c in confidences if 40 <= c < 70),
                    "low_count": sum(1 for c in confidences if c < 40),
                },
                "latency": {
                    "avg_s": round(sum(latencies) / len(latencies), 2) if latencies else 0,
                    "min_s": round(min(latencies), 2) if latencies else 0,
                    "max_s": round(max(latencies), 2) if latencies else 0,
                },
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as e:
        logger.error(f"Failed to compute AI performance metrics: {e}")
        return {"error": str(e)}


def get_system_health() -> dict:
    """Compute system health metrics."""
    health = {
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Uptime
    if _server_start_time:
        uptime = (datetime.now(timezone.utc) - _server_start_time).total_seconds()
        health["uptime_seconds"] = round(uptime, 0)
        health["uptime_human"] = _format_uptime(uptime)

    # System metrics (psutil optional)
    try:
        import psutil
        health["cpu_percent"] = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        health["memory"] = {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "percent": mem.percent,
        }
        disk = psutil.disk_usage("/")
        health["disk"] = {
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "percent": round(disk.percent, 1),
        }
    except ImportError:
        health["system_metrics"] = "psutil not installed — install for CPU/memory metrics"
    except Exception as e:
        health["system_metrics_error"] = str(e)

    return health


def _format_uptime(seconds: float) -> str:
    """Convert seconds to human-readable uptime string."""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def export_analytics_csv(days: int = 30) -> str:
    """Export analytics as CSV string."""
    import csv
    import io

    try:
        from database import get_db_session
        from models import AnalyticsEvent

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        with get_db_session() as db:
            events = db.query(AnalyticsEvent).filter(
                AnalyticsEvent.timestamp >= cutoff
            ).order_by(AnalyticsEvent.timestamp.desc()).all()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["id", "event_type", "user_id", "metadata", "timestamp"])
            for ev in events:
                writer.writerow([
                    ev.id,
                    ev.event_type,
                    ev.user_id or "",
                    str(ev.metadata_) if ev.metadata_ else "",
                    ev.timestamp.isoformat() if ev.timestamp else "",
                ])
            return output.getvalue()
    except Exception as e:
        logger.error(f"Failed to export analytics: {e}")
        return f"Error: {e}"


def track_session_start(user_id: str):
    """Record the start of a user session."""
    try:
        from database import get_db_session
        from models import User, AnalyticsSession
        with get_db_session() as db:
            user = db.query(User).filter(User.name == user_id).first()
            if user:
                # Close any existing open sessions for this user
                open_sessions = db.query(AnalyticsSession).filter(
                    AnalyticsSession.user_id == user.id,
                    AnalyticsSession.end_time == None
                ).all()
                for s in open_sessions:
                    s.end_time = datetime.now(timezone.utc)
                    s.duration_seconds = int((s.end_time - s.start_time).total_seconds())

                db.add(AnalyticsSession(user_id=user.id))
    except Exception as e:
        logger.warning(f"Failed to track session start: {e}")


def track_session_end(user_id: str):
    """Record the end of a user session."""
    try:
        from database import get_db_session
        from models import User, AnalyticsSession
        with get_db_session() as db:
            user = db.query(User).filter(User.name == user_id).first()
            if user:
                latest = db.query(AnalyticsSession).filter(
                    AnalyticsSession.user_id == user.id,
                    AnalyticsSession.end_time == None
                ).order_by(AnalyticsSession.start_time.desc()).first()
                if latest:
                    latest.end_time = datetime.now(timezone.utc)
                    latest.duration_seconds = int((latest.end_time - latest.start_time).total_seconds())
    except Exception as e:
        logger.warning(f"Failed to track session end: {e}")


def get_analytics_summary(days: int = 7) -> dict:
    """Aggregate detailed metrics for the admin dashboard."""
    try:
        from database import get_db_session
        from models import AnalyticsEvent, AnalyticsSession
        from sqlalchemy import func
        from collections import Counter

        now = datetime.now(timezone.utc)
        cutoff_7d = now - timedelta(days=days)
        cutoff_24h = now - timedelta(hours=24)

        with get_db_session() as db:
            # 1. Top 5 documents
            events = db.query(AnalyticsEvent).filter(
                AnalyticsEvent.event_type == "response_received",
                AnalyticsEvent.timestamp >= cutoff_7d
            ).all()
            
            doc_counts = Counter()
            for ev in events:
                if ev.metadata_ and "document_ids" in ev.metadata_:
                    for d_id in ev.metadata_["document_ids"]:
                        doc_counts[d_id] += 1
            
            top_docs = [{"id": k, "count": v} for k, v in doc_counts.most_common(5)]

            # 2. Avg Response Time (24h)
            recent_responses = db.query(AnalyticsEvent).filter(
                AnalyticsEvent.event_type == "response_received",
                AnalyticsEvent.timestamp >= cutoff_24h
            ).all()
            
            latencies = []
            for ev in recent_responses:
                if ev.metadata_:
                    # Prefer ttft_ms if available, else latency_s * 1000
                    if "ttft_ms" in ev.metadata_:
                        latencies.append(ev.metadata_["ttft_ms"])
                    elif "latency_s" in ev.metadata_:
                        latencies.append(ev.metadata_["latency_s"] * 1000)
            
            avg_latency = sum(latencies) / len(latencies) if latencies else 0

            # 3. Query volume (7 days)
            query_volume = []
            for i in range(days):
                day_start = (now - timedelta(days=i+1)).replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                count = db.query(func.count(AnalyticsEvent.id)).filter(
                    AnalyticsEvent.event_type == "query_submitted",
                    AnalyticsEvent.timestamp >= day_start,
                    AnalyticsEvent.timestamp < day_end
                ).scalar() or 0
                query_volume.append({"date": day_start.strftime("%m-%d"), "count": count})
            query_volume.reverse()

            # 4. Failed query rate
            total_queries = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "query_submitted",
                AnalyticsEvent.timestamp >= cutoff_7d
            ).scalar() or 0
            
            failed_queries = db.query(func.count(AnalyticsEvent.id)).filter(
                AnalyticsEvent.event_type == "failed_query",
                AnalyticsEvent.timestamp >= cutoff_7d
            ).scalar() or 0
            
            failed_rate = round(failed_queries / total_queries * 100, 1) if total_queries > 0 else 0

            # 5. Session duration (Avg)
            avg_session = db.query(func.avg(AnalyticsSession.duration_seconds)).filter(
                AnalyticsSession.end_time != None,
                AnalyticsSession.start_time >= cutoff_7d
            ).scalar() or 0

            return {
                "top_documents": top_docs,
                "avg_response_time_ms": round(avg_latency, 1),
                "query_volume": query_volume,
                "failed_query_rate": failed_rate,
                "avg_session_duration_s": round(avg_session, 1),
                "generated_at": now.isoformat()
            }
    except Exception as e:
        logger.error(f"Failed to compute analytics summary: {e}")
        return {"error": str(e)}

# ═══════════════════════════════════════════
# Strategist AI Agent
# ═══════════════════════════════════════════

# Imports moved to top

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

api_key = os.getenv("GROQ_API_KEY", "dummy_key") # Groq Key
client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key)

class Strategist:
    """
    Runs every 24 hours.
    Analyzes low-confidence queries using AI.
    Stores reports in database.
    """
    def __init__(self, model_name="llama-3.3-70b-versatile"):
        self.model_name = model_name

    async def start_background_task(self):
        """Starts the 24-hour loop."""
        asyncio.create_task(self.run_daily_analysis())

    async def run_daily_analysis(self):
        while True:
            try:
                self.analyze_low_confidence_queries()
            except Exception as e:
                logger.error(f"Strategist analysis failed: {e}")
            await asyncio.sleep(24 * 60 * 60) # 24 hours

    def analyze_low_confidence_queries(self):
        from database import get_db_session
        from models import ReviewQueue as RQ, StrategistReport
        
        low_conf_queries = []
        with get_db_session() as db:
            pending = db.query(RQ).filter(RQ.status == "pending_review").all()
            low_conf_queries = [p.question for p in pending]
        
        if not low_conf_queries:
            logger.info("Strategist: No low confidence queries to analyze.")
            return "no_queries"

        prompt = f"Analyze these low-confidence or flagged user queries and suggest improvements to the knowledge base or retrieval strategy:\n\n{json.dumps(low_conf_queries, indent=2)}\n\nProvide a structured report."
        
        try:
            response = client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}]
            )
            report = response.choices[0].message.content
            
            with get_db_session() as db:
                # Store report in database
                db.add(StrategistReport(
                    report=report,
                    analyzed_count=len(low_conf_queries)
                ))
                
                # Clear processed
                pending_to_clear = db.query(RQ).filter(RQ.status == "pending_review").all()
                for p in pending_to_clear:
                    p.status = "analyzed"
            
            # Also log to audit for system trail
            Auditor.log(
                action="strategist_daily_report",
                user_id="system_strategist",
                metadata={"analyzed_count": len(low_conf_queries)}
            )
            
            # Clear in-memory as fallback
            from auth import review_queue
            keys_to_delete = [k for k, v in review_queue.items() if v["status"] == "pending_review"]
            for k in keys_to_delete:
                del review_queue[k]
                
            logger.info("Strategist completed daily analysis and stored report.")
            return "success"
        except Exception as e:
            logger.error(f"Strategist Gemini generation failed: {e}")
            raise RuntimeError(f"Report generation failed: {e}")

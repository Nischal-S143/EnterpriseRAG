"""
Pagani Zonda R – WebSocket Connection Manager
Manages WebSocket connections for real-time notifications, live logs, and query updates.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger("pagani.websocket")


class ConnectionManager:
    """Manage active WebSocket connections per channel."""

    def __init__(self):
        # channel -> list of (websocket, user_info)
        self._connections: dict[str, list[tuple[WebSocket, dict]]] = {}

    async def connect(self, websocket: WebSocket, channel: str, user_info: dict | None = None):
        """Accept and register a WebSocket connection to a channel."""
        await websocket.accept()
        if channel not in self._connections:
            self._connections[channel] = []
        self._connections[channel].append((websocket, user_info or {}))
        logger.info(f"WebSocket connected: channel={channel} user={user_info}")

    def disconnect(self, websocket: WebSocket, channel: str):
        """Remove a WebSocket connection from a channel."""
        if channel in self._connections:
            self._connections[channel] = [
                (ws, info) for ws, info in self._connections[channel]
                if ws != websocket
            ]
            if not self._connections[channel]:
                del self._connections[channel]
        logger.info(f"WebSocket disconnected: channel={channel}")

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send WebSocket message: {e}")

    async def broadcast(self, channel: str, message: dict):
        """Broadcast a message to all connections in a channel."""
        if channel not in self._connections:
            return
        disconnected = []
        for ws, info in self._connections[channel]:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        # Clean up disconnected
        for ws in disconnected:
            self.disconnect(ws, channel)

    async def send_notification(
        self,
        channel: str,
        title: str,
        body: str,
        level: str = "info",
        data: Optional[dict] = None,
    ):
        """Send a structured notification to a channel."""
        message = {
            "type": "notification",
            "title": title,
            "body": body,
            "level": level,  # info, warning, error, success
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if data:
            message["data"] = data
        await self.broadcast(channel, message)

    def get_connection_count(self, channel: str | None = None) -> int:
        """Get the number of active connections, optionally for a specific channel."""
        if channel:
            return len(self._connections.get(channel, []))
        return sum(len(conns) for conns in self._connections.values())

    def get_channels(self) -> list[str]:
        """Get list of active channels."""
        return list(self._connections.keys())


# ── Singleton ──
ws_manager = ConnectionManager()

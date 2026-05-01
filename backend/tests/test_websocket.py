import pytest
from unittest.mock import AsyncMock
from websocket_manager import ConnectionManager


@pytest.mark.asyncio
async def test_ws_connect_disconnect():
    manager = ConnectionManager()
    ws = AsyncMock()

    await manager.connect(ws, "test")
    assert manager.get_connection_count("test") == 1

    manager.disconnect(ws, "test")
    assert manager.get_connection_count("test") == 0


@pytest.mark.asyncio
async def test_ws_broadcast():
    manager = ConnectionManager()
    ws1 = AsyncMock()
    ws2 = AsyncMock()

    await manager.connect(ws1, "test")
    await manager.connect(ws2, "test")

    msg = {"hello": "world"}
    await manager.broadcast("test", msg)

    ws1.send_json.assert_called_with(msg)
    ws2.send_json.assert_called_with(msg)


@pytest.mark.asyncio
async def test_ws_send_notification():
    manager = ConnectionManager()
    ws = AsyncMock()
    await manager.connect(ws, "notif")

    await manager.send_notification("notif", "Title", "Body", level="success")

    args = ws.send_json.call_args[0][0]
    assert args["type"] == "notification"
    assert args["title"] == "Title"
    assert args["level"] == "success"

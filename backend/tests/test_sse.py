import pytest
from sse_manager import SSEManager


@pytest.mark.asyncio
async def test_sse_subscribe_unsubscribe():
    manager = SSEManager()
    queue = manager.subscribe("test_channel")
    assert manager.active_connections("test_channel") == 1

    manager.unsubscribe(queue, "test_channel")
    assert manager.active_connections("test_channel") == 0


@pytest.mark.asyncio
async def test_sse_publish():
    manager = SSEManager()
    queue = manager.subscribe("test_channel")

    await manager.publish("test_event", {"foo": "bar"}, "test_channel")

    msg = queue.get_nowait()
    assert "event: test_event" in msg
    assert 'data: {"foo": "bar"}' in msg


@pytest.mark.asyncio
async def test_sse_format():
    manager = SSEManager()
    formatted = manager._format_sse("msg", {"a": 1})
    assert formatted.startswith("event: msg")
    assert 'data: {"a": 1}' in formatted

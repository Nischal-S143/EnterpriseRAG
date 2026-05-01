import pytest
from error_handlers import AppError, build_error_response, generate_trace_id, trace_id_ctx
from fastapi import status

def test_generate_trace_id():
    tid = generate_trace_id()
    assert len(tid) == 16
    assert isinstance(tid, str)

def test_app_error():
    exc = AppError(message="fail", error_code="CODE", status_code=400, details={"d": 1})
    assert exc.message == "fail"
    assert exc.error_code == "CODE"
    assert exc.status_code == 400
    assert exc.details == {"d": 1}

def test_build_error_response():
    token = trace_id_ctx.set("test-trace")
    try:
        resp = build_error_response("ERR", "msg", 400, {"info": "extra"})
        assert resp.status_code == 400
        content = resp.body.decode()
        assert "ERR" in content
        assert "test-trace" in content
        assert "extra" in content
    finally:
        trace_id_ctx.reset(token)

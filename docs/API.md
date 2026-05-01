# API Documentation

Base URL: `http://localhost:8000`

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

---

## Endpoints

### POST `/api/register`

Register a new user account.

**Rate Limit**: 10/minute

**Request Body**:
```json
{
  "username": "string (3-50 chars)",
  "password": "string (6-128 chars)",
  "role": "viewer | engineer | admin"
}
```

**Response** `201`:
```json
{
  "message": "User registered successfully",
  "username": "string",
  "role": "string"
}
```

**Errors**: `409` (duplicate), `400` (invalid role), `422` (validation)

---

### POST `/api/login`

Authenticate and receive JWT tokens.

**Rate Limit**: 5/minute

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response** `200`:
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "expires_in": 1800,
  "role": "string",
  "username": "string"
}
```

**Errors**: `401` (invalid credentials)

---

### POST `/api/refresh`

Exchange a refresh token for new access + refresh tokens.

**Rate Limit**: 10/minute

**Request Body**:
```json
{
  "refresh_token": "string"
}
```

**Response**: Same format as `/api/login`

---

### GET `/api/me`

Get current authenticated user info.

**Auth Required**: Yes

**Response** `200`:
```json
{
  "username": "string",
  "role": "string",
  "created_at": "ISO 8601 timestamp"
}
```

---

### POST `/api/chat`

RAG-powered chat with the AI assistant.

**Auth Required**: Yes | **Rate Limit**: 20/minute

**Request Body**:
```json
{
  "question": "string (1-2000 chars)"
}
```

**Response** `200`:
```json
{
  "answer": "string",
  "sources": ["string"],
  "confidence": "high | medium | low",
  "user_role": "string"
}
```

**Errors**: `503` (AI unavailable), `500` (internal error)

---

### POST `/api/chat/stream`

Streaming version of chat endpoint. Returns Server-Sent Events.

**Auth Required**: Yes | **Rate Limit**: 20/minute

**Request Body**: Same as `/api/chat`

**Response**: `text/event-stream`
```
data: <token chunk>

data: [DONE]
```

---

### POST `/api/chat/debug`

Debug-enhanced RAG chat. Returns a full pipeline trace alongside the AI response.

**Auth Required**: Yes | **Rate Limit**: 20/minute

**Request Body**: Same as `/api/chat`

**Response** `200`:
```json
{
  "answer": "string",
  "sources": ["string"],
  "confidence": "high | medium | low",
  "user_role": "string",
  "debug": {
    "pipeline_steps": [{"step": "string", "label": "string", "timestamp_ms": 0}],
    "search_results": [{"source": "string", "similarity": 0, "chunk_preview": "string"}],
    "retrieved_chunks": [{"source": "string", "content": "string", "relevance_score": 0}],
    "timing": {"embedding_ms": 0, "search_ms": 0, "reranking_ms": 0, "generation_ms": 0, "total_ms": 0},
    "router_decision": {}
  }
}
```

---

### GET `/api/health`

System health check (no auth required).

**Response** `200`:
```json
{
  "status": "healthy | degraded",
  "database": "connected | disconnected",
  "ai_service": "available | unavailable",
  "uptime": "string (e.g. '3600s')",
  "timestamp": "ISO 8601 timestamp",
  "vector_store_initialized": true,
  "registered_users": 0
}
```

---

## Enterprise / Internal Endpoints

The following endpoints are part of the internal enterprise APIs and typically require `admin` or specialized roles.

### Analytics & Audit
- `GET /api/admin/analytics`: Retrieve overall system usage, query success rates, and active users.
- `GET /api/admin/audit-logs`: Fetch paginated security and system audit logs.

### Document Management
- `POST /api/documents/upload`: Upload and ingest new PDFs into the vector store (triggers PyMuPDF and Gemini Vision extraction).
- `GET /api/documents`: List currently ingested documents and their processing status.

### WebSockets / SSE
- `WS /ws/pipeline-status`: Real-time bidirectional WebSocket connection to monitor the live status of the RAG multi-agent pipeline nodes.
- `GET /api/stream/pipeline-status`: Server-Sent Events (SSE) alternative for live pipeline status updates.

### Evaluator & Stress Testing
- `POST /api/eval/run`: Manually trigger the Evaluator Engine to assess current pipeline IR metrics.
- `POST /api/stress-test`: Run an internal load simulation to measure pipeline throughput and stability.


"""
Integration tests for V1 Enterprise API endpoints.
"""


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_health(self, test_client):
        resp = test_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ["healthy", "degraded"]

    def test_health_detailed(self, test_client, auth_headers):
        resp = test_client.get("/api/health/detailed", headers=auth_headers)
        assert resp.status_code == 200


class TestAnalyticsEndpoints:
    """Test V1 analytics endpoints."""

    def test_engagement_metrics(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/analytics/engagement", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_events" in data
        assert "unique_active_users" in data

    def test_query_success_rates(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/analytics/queries", headers=auth_headers)
        assert resp.status_code == 200
        assert "success_rate" in resp.json()

    def test_ai_performance(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/analytics/ai-performance", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "confidence" in data
        assert "latency" in data

    def test_system_health(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/analytics/system-health", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "platform" in data
        assert "python_version" in data

    def test_analytics_export_csv(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/analytics/export", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")

    def test_viewer_cannot_access_analytics(self, test_client, viewer_headers):
        resp = test_client.get("/api/v1/analytics/engagement", headers=viewer_headers)
        assert resp.status_code == 403


class TestAuditEndpoints:
    """Test V1 audit endpoints."""

    def test_audit_logs(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/audit/logs", headers=auth_headers)
        assert resp.status_code == 200
        assert "logs" in resp.json()

    def test_login_attempts(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/audit/login-attempts", headers=auth_headers)
        assert resp.status_code == 200
        assert "attempts" in resp.json()


class TestDocumentEndpoints:
    """Test V1 document management endpoints."""

    def test_list_documents(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/documents", headers=auth_headers)
        assert resp.status_code == 200
        assert "documents" in resp.json()

    def test_get_nonexistent_document(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/documents/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_nonexistent_document(self, test_client, auth_headers):
        resp = test_client.delete("/api/v1/documents/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    def test_upload_invalid_file_type(self, test_client, auth_headers):
        """Test uploading an unsupported file type."""
        resp = test_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.exe", b"fake content", "application/octet-stream")},
        )
        # Should fail validation (422 or 400)
        assert resp.status_code in [400, 422]


class TestCacheEndpoints:
    """Test V1 cache statistics endpoint."""

    def test_cache_stats(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/cache/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "query_cache" in data
        cache = data["query_cache"]
        assert "hits" in cache
        assert "misses" in cache


class TestRBACAdminEndpoints:
    """Test V1 RBAC admin endpoints."""

    def test_role_change_by_super_admin(self, test_client, super_admin_headers):
        # First, register a target user
        test_client.post("/api/register", json={
            "username": "rolechangetarget",
            "password": "RoleChange123!",
            "role": "viewer",
        })
        # Change role
        resp = test_client.put(
            "/api/v1/admin/users/rolechangetarget/role",
            headers=super_admin_headers,
            json={"new_role": "engineer"},
        )
        assert resp.status_code == 200
        assert resp.json()["new_role"] == "engineer"

    def test_role_change_by_admin_denied(self, test_client, auth_headers):
        """Admin should NOT be able to change roles (only super_admin)."""
        resp = test_client.put(
            "/api/v1/admin/users/testuser/role",
            headers=auth_headers,
            json={"new_role": "viewer"},
        )
        assert resp.status_code == 403

    def test_role_audit_log(self, test_client, auth_headers):
        resp = test_client.get("/api/v1/admin/roles/audit", headers=auth_headers)
        assert resp.status_code == 200
        assert "audit_logs" in resp.json()


class TestErrorHandling:
    """Test standardized error responses."""

    def test_unauthenticated_request(self, test_client):
        resp = test_client.get("/api/v1/admin/users")
        assert resp.status_code == 401

    def test_trace_id_in_response(self, test_client):
        resp = test_client.get("/api/health")
        assert "X-Request-Id" in resp.headers

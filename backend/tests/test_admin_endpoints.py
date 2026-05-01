from fastapi import status


def test_list_users_admin(test_client, auth_headers):
    # Path is /api/v1/admin/users
    response = test_client.get("/api/v1/admin/users", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    assert "users" in response.json()


def test_list_users_viewer_denied(test_client, viewer_headers):
    response = test_client.get("/api/v1/admin/users", headers=viewer_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_get_permissions(test_client, auth_headers):
    response = test_client.get("/api/v1/admin/permissions", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    assert "permissions" in response.json()


def test_audit_logs(test_client, auth_headers):
    # Path is /api/v1/audit/logs
    response = test_client.get("/api/v1/audit/logs", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK


def test_evaluations_summary(test_client, auth_headers):
    response = test_client.get("/api/v1/evaluations/summary", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK


def test_pipeline_status(test_client, auth_headers):
    response = test_client.get("/api/v1/pipeline/status", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    # PIPELINE_STATUS is returned directly, it should be a dict
    assert isinstance(response.json(), dict)

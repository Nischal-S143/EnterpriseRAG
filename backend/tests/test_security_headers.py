"""
Tests to verify that the security middleware is correctly applying headers.
"""


def test_security_headers_present(test_client):
    """
    Perform a request to a public endpoint and verify all mandatory
    security headers are present in the response.
    """
    # Use health endpoint which should be open
    response = test_client.get("/api/health")

    headers = response.headers

    # 1. X-Frame-Options
    assert headers.get("X-Frame-Options") == "DENY"

    # 2. X-Content-Type-Options
    assert headers.get("X-Content-Type-Options") == "nosniff"

    # 3. Strict-Transport-Security (HSTS)
    assert headers.get("Strict-Transport-Security") == "max-age=31536000; includeSubDomains"

    # 4. Referrer-Policy
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    # 5. Permissions-Policy
    # Check that it contains the core restricted features
    perm_policy = headers.get("Permissions-Policy", "")
    assert "geolocation=()" in perm_policy
    assert "microphone=()" in perm_policy
    assert "camera=()" in perm_policy

    # 6. Content-Security-Policy
    # Check that it starts with default-src 'self'
    csp = headers.get("Content-Security-Policy", "")
    assert "default-src 'self'" in csp

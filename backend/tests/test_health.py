"""
Health and landing-page endpoints.

Render probes `/` to decide whether the instance is live and shows those
requests in the deploy log. It had no route, so a perfectly healthy service
logged `GET / 404 Not Found` on every health check and looked broken.
"""


def test_root_returns_200_not_404(client):
    r = client.get("/")
    assert r.status_code == 200


def test_root_identifies_the_service(client):
    body = client.get("/").json()
    assert body["service"] == "SafeZone-AI backend"
    assert body["status"] == "ok"


def test_root_points_at_the_real_endpoints(client):
    """Landing output should say where the API actually lives."""
    body = client.get("/").json()
    assert body["health"] == "/api/health"
    assert "/api/*" in body["api"]


def test_health_still_works(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "SafeZone-AI backend"


def test_root_does_not_shadow_api_routes(client):
    """The landing route must be exactly / and nothing under /api."""
    assert client.get("/api/villages").status_code == 200
    assert client.get("/api").status_code == 404

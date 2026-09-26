"""
CORS allowlist tests.

Regression cover for the wildcard-CORS fix. The backend used to ship
allow_origins=["*"], which let any website on the internet read API responses
through the visitor's browser. These tests pin the allowlist behaviour so that
cannot silently regress.

Note: app.main reads SAFEZONE_CORS_ORIGINS at import time (the middleware is
built when the module is first imported), so these tests exercise the
_cors_origins() resolver directly rather than trying to mutate a live app.
"""

import importlib

ALLOWED_HEADER = "access-control-allow-origin"


def _resolve(monkeypatch, value):
    """Import a fresh copy of app.main with SAFEZONE_CORS_ORIGINS set."""
    if value is None:
        monkeypatch.delenv("SAFEZONE_CORS_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("SAFEZONE_CORS_ORIGINS", value)

    import app.main as main

    return importlib.reload(main)._cors_origins()


def test_unset_falls_back_to_localhost_only(monkeypatch):
    origins = _resolve(monkeypatch, None)
    assert origins, "must still allow local development"
    assert all(
        o.startswith("http://localhost:") or o.startswith("http://127.0.0.1:")
        for o in origins
    ), f"wildcard or unexpected origin in fallback: {origins}"


def test_never_returns_wildcard(monkeypatch):
    """The core regression: '*' must never be produced."""
    for value in (None, "", "   ", "https://a.example"):
        assert "*" not in _resolve(monkeypatch, value)
    assert not any("*" in o for o in _resolve(monkeypatch, None))


def test_configured_value_is_used(monkeypatch):
    assert _resolve(monkeypatch, "https://app.vercel.app") == ["https://app.vercel.app"]


def test_multiple_origins_are_split_and_trimmed(monkeypatch):
    result = _resolve(monkeypatch, "https://a.com, https://b.com ,")
    assert result == ["https://a.com", "https://b.com"]


def test_middleware_allows_configured_origin(monkeypatch):
    """End-to-end: a preflight from the configured origin is permitted."""
    monkeypatch.setenv("SAFEZONE_CORS_ORIGINS", "https://app.vercel.app")

    from fastapi.testclient import TestClient

    import app.main as main

    main = importlib.reload(main)
    with TestClient(main.app) as c:
        ok = c.options(
            "/api/health",
            headers={
                "Origin": "https://app.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert ok.headers.get(ALLOWED_HEADER) == "https://app.vercel.app"

        blocked = c.options(
            "/api/health",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert ALLOWED_HEADER not in blocked.headers, (
            "an unlisted origin must not be granted CORS access"
        )

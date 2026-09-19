"""
Shared pytest fixtures for the SafeLink-AI backend.

Every test runs against an isolated temporary SQLite database so the test
suite never touches real data and is fully parallel-safe w.r.t. state.

The SAFEZONE_DB_PATH env var is a lazy lookup inside db.py (a fresh path per
test), and db.init_db() force-creates schema + demo seed on that path.
"""

import os
import tempfile
import uuid
from pathlib import Path

import pytest

_TMP = Path(
    tempfile.mkdtemp(
        prefix="safelink-tests-",
        dir=str(Path(os.environ.get("TEMP", "/tmp"))),
    )
)

DEMO_ADMIN = ("admin@safezone.gov", "Safezone@123")
DEMO_OFFICIAL = ("official@safezone.gov", "Safezone@123")
DEMO_VOLUNTEER = ("volunteer@safezone.gov", "Safezone@123")
ADMIN_PIN = "1234"
OFFICIAL_PIN = "1234"


@pytest.fixture()
def client():
    """TestClient bound to a brand-new, freshly-seeded database."""
    os.environ["SAFEZONE_DB_PATH"] = str(_TMP / f"test-{uuid.uuid4().hex}.db")
    os.environ["SAFEZONE_SKIP_SEED"] = ""  # ensure demo seed runs

    from fastapi.testclient import TestClient

    from app import db
    from app.main import app

    db.init_db()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def login(client):
    """Factory: logs in as a demo account and returns auth headers."""

    def _login(email: str, password: str) -> dict:
        r = client.post("/api/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _login


@pytest.fixture()
def admin_headers(login):
    return login(*DEMO_ADMIN)


@pytest.fixture()
def official_headers(login):
    return login(*DEMO_OFFICIAL)


@pytest.fixture()
def volunteer_headers(login):
    return login(*DEMO_VOLUNTEER)
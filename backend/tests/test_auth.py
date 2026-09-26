"""Auth & RBAC: demo accounts, JWT, PIN login, rate limiting, admin-only ops."""

from .conftest import DEMO_ADMIN, DEMO_OFFICIAL, DEMO_VOLUNTEER, OFFICIAL_PIN


def test_login_admin_returns_token(client):
    r = client.post("/api/auth/login", json={"email": DEMO_ADMIN[0], "password": DEMO_ADMIN[1]})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == DEMO_ADMIN[0]
    assert body["user"]["role"] == "ADMIN"


def test_login_official_and_volunteer(client):
    for email, pw in (DEMO_OFFICIAL, DEMO_VOLUNTEER):
        r = client.post("/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text


def test_login_wrong_password_401(client):
    r = client.post("/api/auth/login", json={"email": DEMO_ADMIN[0], "password": "wrong-password"})
    assert r.status_code == 401


def test_login_unknown_email_401(client):
    r = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever1"})
    assert r.status_code == 401


def test_pin_login_ok(client):
    r = client.post("/api/auth/pin-login", json={"email": DEMO_OFFICIAL[0], "pin": OFFICIAL_PIN})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "OFFICIAL"


def test_pin_login_wrong_pin_401(client):
    r = client.post("/api/auth/pin-login", json={"email": DEMO_OFFICIAL[0], "pin": "9999"})
    assert r.status_code == 401


def test_pin_login_account_without_pin_401(client):
    # Volunteer has no PIN configured
    r = client.post("/api/auth/pin-login", json={"email": DEMO_VOLUNTEER[0], "pin": "1234"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_profile(client, admin_headers):
    r = client.get("/api/auth/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["email"] == DEMO_ADMIN[0]


def test_rate_limit_locks_out_after_five_failures(client):
    email = DEMO_ADMIN[0]
    for _ in range(5):
        r = client.post("/api/auth/login", json={"email": email, "password": "bad-pass"})
        assert r.status_code == 401
    # Even the correct password is rejected while locked out
    r = client.post("/api/auth/login", json={"email": email, "password": DEMO_ADMIN[1]})
    assert r.status_code == 429
    assert "try again" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Admin-only account creation
# ---------------------------------------------------------------------------

def test_register_requires_admin(client):
    # Anonymous -> 403 (privileged dependency rejects non-admins flatly)
    assert client.post("/api/auth/register", json={
        "name": "X", "email": "x@example.com", "password": "longpass", "role": "OFFICIAL",
    }).status_code == 403
    # Official -> 403
    official = client.post(
        "/api/auth/login", json={"email": DEMO_OFFICIAL[0], "password": DEMO_OFFICIAL[1]}
    ).json()["access_token"]
    r = client.post("/api/auth/register", json={
        "name": "X", "email": "x@example.com", "password": "longpass", "role": "OFFICIAL",
    }, headers={"Authorization": f"Bearer {official}"})
    assert r.status_code == 403


def test_register_creates_official(client, admin_headers):
    r = client.post("/api/auth/register", json={
        "name": "New Official",
        "email": "new.official@safezone.gov",
        "password": "StrongPass1",
        "role": "OFFICIAL",
        "department": "Relief",
        "pin": "4321",
    }, headers=admin_headers)
    assert r.status_code == 200, r.text
    created = r.json()["user"]
    assert created["role"] == "OFFICIAL"
    assert created["email"] == "new.official@safezone.gov"
    # The new account can sign in with its own password
    r2 = client.post("/api/auth/login", json={"email": "new.official@safezone.gov", "password": "StrongPass1"})
    assert r2.status_code == 200


def test_register_duplicate_email_400(client, admin_headers):
    r = client.post("/api/auth/register", json={
        "name": "Dup", "email": DEMO_ADMIN[0], "password": "StrongPass1", "role": "OFFICIAL",
    }, headers=admin_headers)
    assert r.status_code == 400


def test_register_short_password_422(client, admin_headers):
    r = client.post("/api/auth/register", json={
        "name": "Short", "email": "short@example.com", "password": "tiny", "role": "OFFICIAL",
    }, headers=admin_headers)
    assert r.status_code == 422


def test_users_list_admin_only(client, admin_headers, official_headers):
    r = client.get("/api/auth/users", headers=admin_headers)
    assert r.status_code == 200
    emails = {u["email"] for u in r.json()}
    assert DEMO_ADMIN[0] in emails and DEMO_OFFICIAL[0] in emails
    assert client.get("/api/auth/users", headers=official_headers).status_code == 403
    assert client.get("/api/auth/users").status_code == 403
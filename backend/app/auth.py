"""
Authentication & Authorization (RBAC)
======================================

JWT-based auth for AUTHORITY accounts only (ADMIN / OFFICIAL / VOLUNTEER).

* Civilians never need an account - the public stream is open.
* Roles are assigned by the server (an ADMIN creates accounts); the client
  can never choose its own role.
* Passwords are bcrypt-hashed. Fast-access PINs are stored per-user, hashed.
* Failed logins are rate-limited (5 failures locks the account for 15 min).
* The JWT signing secret comes from the SAFEZONE_JWT_SECRET env var, or from
  a per-install generated secret file (kept out of git) so a demonstrable
  default secret is never committed.
"""

import os
import secrets
import time
from pathlib import Path
from typing import Optional

import bcrypt
import jwt

from . import db
from .roles import is_authority

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = int(os.environ.get("SAFEZONE_JWT_EXPIRY", 86400 * 7))  # 7 days

DATA_DIR = Path(__file__).parent / "data"


# ---------------------------------------------------------------------------
# JWT secret - env var first, then a generated per-install secret file
# ---------------------------------------------------------------------------

def _load_or_create_secret() -> str:
    env_secret = os.environ.get("SAFEZONE_JWT_SECRET", "").strip()
    if env_secret:
        return env_secret
    secret_file = DATA_DIR / ".jwt_secret"
    if secret_file.exists():
        return secret_file.read_text(encoding="utf-8").strip()
    generated = secrets.token_urlsafe(48)
    secret_file.parent.mkdir(parents=True, exist_ok=True)
    secret_file.write_text(generated, encoding="utf-8")
    try:
        os.chmod(secret_file, 0o600)
    except OSError:
        pass
    return generated


JWT_SECRET = _load_or_create_secret()


# ---------------------------------------------------------------------------
# Password hashing (bcrypt directly - passlib is unmaintained)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_token(user_id: str, name: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "name": name,
        "email": email,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ---------------------------------------------------------------------------
# Rate limiting - 5 failed attempts per email per 15 minutes
# ---------------------------------------------------------------------------

LOCKOUT_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60
LOCKOUT_COOLDOWN_SECONDS = 15 * 60


def _record_auth_attempt(email: str, action: str, success: bool, ip: Optional[str] = None) -> None:
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO auth_attempts (email, action, ip, success, created_at) VALUES (%s, %s, %s, %s, %s)",
            (email.lower(), action, ip, 1 if success else 0, time.time()),
        )
        conn.commit()
    finally:
        conn.close()


def _is_locked_out(email: str) -> int:
    """Returns seconds remaining in the lockout, or 0 if not locked."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT created_at FROM auth_attempts "
            "WHERE email=%s AND success=0 AND created_at > %s "
            "ORDER BY created_at DESC",
            (email.lower(), time.time() - LOCKOUT_COOLDOWN_SECONDS),
        )
        row = cur.fetchone()
        if not row:
            return 0
        cur.execute(
            "SELECT COUNT(*) AS n FROM auth_attempts "
            "WHERE email=%s AND success=0 AND created_at > %s",
            (email.lower(), time.time() - LOCKOUT_WINDOW_SECONDS),
        )
        n = cur.fetchone()["n"]
        if n < LOCKOUT_ATTEMPTS:
            return 0
        return max(0, int(row["created_at"] + LOCKOUT_COOLDOWN_SECONDS - time.time()))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# User store
# ---------------------------------------------------------------------------

def find_user_by_email(email: str) -> Optional[dict]:
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE lower(email)=lower(%s) AND active=1", (email,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def find_user_by_id(user_id: str) -> Optional[dict]:
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id=%s AND active=1", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_users() -> list[dict]:
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, name, email, role, department, created_at, active FROM users ORDER BY created_at")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_user(
    name: str, email: str, password: str, role: str, department: str = "", pin: Optional[str] = None
) -> dict:
    """Server-side authority account creation. Role is validated, never trusted
    from the client at the endpoint layer."""
    role = role.upper()
    if not is_authority(role):
        raise ValueError(f"Role '{role}' is not a valid authority role")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE lower(email)=lower(%s)", (email,))
        if cur.fetchone():
            raise ValueError(f"Email '{email}' is already registered")
        user_id = "USR" + secrets.token_hex(3).upper()
        created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        cur.execute(
            "INSERT INTO users (id, name, email, password_hash, role, pin_hash, department, created_at, active) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)",
            (user_id, name, email, hash_password(password), role,
             hash_password(pin) if pin else None, department, created_at),
        )
        conn.commit()
        return {
            "id": user_id,
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "role": role,
            "pin_hash": hash_password(pin) if pin else None,
            "department": department,
            "created_at": created_at,
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Authenticators
# ---------------------------------------------------------------------------

def authenticate_login(email: str, password: str, ip: Optional[str] = None) -> Optional[dict]:
    """Email + password login with lockout. Returns user dict or None."""
    if lockout := _is_locked_out(email):
        raise PermissionError(f"Too many failed attempts. Try again in {int(lockout // 60) + 1} min.")
    user = find_user_by_email(email)
    if not user or not verify_password(password, user["password_hash"]):
        _record_auth_attempt(email, "login", False, ip)
        return None
    _record_auth_attempt(email, "login", True, ip)
    return user


def authenticate_pin(email: str, pin: str, ip: Optional[str] = None) -> Optional[dict]:
    """Per-user fast-access PIN for authorities."""
    if lockout := _is_locked_out(email):
        raise PermissionError(f"Too many failed attempts. Try again in {int(lockout // 60) + 1} min.")
    user = find_user_by_email(email)
    if not user or not user.get("pin_hash") or not verify_password(pin, user["pin_hash"]):
        _record_auth_attempt(email, "pin", False, ip)
        return None
    _record_auth_attempt(email, "pin", True, ip)
    return user


# ---------------------------------------------------------------------------
# Dependency helpers used by main.py
# ---------------------------------------------------------------------------

def public_user(user: dict) -> dict:
    """Shape of a user dict safe to send to the client."""
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "department": user.get("department", ""),
        "pin_enabled": bool(user.get("pin_hash")),
    }

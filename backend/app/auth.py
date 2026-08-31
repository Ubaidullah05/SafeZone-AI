"""
Authentication Module
=====================

Handles JWT-based authentication, password hashing, and biometric mock flows.
All passwords are bcrypt-hashed. JWT tokens carry user id, name, email, and role.
"""

import json
import time
import uuid
from pathlib import Path
from typing import Optional

import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

JWT_SECRET = "safezone-ai-dev-secret-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 86400 * 7  # 7 days

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


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
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ---------------------------------------------------------------------------
# User store (JSON file for prototype)
# ---------------------------------------------------------------------------

USERS_PATH = DATA_DIR / "users.json"


def _load_users() -> list[dict]:
    if not USERS_PATH.exists():
        return []
    with open(USERS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_users(users: list[dict]) -> None:
    with open(USERS_PATH, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)


def find_user_by_email(email: str) -> Optional[dict]:
    users = _load_users()
    for u in users:
        if u["email"].lower() == email.lower():
            return u
    return None


def find_user_by_id(user_id: str) -> Optional[dict]:
    users = _load_users()
    for u in users:
        if u["id"] == user_id:
            return u
    return None


def create_user(name: str, email: str, password: str, role: str = "citizen") -> dict:
    users = _load_users()
    if find_user_by_email(email):
        raise ValueError(f"Email '{email}' is already registered")
    user = {
        "id": f"USR{uuid.uuid4().hex[:6].upper()}",
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "role": role,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    users.append(user)
    _save_users(users)
    return user


# ---------------------------------------------------------------------------
# Biometric mock — face recognition simulation
# ---------------------------------------------------------------------------
# In production this would call a real face recognition service.
# For the hackathon prototype, we accept any non-empty image data and
# match against the first user with the matching "face_id" stored locally.
# Since there is no real face DB, we simply accept the mock and return
# a default admin user so the demo always works.

def authenticate_face_mock() -> dict:
    """Simulate successful face recognition. Returns admin user for demo."""
    user = find_user_by_email("rethikas2782@gmail.com")
    if not user:
        raise ValueError("Default admin user not found")
    return user


def authenticate_face(image_data: str) -> dict:
    """Authenticate via face recognition. Accepts base64 image from camera.
    For demo: accepts any non-empty image and returns the user account.
    In production: would send to a face recognition API."""
    if not image_data:
        raise ValueError("Invalid face image data")
    # Demo: accept face scan and return the user
    return authenticate_face_mock()


def authenticate_fingerprint(fingerprint_id: str) -> dict:
    """Authenticate via fingerprint/biometric. Accepts WebAuthn credential.
    For demo: accepts any non-empty fingerprint ID and returns the user.
    In production: would verify against stored WebAuthn credentials."""
    if not fingerprint_id:
        raise ValueError("Fingerprint authentication failed")
    # Demo: accept fingerprint and return the user
    user = find_user_by_email("rethikas2782@gmail.com")
    if not user:
        raise ValueError("Default admin user not found")
    return user


# ---------------------------------------------------------------------------
# Emergency PIN — works with any registered account
# ---------------------------------------------------------------------------
# Demo PIN: 1234. In production this would be a per-user configurable PIN
# with rate limiting. For the prototype, a single shared demo PIN is fine.

EMERGENCY_PIN = "1234"


def authenticate_pin(pin: str) -> Optional[dict]:
    """Verify emergency PIN. Returns the official user for demo."""
    if pin != EMERGENCY_PIN:
        return None
    user = find_user_by_email("official@safezone.gov")
    return user

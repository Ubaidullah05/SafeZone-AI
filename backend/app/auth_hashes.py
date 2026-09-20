"""
Demo account seeding (first-run only)
========================================

Demo credentials are created the first time the database is initialised:

  admin@safezone.gov    / Safezone@123   (District Admin, fast-access PIN 1234)
  official@safezone.gov / Safezone@123   (Relief Official, fast-access PIN 1234)
  volunteer@safezone.gov / Safezone@123  (Field Volunteer)

Real deployments should ignore this file or set SAFEZONE_SKIP_SEED=1.
"""

import time

import bcrypt


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def seed_demo_users(conn) -> None:
    users = [
        {
            "id": "USR001",
            "name": "District Admin",
            "email": "admin@safezone.gov",
            "password": "Safezone@123",
            "role": "ADMIN",
            "pin": "1234",
            "department": "District Disaster Management",
        },
        {
            "id": "USR002",
            "name": "Relief Official",
            "email": "official@safezone.gov",
            "password": "Safezone@123",
            "role": "OFFICIAL",
            "pin": "1234",
            "department": "District Relief Control Room",
        },
        {
            "id": "USR003",
            "name": "Field Volunteer",
            "email": "volunteer@safezone.gov",
            "password": "Safezone@123",
            "role": "VOLUNTEER",
            "pin": None,
            "department": "Field Response Team",
        },
    ]
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    cur = conn.cursor()
    cur.execute("BEGIN")
    for u in users:
        cur.execute(
            "INSERT INTO users (id, name, email, password_hash, role, pin_hash, department, created_at, active) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)",
            (
                u["id"],
                u["name"],
                u["email"],
                _hash(u["password"]),
                u["role"],
                _hash(u["pin"]) if u["pin"] else None,
                u["department"],
                created_at,
            ),
        )
    conn.commit()

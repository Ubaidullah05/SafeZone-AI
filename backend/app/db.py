"""
Persistence layer (SQLite)
==========================

Single source of truth for user accounts, SOS reports, authority
adjudications, the learning engine's adaptive weight state, registered
real-world hazard events, and login rate-limiting.

Using SQLite (stdlib) on purpose:
  * zero extra services to install for the SIH prototype,
  * survives server restarts (the old design re-seeded JSON on every run),
  * easy to swap for Postgres later.

The path is configurable via the SAFEZONE_DB_PATH environment variable so
tests can run against a temporary database. All helpers open a fresh
connection per call: simple, thread-safe enough for a prototype, and robust
to file corruption from lingering transactions.
"""

import json
import os
import sqlite3
import threading
import time
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"


def db_path() -> Path:
    return Path(os.environ.get("SAFEZONE_DB_PATH", str(DATA_DIR / "safelink.db")))


_lock = threading.Lock()
_initialised = False

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('ADMIN','OFFICIAL','VOLUNTEER')),
    pin_hash      TEXT,
    department    TEXT,
    created_at    TEXT NOT NULL,
    active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sos_reports (
    id                TEXT PRIMARY KEY,
    reporter_name     TEXT NOT NULL,
    reporter_phone    TEXT NOT NULL DEFAULT '',
    village_id        TEXT NOT NULL,
    village_name      TEXT NOT NULL,
    emergency_type    TEXT NOT NULL,
    severity          INTEGER NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    people_affected   INTEGER NOT NULL DEFAULT 1,
    medical_emergency INTEGER NOT NULL DEFAULT 0,
    medical_details   TEXT NOT NULL DEFAULT '',
    latitude          REAL NOT NULL,
    longitude         REAL NOT NULL,
    timestamp         TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'NEW',
    priority_score    REAL NOT NULL DEFAULT 0,
    relay_hops        INTEGER NOT NULL DEFAULT 0,
    reached_gateway   INTEGER NOT NULL DEFAULT 0,
    adjudicated_by    TEXT,
    adjudicated_at    TEXT
);

CREATE TABLE IF NOT EXISTS adjudications (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id              TEXT NOT NULL,
    authority_id           TEXT NOT NULL,
    actual_people_affected INTEGER NOT NULL,
    actual_severity        INTEGER NOT NULL CHECK (actual_severity BETWEEN 1 AND 5),
    outcome                TEXT,
    note                   TEXT,
    created_at             TEXT NOT NULL,
    UNIQUE (report_id)
);

CREATE TABLE IF NOT EXISTS model_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id              TEXT PRIMARY KEY,
    village_id      TEXT,
    location_name   TEXT,
    hazard_type     TEXT NOT NULL,
    date            TEXT,
    observed_severity REAL,
    magnitude       TEXT,
    source          TEXT,
    note            TEXT
);

CREATE TABLE IF NOT EXISTS auth_attempts (
    email      TEXT NOT NULL,
    action     TEXT NOT NULL,
    ip         TEXT,
    success    INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_reports(status);
CREATE INDEX IF NOT EXISTS idx_sos_village ON sos_reports(village_id);
CREATE INDEX IF NOT EXISTS idx_attempts_email_time ON auth_attempts(email, created_at);
"""


def _connect() -> sqlite3.Connection:
    """Open a raw connection without triggering init (used by init_db)."""
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_conn() -> sqlite3.Connection:
    """Open a fresh connection. Uses WAL for concurrent readers/writers.
    Lazily initialises schema + first-run seed so any module can safely
    touch the database without explicit setup."""
    global _initialised
    if not _initialised:
        with _lock:
            if not _initialised:
                conn = _connect()
                try:
                    conn.executescript(SCHEMA)
                    _seed_model_state(conn)
                    if not os.environ.get("SAFEZONE_SKIP_SEED"):
                        _seed_demo_sos(conn)
                        _seed_users(conn)
                    conn.commit()
                finally:
                    conn.close()
                _initialised = True
    return _connect()


def init_db() -> None:
    """Force schema creation and first-run seeding (idempotent)."""
    with _lock:
        global _initialised
        conn = _connect()
        try:
            conn.executescript(SCHEMA)
            _seed_model_state(conn)
            if not os.environ.get("SAFEZONE_SKIP_SEED"):
                _seed_demo_sos(conn)
                _seed_users(conn)
            conn.commit()
        finally:
            conn.close()
        _initialised = True


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

def _seed_model_state(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT 1 FROM model_state WHERE key='risk_weights'").fetchone():
        return
    defaults = {
        "risk_weights": {
            "hazard_severity": 0.30,
            "slope_risk": 0.20,
            "population_exposure": 0.15,
            "accessibility_risk": 0.15,
            "facility_access_risk": 0.10,
            "historical_event_risk": 0.10,
        },
        "alphas": {
            "hazard_severity": 3.0,
            "slope_risk": 2.0,
            "population_exposure": 1.5,
            "accessibility_risk": 1.5,
            "facility_access_risk": 1.0,
            "historical_event_risk": 1.0,
        },
        "n_observations": 0,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    for key, value in defaults.items():
        conn.execute(
            "INSERT INTO model_state (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )


def _seed_users(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        return
    from .auth_hashes import seed_demo_users  # lazy import to avoid cycles
    seed_demo_users(conn)


def _seed_demo_sos(conn: sqlite3.Connection) -> None:
    """A few clearly-labelled demo reports so the map/feeds are not empty on
    first run. Judges can still submit live reports."""
    if conn.execute("SELECT 1 FROM sos_reports LIMIT 1").fetchone():
        return
    from .sos_engine import calculate_sos_priority  # lazy import to avoid cycles
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    demo = [
        {
            "id": "SOS001",
            "reporter_name": "Demo Resident (Amrapur)",
            "village_id": "V008",
            "village_name": "Amrapur",
            "emergency_type": "FLOOD",
            "severity": 4,
            "description": "Demo record: water levels rising near stream bank.",
            "people_affected": 60,
            "medical_emergency": 0,
            "latitude": 30.203,
            "longitude": 78.46,
            "timestamp": now,
        },
        {
            "id": "SOS002",
            "reporter_name": "Demo Resident (Sundarpur)",
            "village_id": "V001",
            "village_name": "Sundarpur",
            "emergency_type": "ROAD_BLOCKED",
            "severity": 3,
            "description": "Demo record: landslide debris blocking main approach road.",
            "people_affected": 0,
            "medical_emergency": 0,
            "latitude": 30.121,
            "longitude": 78.451,
            "timestamp": now,
        },
        {
            "id": "SOS003",
            "reporter_name": "Demo Resident (Nandagaon)",
            "village_id": "V006",
            "village_name": "Nandagaon",
            "emergency_type": "MEDICAL",
            "severity": 5,
            "description": "Demo record: medical access request.",
            "people_affected": 2,
            "medical_emergency": 1,
            "latitude": 30.188,
            "longitude": 78.418,
            "timestamp": now,
        },
    ]
    for r in demo:
        priority = calculate_sos_priority(
            severity=r["severity"],
            emergency_type=r["emergency_type"],
            people_affected=r["people_affected"],
            medical_emergency=bool(r["medical_emergency"]),
            total_village_population=2500,
            timestamp=r["timestamp"],
        )
        conn.execute(
            "INSERT INTO sos_reports (id, reporter_name, reporter_phone, village_id, village_name, "
            "emergency_type, severity, description, people_affected, medical_emergency, medical_details, "
            "latitude, longitude, timestamp, status, priority_score, relay_hops, reached_gateway) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (r["id"], r["reporter_name"], "", r["village_id"], r["village_name"],
             r["emergency_type"], r["severity"], r["description"], r["people_affected"],
             r["medical_emergency"], "", r["latitude"], r["longitude"], r["timestamp"],
             "NEW", priority, 0, 0),
        )


# ---------------------------------------------------------------------------
# JSON blob helpers for model_state
# ---------------------------------------------------------------------------

def get_state(key: str, default=None):
    conn = get_conn()
    try:
        row = conn.execute("SELECT value FROM model_state WHERE key=?", (key,)).fetchone()
        return json.loads(row["value"]) if row else default
    finally:
        conn.close()


def set_state(key: str, value) -> None:
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO model_state (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value)),
        )
        conn.commit()
    finally:
        conn.close()
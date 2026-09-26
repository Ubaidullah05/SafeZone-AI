"""
Persistence layer (PostgreSQL)
==============================

PostgreSQL-backed persistence for user accounts, SOS reports, authority
adjudications, the learning engine's adaptive weight state, registered
real-world hazard events, and login rate-limiting.

Connection is configured via the DATABASE_URL environment variable
(postgresql://user:pass@host:5432/dbname) or individual vars:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

Falls back to SAFEZONE_DEMO_MODE JSON when the DB is unreachable.
"""

import json
import logging
import os
import re
import sqlite3
import time
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import psycopg2
    from psycopg2.extras import DictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

DATA_DIR = Path(__file__).parent / "data"


# ---------------------------------------------------------------------------
# SQLite Compatibility Wrappers
# ---------------------------------------------------------------------------

class SQLiteCursorWrapper:
    """Wraps sqlite3.Cursor to provide psycopg2-compatible parameter and method semantics."""

    def __init__(self, cur: sqlite3.Cursor):
        self._cur = cur
        self.description = None

    def execute(self, sql: str, params=None):
        if sql.strip().upper() == "BEGIN":
            return self
        sql_sqlite = sql.replace("%s", "?")
        if params is None:
            self._cur.execute(sql_sqlite)
        else:
            self._cur.execute(sql_sqlite, params)
        self.description = self._cur.description
        return self

    def executemany(self, sql: str, seq_of_parameters):
        sql_sqlite = sql.replace("%s", "?")
        self._cur.executemany(sql_sqlite, seq_of_parameters)
        self.description = self._cur.description
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def fetchmany(self, size=None):
        return self._cur.fetchmany(size)

    def close(self):
        self._cur.close()

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    @property
    def lastrowid(self):
        return self._cur.lastrowid

    def __iter__(self):
        return iter(self._cur)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class SQLiteConnectionWrapper:
    """Wraps sqlite3.Connection with dictionary-like row access and transaction management."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn
        self._conn.row_factory = sqlite3.Row
        self.autocommit = False

    def cursor(self):
        return SQLiteCursorWrapper(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def _conn_str() -> str:
    """Build a connection string from environment variables."""
    url = os.environ.get("DATABASE_URL", "")
    if url:
        return url
    host = os.environ.get("DB_HOST", "localhost")
    port = os.environ.get("DB_PORT", "5432")
    database = os.environ.get("DB_NAME", "safelink")
    user = os.environ.get("DB_USER", "postgres")
    password = os.environ.get("DB_PASSWORD", "")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def _get_sqlite_path() -> Path:
    env_path = os.environ.get("SAFEZONE_DB_PATH", "").strip()
    if env_path:
        return Path(env_path)
    return DATA_DIR / "safelink.db"


def _connect_sqlite(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    raw = sqlite3.connect(str(db_path), check_same_thread=False)
    return SQLiteConnectionWrapper(raw)


def _connect():
    """Open a database connection: PostgreSQL if available/configured, SQLite otherwise."""
    # Explicit SQLite via path or env
    if os.environ.get("SAFEZONE_DB_PATH") or os.environ.get("SAFEZONE_USE_SQLITE") == "1":
        return _connect_sqlite(_get_sqlite_path())

    if HAS_PSYCOPG2:
        try:
            conn = psycopg2.connect(_conn_str(), cursor_factory=DictCursor)
            conn.autocommit = False
            return conn
        except (psycopg2.OperationalError, psycopg2.DatabaseError) as err:
            logger.warning("PostgreSQL connection failed (%s); falling back to local SQLite", err)

    return _connect_sqlite(_get_sqlite_path())


def _sqlite_schema(schema_sql: str) -> str:
    return re.sub(r"\bSERIAL\s+PRIMARY\s+KEY\b", "INTEGER PRIMARY KEY AUTOINCREMENT", schema_sql, flags=re.IGNORECASE)


def _executescript(conn, schema_sql: str) -> None:
    """Execute a multi-statement SQL string."""
    if isinstance(conn, SQLiteConnectionWrapper):
        schema_sql = _sqlite_schema(schema_sql)
    cur = conn.cursor()
    statements = [s.strip() for s in schema_sql.split(";") if s.strip()]
    for stmt in statements:
        cur.execute(stmt)
    cur.close()
    conn.commit()


def _is_demo_mode() -> bool:
    return os.environ.get("SAFEZONE_DEMO_MODE", "0") == "1"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

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
    transmission_channel TEXT NOT NULL DEFAULT 'TERRESTRIAL',
    sat_terminal_id   TEXT NOT NULL DEFAULT '',
    sat_constellation TEXT NOT NULL DEFAULT '',
    sat_latency_ms    REAL NOT NULL DEFAULT 0,
    sat_signal_dbhz   REAL NOT NULL DEFAULT 0,
    raw_sat_packet    TEXT NOT NULL DEFAULT '',
    adjudicated_by    TEXT,
    adjudicated_at    TEXT
);

CREATE TABLE IF NOT EXISTS adjudications (
    id                     SERIAL PRIMARY KEY,
    report_id              TEXT NOT NULL UNIQUE,
    authority_id           TEXT NOT NULL,
    actual_people_affected INTEGER NOT NULL,
    actual_severity        INTEGER NOT NULL CHECK (actual_severity BETWEEN 1 AND 5),
    outcome                TEXT,
    note                   TEXT,
    created_at             TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS learning_observations (
    id                 TEXT PRIMARY KEY,
    source             TEXT NOT NULL DEFAULT 'live',
    provenance         TEXT,
    village_id         TEXT,
    factors_json       TEXT NOT NULL,
    observed_severity  REAL NOT NULL,
    event_ref          TEXT,
    created_at         TEXT
);

CREATE TABLE IF NOT EXISTS auth_attempts (
    email      TEXT NOT NULL,
    action     TEXT NOT NULL,
    ip         TEXT,
    success    INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS villages (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    latitude              REAL NOT NULL,
    longitude             REAL NOT NULL,
    population            INTEGER NOT NULL,
    hazard_severity       REAL NOT NULL DEFAULT 0,
    slope_risk            REAL NOT NULL DEFAULT 0,
    population_exposure   REAL NOT NULL DEFAULT 0,
    accessibility_risk    REAL NOT NULL DEFAULT 0,
    facility_access_risk  REAL NOT NULL DEFAULT 0,
    historical_event_risk REAL NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS safe_zones (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    latitude          REAL NOT NULL,
    longitude         REAL NOT NULL,
    capacity          INTEGER NOT NULL,
    medical_access    REAL NOT NULL DEFAULT 0,
    safety_score      REAL NOT NULL DEFAULT 0,
    road_access_score REAL NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_reports(status);
CREATE INDEX IF NOT EXISTS idx_sos_village ON sos_reports(village_id);
CREATE INDEX IF NOT EXISTS idx_attempts_email_time ON auth_attempts(email, created_at);

CREATE TABLE IF NOT EXISTS mesh_nodes (
    node_id       TEXT PRIMARY KEY,
    device_id     TEXT NOT NULL,
    battery_level REAL NOT NULL DEFAULT 100,
    connectivity_score REAL NOT NULL DEFAULT 0,
    role          TEXT NOT NULL DEFAULT 'USER',
    latitude      REAL,
    longitude     REAL,
    last_seen     TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mesh_packets (
    packet_id       TEXT PRIMARY KEY,
    source_node_id  TEXT NOT NULL,
    destination_node_id TEXT NOT NULL,
    message_type    TEXT NOT NULL DEFAULT 'SOS',
    priority        TEXT NOT NULL DEFAULT 'MEDIUM',
    payload         TEXT NOT NULL DEFAULT '{}',
    ttl             INTEGER NOT NULL DEFAULT 10,
    hop_count       INTEGER NOT NULL DEFAULT 0,
    relay_path      TEXT NOT NULL DEFAULT '[]',
    encrypted       INTEGER NOT NULL DEFAULT 1,
    timestamp       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX IF NOT EXISTS idx_mesh_packet_status ON mesh_packets(status);
CREATE INDEX IF NOT EXISTS idx_mesh_packet_dest ON mesh_packets(destination_node_id);
CREATE INDEX IF NOT EXISTS idx_mesh_packet_priority ON mesh_packets(priority, timestamp);

CREATE TABLE IF NOT EXISTS satcom_terminals (
    terminal_id      TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    model            TEXT NOT NULL,
    latitude         REAL NOT NULL,
    longitude        REAL NOT NULL,
    altitude_m       REAL NOT NULL DEFAULT 0,
    battery_pct      INTEGER NOT NULL DEFAULT 100,
    ble_paired       INTEGER NOT NULL DEFAULT 0,
    ble_signal_dbm   INTEGER NOT NULL DEFAULT -60,
    uplink_c_n0_dbhz REAL NOT NULL DEFAULT 44.0,
    status           TEXT NOT NULL DEFAULT 'ONLINE',
    sat_lock         INTEGER NOT NULL DEFAULT 1,
    last_ping        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS satcom_downlink_messages (
    id           TEXT PRIMARY KEY,
    terminal_id  TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'ADVISORY',
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    timestamp    TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'BEAMED_VIA_SATELLITE',
    sat_carrier  TEXT NOT NULL DEFAULT 'GSAT-7R MSS Forward Link'
);
"""


# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------

def db_identity() -> str:
    """
    Identifies the database currently in use.

    Used as a cache key so in-process caches (e.g. the learning weights) can
    never serve values computed against a different database.
    """
    if os.environ.get("SAFEZONE_DB_PATH") or os.environ.get("SAFEZONE_USE_SQLITE") == "1":
        return f"sqlite:{_get_sqlite_path()}"
    return f"pg:{_conn_str()}"


def get_conn():
    """Open a fresh connection. Uses demo JSON fallback when applicable."""
    if _is_demo_mode():
        raise ConnectionError("Demo mode — no DB connection")
    conn = _connect()
    try:
        _executescript(conn, SCHEMA)
    except Exception:
        conn.close()
        raise
    return conn


def init_db() -> None:
    """Force schema creation and first-run seeding (idempotent)."""
    conn = _connect()
    try:
        _executescript(conn, SCHEMA)
        _migrate(conn)
        _seed_model_state(conn)
        if not os.environ.get("SAFEZONE_SKIP_SEED"):
            _seed_demo_sos(conn)
            _seed_users(conn)
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------

def _migrate(conn) -> None:
    """
    Additive column migrations for databases created before a column existed.

    `CREATE TABLE IF NOT EXISTS` will not add a column to an existing table, so
    new columns must be applied explicitly. Every step is checked against
    `PRAGMA table_info` first, which makes this safe to run on every startup.
    """
    migrations = [
        ("events", "factors_json", "TEXT"),
        ("events", "provenance", "TEXT"),
    ]
    for table, column, coltype in migrations:
        cur = conn.cursor()
        cur.execute(f"PRAGMA table_info({table})")
        existing = {r["name"] for r in cur.fetchall()}
        if column not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

def _seed_model_state(conn) -> None:
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM model_state WHERE key='risk_weights'")
    if cur.fetchone():
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
        cur.execute(
            "INSERT INTO model_state (key, value) VALUES (%s, %s) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value)),
        )
    conn.commit()


def _seed_users(conn) -> None:
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM users LIMIT 1")
    if cur.fetchone():
        return
    from .auth_hashes import seed_demo_users
    seed_demo_users(conn)


def _seed_demo_sos(conn) -> None:
    """A few clearly-labelled demo reports so the map/feeds are not empty on
    first run."""
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM sos_reports LIMIT 1")
    if cur.fetchone():
        return
    from .sos_engine import calculate_sos_priority
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
            "medical_emergency": False,
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
            "medical_emergency": False,
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
            "medical_emergency": True,
            "latitude": 30.188,
            "longitude": 78.418,
            "timestamp": now,
        },
    ]
    cur.execute("BEGIN")
    for r in demo:
        priority = calculate_sos_priority(
            severity=r["severity"],
            emergency_type=r["emergency_type"],
            people_affected=r["people_affected"],
            medical_emergency=r["medical_emergency"],
            total_village_population=2500,
            timestamp=r["timestamp"],
        )
        cur.execute(
            "INSERT INTO sos_reports "
            "(id, reporter_name, reporter_phone, village_id, village_name, "
            "emergency_type, severity, description, people_affected, medical_emergency, medical_details, "
            "latitude, longitude, timestamp, status, priority_score, relay_hops, reached_gateway) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (r["id"], r["reporter_name"], "", r["village_id"], r["village_name"],
             r["emergency_type"], r["severity"], r["description"], r["people_affected"],
             1 if r["medical_emergency"] else 0, "", r["latitude"], r["longitude"], r["timestamp"],
             "NEW", priority, 0, 0),
        )
    conn.commit()
    conn.commit()


# ---------------------------------------------------------------------------
# JSON blob helpers for model_state
# ---------------------------------------------------------------------------

def get_state(key: str, default=None):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT value FROM model_state WHERE key=%s", (key,))
        row = cur.fetchone()
        return json.loads(row["value"]) if row else default
    finally:
        conn.close()


def set_state(key: str, value) -> None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO model_state (key, value) VALUES (%s, %s) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value)),
        )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Villages and safe zones (database-backed)
# ---------------------------------------------------------------------------

def has_villages() -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM villages LIMIT 1")
        row = cur.fetchone()
        return row is not None
    finally:
        conn.close()


def insert_villages(villages: list[dict]) -> int:
    conn = get_conn()
    try:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        count = 0
        cur = conn.cursor()
        for v in villages:
            cur.execute(
                "INSERT INTO villages "
                "(id, name, latitude, longitude, population, hazard_severity, slope_risk, "
                "population_exposure, accessibility_risk, facility_access_risk, historical_event_risk, "
                "created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, "
                "longitude=excluded.longitude, population=excluded.population, "
                "hazard_severity=excluded.hazard_severity, slope_risk=excluded.slope_risk, "
                "population_exposure=excluded.population_exposure, "
                "accessibility_risk=excluded.accessibility_risk, "
                "facility_access_risk=excluded.facility_access_risk, "
                "historical_event_risk=excluded.historical_event_risk, "
                "updated_at=excluded.updated_at",
                (
                    v["id"], v["name"], v["latitude"], v["longitude"], v["population"],
                    v.get("hazard_severity", 0), v.get("slope_risk", 0),
                    v.get("population_exposure", 0), v.get("accessibility_risk", 0),
                    v.get("facility_access_risk", 0), v.get("historical_event_risk", 0),
                    now, now,
                ),
            )
            count += 1
        conn.commit()
        return count
    finally:
        conn.close()


def get_villages_from_db() -> list[dict]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM villages ORDER BY id")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def has_safe_zones() -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM safe_zones LIMIT 1")
        row = cur.fetchone()
        return row is not None
    finally:
        conn.close()


def insert_safe_zones(zones: list[dict]) -> int:
    conn = get_conn()
    try:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        count = 0
        cur = conn.cursor()
        for z in zones:
            cur.execute(
                "INSERT INTO safe_zones "
                "(id, name, latitude, longitude, capacity, medical_access, safety_score, "
                "road_access_score, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, "
                "longitude=excluded.longitude, capacity=excluded.capacity, "
                "medical_access=excluded.medical_access, safety_score=excluded.safety_score, "
                "road_access_score=excluded.road_access_score, "
                "updated_at=excluded.updated_at",
                (
                    z["id"], z["name"], z["latitude"], z["longitude"], z["capacity"],
                    z.get("medical_access", 0), z.get("safety_score", 0),
                    z.get("road_access_score", 0), now, now,
                ),
            )
            count += 1
        conn.commit()
        return count
    finally:
        conn.close()


def get_safe_zones_from_db() -> list[dict]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM safe_zones ORDER BY id")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

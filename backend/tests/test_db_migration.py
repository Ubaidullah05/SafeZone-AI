"""
Regression tests for additive column migrations.

`PRAGMA table_info` is SQLite-only. Using it unconditionally made
`init_db()` raise a psycopg2 SyntaxError on PostgreSQL, which aborted
application startup on Render and took the whole deployment down. These
tests pin both dialects: the lookup must be chosen by the live connection
type, and the migration must actually add the columns it is responsible for.
"""

import os
import tempfile
import uuid
from pathlib import Path

import pytest

from app import db


@pytest.fixture()
def sqlite_conn():
    """A freshly-created SQLite connection on its own temporary file."""
    path = Path(tempfile.gettempdir()) / f"mig-sqlite-{uuid.uuid4().hex}.db"
    os.environ["SAFEZONE_DB_PATH"] = str(path)
    try:
        conn = db._connect()
        db._executescript(conn, db.SCHEMA)
        # The migrated columns are absent from base SCHEMA by design, so run the
        # migration once to reach the same state a real deployment settles into.
        db._migrate(conn)
        yield conn
    finally:
        conn.close()
        path.unlink(missing_ok=True)


def test_migrate_adds_missing_columns_on_sqlite(sqlite_conn):
    """Dropping a migrated column must be repaired on the next startup."""
    cur = sqlite_conn.cursor()
    cur.execute("ALTER TABLE events DROP COLUMN factors_json")
    sqlite_conn.commit()
    cur.close()

    assert "factors_json" not in db._existing_columns(sqlite_conn, "events")

    db._migrate(sqlite_conn)

    assert "factors_json" in db._existing_columns(sqlite_conn, "events")


def test_existing_columns_reads_sqlite_pragma(sqlite_conn):
    """The SQLite branch must return real column names."""
    columns = db._existing_columns(sqlite_conn, "events")

    assert "id" in columns
    assert "factors_json" in columns
    assert "provenance" in columns


def test_migrate_is_idempotent(sqlite_conn):
    """Running repeatedly must not raise or duplicate columns."""
    db._migrate(sqlite_conn)
    before = db._existing_columns(sqlite_conn, "events")

    db._migrate(sqlite_conn)
    db._migrate(sqlite_conn)

    assert db._existing_columns(sqlite_conn, "events") == before


class _FakePostgresRow(tuple):
    """psycopg2 returns plain tuples here; dict access must not be assumed."""

    def __new__(cls, value):
        return super().__new__(cls, (value,))


class _FakePostgresCursor:
    def __init__(self, columns, conn=None):
        self._columns = columns
        self._conn = conn
        self._rows = []

    def execute(self, query, params=None):
        self._last = " ".join(query.split())
        if self._conn is not None:
            self._conn.executed.append(self._last)
        if "information_schema.columns" in self._last:
            # `params[0]` is the table being inspected.
            table = params[0] if params else None
            if table is not None and isinstance(self._columns, dict):
                self._rows = [_FakePostgresRow(c) for c in self._columns.get(table, [])]
            else:
                self._rows = [_FakePostgresRow(c) for c in self._columns]
        else:
            self._rows = []

    def fetchall(self):
        return self._rows

    def close(self):
        pass


class _FakePostgresConn:
    """Minimal stand-in so the PostgreSQL branch is tested without a server.

    `columns` may be a flat list, applied to every table, or a mapping of table
    name to its columns when a test needs to distinguish them.
    """

    def __init__(self, columns):
        self._columns = columns
        self.executed = []
        self.committed = False

    def cursor(self):
        return _FakePostgresCursor(self._columns, conn=self)

    def commit(self):
        self.committed = True


# Columns the app writes to `sos_reports` that must exist for an INSERT to
# succeed. When these were missing on an existing database every SOS insert
# failed and the report was silently kept in memory only.
SOS_REPORT_WRITTEN_COLUMNS = [
    "transmission_channel",
    "sat_terminal_id",
    "sat_constellation",
    "sat_latency_ms",
    "sat_signal_dbhz",
    "raw_sat_packet",
    "client_token",
]

# A database that already has every column the app writes, so migration is a
# no-op.
_FULLY_MIGRATED_SCHEMA = {
    "events": ["id", "factors_json", "provenance"],
    "sos_reports": ["id", "medical_details"] + SOS_REPORT_WRITTEN_COLUMNS,
}

# Schema of a database missing every column the migrations add.
_LEGACY_SCHEMA = {
    "events": ["id", "date", "source"],
    "sos_reports": ["id"],
}


def test_existing_columns_uses_information_schema_for_postgres():
    """A non-SQLite connection must query information_schema, never PRAGMA."""
    conn = _FakePostgresConn(["id", "factors_json", "provenance"])

    columns = db._existing_columns(conn, "events")

    assert len(conn.executed) == 1
    executed = conn.executed[0]
    assert "information_schema.columns" in executed
    assert "PRAGMA" not in executed.upper()
    assert columns == {"id", "factors_json", "provenance"}


def test_migrate_adds_missing_columns_on_postgres():
    """A table lacking the columns must get them, without touching PRAGMA."""
    conn = _FakePostgresConn(_LEGACY_SCHEMA)

    db._migrate(conn)

    assert all("PRAGMA" not in s.upper() for s in conn.executed)
    assert any("ALTER TABLE events ADD COLUMN factors_json" in s for s in conn.executed)
    assert any("ALTER TABLE events ADD COLUMN provenance" in s for s in conn.executed)
    assert any("ALTER TABLE sos_reports ADD COLUMN client_token" in s for s in conn.executed)


def test_migrate_skips_existing_columns_on_postgres():
    """Columns already present must not be re-added."""
    conn = _FakePostgresConn(_FULLY_MIGRATED_SCHEMA)

    db._migrate(conn)

    assert not any("ALTER TABLE" in s for s in conn.executed)


def test_migrate_adds_every_written_sos_column():
    """A legacy database must gain all columns the SOS INSERT writes.

    `transmission_channel` and the satellite columns were absent from the
    migration list, so on an already-created database every SOS insert raised
    UndefinedColumn and the report was kept in memory only.
    """
    conn = _FakePostgresConn(_LEGACY_SCHEMA)

    db._migrate(conn)

    for column in SOS_REPORT_WRITTEN_COLUMNS:
        assert any(
            f"ALTER TABLE sos_reports ADD COLUMN {column}" in s for s in conn.executed
        ), f"missing migration for sos_reports.{column}"


def test_migrate_commits_added_columns():
    """Added columns must be committed, or they vanish when the conn closes."""
    conn = _FakePostgresConn(_LEGACY_SCHEMA)

    db._migrate(conn)

    assert conn.committed, "migration must commit its ALTER TABLE statements"


def test_sos_insert_succeeds_on_a_legacy_database(client):
    """A report submitted to a pre-existing schema must actually be stored.

    Regression guard for the silent memory-only fallback: the endpoint returned
    200 while nothing was written, so SOS reports disappeared on restart.
    """
    created = client.post(
        "/api/sos/submit",
        json={
            "reporter_name": "Legacy Schema Citizen",
            "village_id": "V001",
            "village_name": "Sundarpur",
            "emergency_type": "FLOOD",
            "severity": 4,
            "description": "Persistence check.",
            "people_affected": 2,
            "medical_emergency": False,
            "latitude": 30.1,
            "longitude": 78.4,
            "client_token": "c-legacy-1",
        },
    )
    assert created.status_code == 200, created.text

    reports = client.get(
        "/api/sos/reports",
        headers={"Authorization": "Bearer " + _login(client)},
    ).json()
    stored = [r for r in reports if r.get("client_token") == "c-legacy-1"]
    assert len(stored) == 1, "SOS report was not persisted"


def _login(client) -> str:
    return client.post(
        "/api/auth/login", json={"email": "admin@safezone.gov", "password": "Safezone@123"}
    ).json()["access_token"]

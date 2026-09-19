"""
SOS Engine
==========

Processes citizen-submitted SOS reports (no account required), calculates
priority scores, persists them to SQLite, and provides aggregation by village.

The SQLite store replaces the old JSON file: reports now survive restarts and
are the feed for both the ground-reality scoring and the learning engine.
"""

import time
from typing import Optional

from . import db
from .models import SOSReportInput, SOSReportResult, SOSPriorityItem

# Emergency type weights for priority calculation
EMERGENCY_WEIGHTS = {
    "FLOOD": 1.0,
    "EARTHQUAKE": 1.0,
    "TRAPPED": 0.95,
    "MEDICAL": 0.9,
    "ROAD_BLOCKED": 0.7,
    "WATER_SHORTAGE": 0.6,
    "FIRE": 0.9,
    "OTHER": 0.5,
}

VALID_STATUSES = {"NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "PENDING_SYNC"}


def calculate_sos_priority(
    severity: int,
    emergency_type: str,
    people_affected: int,
    medical_emergency: bool,
    total_village_population: int,
    timestamp: str,
) -> float:
    """
    Calculate priority score for an SOS report (0-100 scale).

    Formula:
        priority = severity_weight × 30
                 + type_weight × 20
                 + population_impact × 20
                 + medical_bonus × 15
                 + recency_bonus × 15
    """
    severity_score = (severity / 5.0) * 30

    type_weight = EMERGENCY_WEIGHTS.get(emergency_type, 0.5)
    type_score = type_weight * 20

    if total_village_population > 0:
        impact_ratio = min(people_affected / total_village_population, 1.0)
    else:
        impact_ratio = 0
    population_score = impact_ratio * 20

    medical_score = 15 if medical_emergency else 0

    try:
        report_time = time.mktime(time.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ"))
        hours_ago = (time.time() - report_time) / 3600
        recency_score = max(0, 15 - (hours_ago * 1.5))
    except (ValueError, OverflowError):
        recency_score = 7.5

    total = severity_score + type_score + population_score + medical_score + recency_score
    return round(min(total, 100), 1)


def _generate_report_id(conn) -> str:
    row = conn.execute(
        "SELECT id FROM sos_reports ORDER BY id DESC LIMIT 1"
    ).fetchone()
    n = int(row["id"][3:]) + 1 if row and row["id"].startswith("SOS") else 1
    return f"SOS{n:03d}"


def load_sos_reports() -> list[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute("SELECT * FROM sos_reports ORDER BY priority_score DESC").fetchall()
        reports = [dict(r) for r in rows]
        for r in reports:
            r["medical_emergency"] = bool(r["medical_emergency"])
            r["reached_gateway"] = bool(r["reached_gateway"])
        return reports
    finally:
        conn.close()


def save_sos_reports(reports: list[dict]) -> None:
    """Compatibility shim: reports are persisted to SQLite by add/update
    helpers; this no-op keeps old call sites working."""
    del reports


def get_reports_by_village(village_id: str) -> list[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM sos_reports WHERE village_id=? ORDER BY priority_score DESC",
            (village_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_reports_by_status(status: str) -> list[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM sos_reports WHERE status=? ORDER BY priority_score DESC",
            (status,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def add_sos_report(report: SOSReportInput, village_population: int = 2000) -> SOSReportResult:
    """Persist a new SOS report and return the enriched result."""
    priority = calculate_sos_priority(
        severity=report.severity,
        emergency_type=report.emergency_type,
        people_affected=report.people_affected,
        medical_emergency=report.medical_emergency,
        total_village_population=village_population,
        timestamp=report.timestamp,
    )
    timestamp = report.timestamp or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    conn = db.get_conn()
    try:
        report_id = _generate_report_id(conn)
        conn.execute(
            "INSERT INTO sos_reports (id, reporter_name, reporter_phone, village_id, village_name, "
            "emergency_type, severity, description, people_affected, medical_emergency, medical_details, "
            "latitude, longitude, timestamp, status, priority_score, relay_hops, reached_gateway) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                report_id,
                report.reporter_name,
                report.reporter_phone,
                report.village_id,
                report.village_name,
                report.emergency_type,
                report.severity,
                report.description,
                report.people_affected,
                1 if report.medical_emergency else 0,
                report.medical_details,
                report.latitude,
                report.longitude,
                timestamp,
                "NEW",
                priority,
                0,
                0,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return SOSReportResult(
        id=report_id,
        reporter_name=report.reporter_name,
        reporter_phone=report.reporter_phone,
        village_id=report.village_id,
        village_name=report.village_name,
        emergency_type=report.emergency_type,
        severity=report.severity,
        description=report.description,
        people_affected=report.people_affected,
        medical_emergency=report.medical_emergency,
        medical_details=report.medical_details,
        latitude=report.latitude,
        longitude=report.longitude,
        timestamp=timestamp,
        status="NEW",
        priority_score=priority,
        relay_hops=0,
        reached_gateway=False,
    )


def update_report_status(report_id: str, new_status: str, adjudicated_by: str = None) -> Optional[dict]:
    """Update report status (authority action). Returns the updated report."""
    if new_status.upper() not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'")
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM sos_reports WHERE id=?", (report_id,)).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE sos_reports SET status=?, adjudicated_by=COALESCE(adjudicated_by, ?) WHERE id=?",
            (new_status.upper(), adjudicated_by, report_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM sos_reports WHERE id=?", (report_id,)).fetchone()
        result = dict(updated)
        result["medical_emergency"] = bool(result["medical_emergency"])
        result["reached_gateway"] = bool(result["reached_gateway"])
        return result
    finally:
        conn.close()


def get_priority_queue() -> list[SOSPriorityItem]:
    """Return all active (non-resolved) reports sorted by priority."""
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM sos_reports WHERE status != 'RESOLVED' ORDER BY priority_score DESC"
        ).fetchall()
        return [
            SOSPriorityItem(
                report_id=r["id"],
                village_id=r["village_id"],
                village_name=r["village_name"],
                emergency_type=r["emergency_type"],
                severity=r["severity"],
                people_affected=r["people_affected"],
                medical_emergency=bool(r["medical_emergency"]),
                priority_score=r["priority_score"],
                status=r["status"],
                timestamp=r["timestamp"],
            )
            for r in rows
        ]
    finally:
        conn.close()


def aggregate_by_village() -> dict:
    """Aggregate SOS data per village for Ground Reality scoring."""
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM sos_reports WHERE status != 'RESOLVED' ORDER BY timestamp ASC"
        ).fetchall()
    finally:
        conn.close()

    village_data = {}
    for r in rows:
        vid = r["village_id"]
        if vid not in village_data:
            village_data[vid] = {
                "village_id": vid,
                "village_name": r["village_name"],
                "total_reports": 0,
                "active_reports": 0,
                "total_severity": 0,
                "total_people_affected": 0,
                "medical_emergencies": 0,
                "emergency_types": set(),
                "latest_timestamp": r["timestamp"],
            }
        v = village_data[vid]
        v["total_reports"] += 1
        v["active_reports"] += 1
        v["total_severity"] += r["severity"]
        v["total_people_affected"] += r["people_affected"]
        if r["medical_emergency"]:
            v["medical_emergencies"] += 1
        v["emergency_types"].add(r["emergency_type"])
        if r["timestamp"] > v["latest_timestamp"]:
            v["latest_timestamp"] = r["timestamp"]

    for v in village_data.values():
        v["emergency_types"] = list(v["emergency_types"]) if v["emergency_types"] else []
        v["avg_severity"] = round(v["total_severity"] / max(v["total_reports"], 1), 1)

    return village_data
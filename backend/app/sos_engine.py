"""
SOS Engine
===========

Processes citizen-submitted SOS reports (no account required), calculates
priority scores, persists them to PostgreSQL, and provides aggregation by village.

The PostgreSQL store replaces the old JSON file: reports now survive restarts and
are the feed for both the ground-reality scoring and the learning engine.
"""

import json
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


# Default in-memory demo records for resilient fallback
_IN_MEMORY_REPORTS: list[dict] = [
    {
        "id": "SOS001",
        "reporter_name": "Demo Resident (Amrapur)",
        "reporter_phone": "",
        "village_id": "V008",
        "village_name": "Amrapur",
        "emergency_type": "FLOOD",
        "severity": 4,
        "description": "Demo record: water levels rising near stream bank.",
        "people_affected": 60,
        "medical_emergency": False,
        "medical_details": "",
        "latitude": 30.203,
        "longitude": 78.46,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 7200)),
        "status": "NEW",
        "priority_score": 75.0,
        "relay_hops": 0,
        "reached_gateway": True,
        "transmission_channel": "TERRESTRIAL",
        "sat_terminal_id": "",
        "sat_constellation": "",
        "sat_latency_ms": 0.0,
        "sat_signal_dbhz": 0.0,
        "raw_sat_packet": "",
        "adjudicated_by": None,
        "adjudicated_at": None,
    },
    {
        "id": "SOS002",
        "reporter_name": "Demo Resident (Sundarpur)",
        "reporter_phone": "",
        "village_id": "V001",
        "village_name": "Sundarpur",
        "emergency_type": "ROAD_BLOCKED",
        "severity": 3,
        "description": "Demo record: landslide debris blocking main approach road.",
        "people_affected": 0,
        "medical_emergency": False,
        "medical_details": "",
        "latitude": 30.121,
        "longitude": 78.451,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600)),
        "status": "NEW",
        "priority_score": 60.0,
        "relay_hops": 0,
        "reached_gateway": True,
        "transmission_channel": "TERRESTRIAL",
        "sat_terminal_id": "",
        "sat_constellation": "",
        "sat_latency_ms": 0.0,
        "sat_signal_dbhz": 0.0,
        "raw_sat_packet": "",
        "adjudicated_by": None,
        "adjudicated_at": None,
    },
    {
        "id": "SOS003",
        "reporter_name": "Demo Resident (Nandagaon)",
        "reporter_phone": "",
        "village_id": "V006",
        "village_name": "Nandagaon",
        "emergency_type": "MEDICAL",
        "severity": 5,
        "description": "Demo record: medical access request.",
        "people_affected": 2,
        "medical_emergency": True,
        "medical_details": "Critical oxygen requirement",
        "latitude": 30.188,
        "longitude": 78.418,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 1800)),
        "status": "NEW",
        "priority_score": 92.5,
        "relay_hops": 0,
        "reached_gateway": True,
        "transmission_channel": "TERRESTRIAL",
        "sat_terminal_id": "",
        "sat_constellation": "",
        "sat_latency_ms": 0.0,
        "sat_signal_dbhz": 0.0,
        "raw_sat_packet": "",
        "adjudicated_by": None,
        "adjudicated_at": None,
    },
]


def _generate_report_id(conn=None) -> str:
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT id FROM sos_reports ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
            n = int(row["id"][3:]) + 1 if row and row["id"].startswith("SOS") else 1
            return f"SOS{n:03d}"
        except Exception:
            pass
    # Fallback using in-memory list
    return f"SOS{len(_IN_MEMORY_REPORTS) + 1:03d}"


def load_sos_reports() -> list[dict]:
    try:
        conn = db.get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM sos_reports ORDER BY priority_score DESC")
            rows = cur.fetchall()
            reports = [dict(r) for r in rows]
            for r in reports:
                r["medical_emergency"] = bool(r["medical_emergency"])
                r["reached_gateway"] = bool(r["reached_gateway"])
                r["transmission_channel"] = r.get("transmission_channel") or "TERRESTRIAL"
                r["sat_terminal_id"] = r.get("sat_terminal_id") or ""
                r["sat_constellation"] = r.get("sat_constellation") or ""
                r["sat_latency_ms"] = float(r.get("sat_latency_ms") or 0.0)
                r["sat_signal_dbhz"] = float(r.get("sat_signal_dbhz") or 0.0)
                r["raw_sat_packet"] = r.get("raw_sat_packet") or ""
            return reports
        finally:
            conn.close()
    except Exception:
        # Fallback to in-memory store
        return sorted(_IN_MEMORY_REPORTS, key=lambda x: x.get("priority_score", 0), reverse=True)


def save_sos_reports(reports: list[dict]) -> None:
    """Compatibility shim: reports are persisted to PostgreSQL by add/update
    helpers; this no-op keeps old call sites working."""
    del reports


def get_reports_by_village(village_id: str) -> list[dict]:
    all_reports = load_sos_reports()
    return [r for r in all_reports if r.get("village_id") == village_id]


def get_reports_by_status(status: str) -> list[dict]:
    all_reports = load_sos_reports()
    return [r for r in all_reports if r.get("status") == status]


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

    channel = getattr(report, "transmission_channel", "TERRESTRIAL") or "TERRESTRIAL"
    sat_terminal = getattr(report, "sat_terminal_id", "") or ""
    sat_const = getattr(report, "sat_constellation", "") or ""
    sat_latency = float(getattr(report, "sat_latency_ms", 0.0) or 0.0)
    sat_signal = float(getattr(report, "sat_signal_dbhz", 0.0) or 0.0)
    raw_packet = getattr(report, "raw_sat_packet", "") or ""

    report_id = None
    try:
        conn = db.get_conn()
        try:
            report_id = _generate_report_id(conn)
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO sos_reports (id, reporter_name, reporter_phone, village_id, village_name, "
                "emergency_type, severity, description, people_affected, medical_emergency, medical_details, "
                "latitude, longitude, timestamp, status, priority_score, relay_hops, reached_gateway, "
                "transmission_channel, sat_terminal_id, sat_constellation, sat_latency_ms, sat_signal_dbhz, raw_sat_packet) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
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
                    1 if channel == "SATELLITE" else 0,
                    channel,
                    sat_terminal,
                    sat_const,
                    sat_latency,
                    sat_signal,
                    raw_packet,
                ),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        # Fallback to memory
        if not report_id:
            report_id = _generate_report_id()

    # Also keep in-memory cache synchronized
    in_mem_item = {
        "id": report_id,
        "reporter_name": report.reporter_name,
        "reporter_phone": report.reporter_phone,
        "village_id": report.village_id,
        "village_name": report.village_name,
        "emergency_type": report.emergency_type,
        "severity": report.severity,
        "description": report.description,
        "people_affected": report.people_affected,
        "medical_emergency": report.medical_emergency,
        "medical_details": report.medical_details,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "timestamp": timestamp,
        "status": "NEW",
        "priority_score": priority,
        "relay_hops": 0,
        "reached_gateway": True,
        "transmission_channel": channel,
        "sat_terminal_id": sat_terminal,
        "sat_constellation": sat_const,
        "sat_latency_ms": sat_latency,
        "sat_signal_dbhz": sat_signal,
        "raw_sat_packet": raw_packet,
        "adjudicated_by": None,
        "adjudicated_at": None,
    }
    _IN_MEMORY_REPORTS.insert(0, in_mem_item)

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
        reached_gateway=True,
        transmission_channel=channel,
        sat_terminal_id=sat_terminal,
        sat_constellation=sat_const,
        sat_latency_ms=sat_latency,
        sat_signal_dbhz=sat_signal,
        raw_sat_packet=raw_packet,
    )


def update_report_status(report_id: str, new_status: str, adjudicated_by: str = None) -> Optional[dict]:
    """Update report status (authority action). Returns the updated report."""
    if new_status.upper() not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'")
    
    # Update in-memory copy
    for r in _IN_MEMORY_REPORTS:
        if r["id"] == report_id:
            r["status"] = new_status.upper()
            if adjudicated_by:
                r["adjudicated_by"] = adjudicated_by

    try:
        conn = db.get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM sos_reports WHERE id=%s", (report_id,))
            row = cur.fetchone()
            if not row:
                return next((r for r in _IN_MEMORY_REPORTS if r["id"] == report_id), None)
            cur.execute(
                "UPDATE sos_reports SET status=%s, adjudicated_by=COALESCE(adjudicated_by, %s) WHERE id=%s",
                (new_status.upper(), adjudicated_by, report_id),
            )
            conn.commit()
            cur.execute("SELECT * FROM sos_reports WHERE id=%s", (report_id,))
            updated = cur.fetchone()
            result = dict(updated)
            result["medical_emergency"] = bool(result["medical_emergency"])
            result["reached_gateway"] = bool(result["reached_gateway"])
            return result
        finally:
            conn.close()
    except Exception:
        return next((r for r in _IN_MEMORY_REPORTS if r["id"] == report_id), None)


def get_priority_queue() -> list[SOSPriorityItem]:
    """Return all active (non-resolved) reports sorted by priority."""
    all_reports = load_sos_reports()
    active = [r for r in all_reports if r.get("status") != "RESOLVED"]
    active.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
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
            transmission_channel=r.get("transmission_channel", "TERRESTRIAL"),
        )
        for r in active
    ]


def aggregate_by_village() -> dict:
    """Aggregate SOS data per village for Ground Reality scoring."""
    all_reports = load_sos_reports()
    rows = [r for r in all_reports if r.get("status") != "RESOLVED"]
    rows.sort(key=lambda x: x.get("timestamp", ""))

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


# ---------------------------------------------------------------------------
# LifeLink Mesh — Store-Carry-Forward queue
# ---------------------------------------------------------------------------

def register_mesh_node(node: dict) -> None:
    """Register or update a mesh node."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mesh_nodes (node_id, device_id, battery_level, connectivity_score, "
            "role, latitude, longitude, last_seen, is_active, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (node_id) DO UPDATE SET "
            "device_id=excluded.device_id, battery_level=excluded.battery_level, "
            "connectivity_score=excluded.connectivity_score, role=excluded.role, "
            "latitude=excluded.latitude, longitude=excluded.longitude, "
            "last_seen=excluded.last_seen, is_active=excluded.is_active, "
            "updated_at=excluded.updated_at",
            (node["node_id"], node["device_id"], node.get("battery_level", 100),
             node.get("connectivity_score", 0), node.get("role", "USER"),
             node.get("latitude"), node.get("longitude"), node.get("last_seen", ""),
             1 if node.get("is_active", True) else 0,
             time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        )
        conn.commit()
    finally:
        conn.close()


def queue_mesh_packet(packet: dict) -> None:
    """Queue a mesh packet for store-carry-forward routing."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mesh_packets (packet_id, source_node_id, destination_node_id, "
            "message_type, priority, payload, ttl, hop_count, relay_path, encrypted, "
            "timestamp, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (packet_id) DO UPDATE SET "
            "status=excluded.status, hop_count=excluded.hop_count, "
            "relay_path=excluded.relay_path, timestamp=excluded.timestamp",
            (packet["packet_id"], packet["source_node_id"], packet["destination_node_id"],
             packet.get("message_type", "SOS"), packet.get("priority", "MEDIUM"),
             json.dumps(packet.get("payload", {})), packet.get("ttl", 10),
             packet.get("hop_count", 0), json.dumps(packet.get("relay_path", [])),
             1 if packet.get("encrypted", True) else 0,
             packet.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
             packet.get("status", "PENDING")),
        )
        conn.commit()
    finally:
        conn.close()


def get_packets_for_node(node_id: str, max_packets: int = 50) -> list[dict]:
    """Get packets destined for a node, ordered by priority."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM mesh_packets WHERE destination_node_id=%s AND status IN ('PENDING', 'IN_TRANSIT') "
            "ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, timestamp ASC LIMIT %s",
            (node_id, max_packets),
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_active_nodes() -> list[dict]:
    """Get all active mesh nodes sorted by battery and connectivity."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM mesh_nodes WHERE is_active=1 ORDER BY battery_level DESC, connectivity_score DESC"
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

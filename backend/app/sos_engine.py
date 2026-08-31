"""
SOS Engine
==========

Processes citizen-submitted SOS reports, calculates priority scores,
and provides aggregation by village.
"""

import json
import time
from pathlib import Path
from typing import Optional

from .models import SOSReportInput, SOSReportResult, SOSPriorityItem

DATA_DIR = Path(__file__).parent / "data"

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
    # Severity (1-5) mapped to 0-30
    severity_score = (severity / 5.0) * 30

    # Emergency type weight mapped to 0-20
    type_weight = EMERGENCY_WEIGHTS.get(emergency_type, 0.5)
    type_score = type_weight * 20

    # Population impact: ratio of affected to total, mapped to 0-20
    if total_village_population > 0:
        impact_ratio = min(people_affected / total_village_population, 1.0)
    else:
        impact_ratio = 0
    population_score = impact_ratio * 20

    # Medical emergency bonus: 0 or 15
    medical_score = 15 if medical_emergency else 0

    # Recency bonus: more recent = higher score (0-15)
    try:
        report_time = time.mktime(time.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ"))
        hours_ago = (time.time() - report_time) / 3600
        recency_score = max(0, 15 - (hours_ago * 1.5))
    except (ValueError, OverflowError):
        recency_score = 7.5

    total = severity_score + type_score + population_score + medical_score + recency_score
    return round(min(total, 100), 1)


def load_sos_reports() -> list[dict]:
    path = DATA_DIR / "sos_reports.json"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_sos_reports(reports: list[dict]) -> None:
    path = DATA_DIR / "sos_reports.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)


def add_sos_report(report: SOSReportInput, village_population: int = 2000) -> SOSReportResult:
    """Add a new SOS report and return the enriched result."""
    reports = load_sos_reports()
    report_id = f"SOS{len(reports) + 1:03d}"

    priority = calculate_sos_priority(
        severity=report.severity,
        emergency_type=report.emergency_type,
        people_affected=report.people_affected,
        medical_emergency=report.medical_emergency,
        total_village_population=village_population,
        timestamp=report.timestamp,
    )

    new_report = {
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
        "timestamp": report.timestamp,
        "status": "NEW",
        "priority_score": priority,
        "relay_hops": 0,
        "reached_gateway": False,
    }

    reports.append(new_report)
    save_sos_reports(reports)

    return SOSReportResult(**new_report)


def get_reports_by_village(village_id: str) -> list[dict]:
    reports = load_sos_reports()
    return [r for r in reports if r["village_id"] == village_id]


def get_reports_by_status(status: str) -> list[dict]:
    reports = load_sos_reports()
    return [r for r in reports if r["status"] == status]


def update_report_status(report_id: str, new_status: str) -> Optional[dict]:
    reports = load_sos_reports()
    for r in reports:
        if r["id"] == report_id:
            r["status"] = new_status
            save_sos_reports(reports)
            return r
    return None


def get_priority_queue() -> list[SOSPriorityItem]:
    """Return all active (non-resolved) reports sorted by priority."""
    reports = load_sos_reports()
    active = [r for r in reports if r["status"] != "RESOLVED"]
    active.sort(key=lambda r: r["priority_score"], reverse=True)

    return [
        SOSPriorityItem(
            report_id=r["id"],
            village_id=r["village_id"],
            village_name=r["village_name"],
            emergency_type=r["emergency_type"],
            severity=r["severity"],
            people_affected=r["people_affected"],
            medical_emergency=r["medical_emergency"],
            priority_score=r["priority_score"],
            status=r["status"],
            timestamp=r["timestamp"],
        )
        for r in active
    ]


def aggregate_by_village() -> dict:
    """Aggregate SOS data per village for Ground Reality scoring."""
    reports = load_sos_reports()
    village_data = {}

    for r in reports:
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
        if r["status"] != "RESOLVED":
            v["active_reports"] += 1
        v["total_severity"] += r["severity"]
        v["total_people_affected"] += r["people_affected"]
        if r["medical_emergency"]:
            v["medical_emergencies"] += 1
        v["emergency_types"].add(r["emergency_type"])
        if r["timestamp"] > v["latest_timestamp"]:
            v["latest_timestamp"] = r["timestamp"]

    # Convert sets to lists for JSON serialization
    for v in village_data.values():
        v["emergency_types"] = list(v["emergency_types"])
        v["avg_severity"] = round(v["total_severity"] / max(v["total_reports"], 1), 1)

    return village_data

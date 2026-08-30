"""
Ground Reality Engine
=====================

Combines the predicted risk score from the Risk Engine with real-time
citizen field reports (SOS data) to produce a Dynamic Ground Reality Score
and an Operational Priority ranking.

    Operational Priority = a x Predicted Risk
                        + b x SOS Intensity
                        + c x Report Density
                        + d x Severity Aggregate
                        + e x Medical Urgency
"""

from .models import VillageInput, GroundRealityResult, OperationalPriorityItem
from .sos_engine import aggregate_by_village, load_sos_reports
from .risk_engine import calculate_risk

# Weights for the combined scoring formula
ALPHA = 0.35   # Weight for predicted risk score
BETA = 0.25    # Weight for SOS intensity
GAMMA = 0.15   # Weight for report density
DELTA = 0.15   # Weight for severity aggregate
EPSILON = 0.10 # Weight for medical urgency


def calculate_sos_intensity(active_reports: int) -> float:
    """
    Map number of active reports to a 0-100 intensity score.
    0 reports = 0, 10+ reports = 100.
    """
    return min(active_reports * 10, 100)


def calculate_report_density(total_reports: int, people_affected: int) -> float:
    """
    Density based on total reports and people affected.
    Normalized to 0-100 scale.
    """
    report_score = min(total_reports * 12, 60)
    people_score = min(people_affected / 50, 40)
    return min(report_score + people_score, 100)


def calculate_severity_aggregate(avg_severity: float) -> float:
    """Map average severity (1-5) to 0-100."""
    return (avg_severity / 5.0) * 100


def calculate_medical_urgency(medical_emergencies: int, active_reports: int) -> float:
    """Medical urgency score based on proportion of medical emergencies."""
    if active_reports == 0:
        return 0
    ratio = medical_emergencies / active_reports
    return ratio * 100


def compute_ground_reality(villages: list[VillageInput]) -> list[GroundRealityResult]:
    """
    For each village, compute the Ground Reality Score by combining
    the predicted risk score with SOS field report data.
    """
    village_sos = aggregate_by_village()
    results = []

    for v in villages:
        # Get predicted risk score
        risk_score, risk_level, explanation, breakdown = calculate_risk(v)

        # Get SOS data for this village
        sos_data = village_sos.get(v.id, {
            "total_reports": 0,
            "active_reports": 0,
            "total_severity": 0,
            "total_people_affected": 0,
            "medical_emergencies": 0,
            "emergency_types": [],
            "avg_severity": 0,
        })

        # Calculate individual components
        sos_intensity = calculate_sos_intensity(sos_data["active_reports"])
        report_density = calculate_report_density(
            sos_data["total_reports"], sos_data["total_people_affected"]
        )
        severity_agg = calculate_severity_aggregate(sos_data["avg_severity"])
        medical_urg = calculate_medical_urgency(
            sos_data["medical_emergencies"], sos_data["active_reports"]
        )

        # Combined Ground Reality Score
        ground_score = round(
            ALPHA * risk_score
            + BETA * sos_intensity
            + GAMMA * report_density
            + DELTA * severity_agg
            + EPSILON * medical_urg,
            1,
        )
        ground_score = min(ground_score, 100)

        # Operational Priority classification
        if ground_score >= 85:
            priority_label = "IMMEDIATE"
        elif ground_score >= 70:
            priority_label = "URGENT"
        elif ground_score >= 50:
            priority_label = "HIGH"
        elif ground_score >= 30:
            priority_label = "MODERATE"
        else:
            priority_label = "LOW"

        results.append(GroundRealityResult(
            village_id=v.id,
            village_name=v.name,
            latitude=v.latitude,
            longitude=v.longitude,
            population=v.population,
            predicted_risk_score=risk_score,
            predicted_risk_level=risk_level,
            sos_intensity=round(sos_intensity, 1),
            report_density=round(report_density, 1),
            severity_aggregate=round(severity_agg, 1),
            medical_urgency=round(medical_urg, 1),
            ground_reality_score=ground_score,
            operational_priority=priority_label,
            total_sos_reports=sos_data["total_reports"],
            active_sos_reports=sos_data["active_reports"],
            people_affected_by_sos=sos_data["total_people_affected"],
            medical_emergencies=sos_data["medical_emergencies"],
            emergency_types=sos_data["emergency_types"],
            risk_breakdown=breakdown,
            explanation=explanation,
        ))

    # Sort by ground reality score descending
    results.sort(key=lambda r: r.ground_reality_score, reverse=True)
    return results


def get_operational_priority_list(villages: list[VillageInput]) -> list[OperationalPriorityItem]:
    """Get villages ranked by operational priority for response teams."""
    ground_results = compute_ground_reality(villages)

    return [
        OperationalPriorityItem(
            village_id=r.village_id,
            village_name=r.village_name,
            predicted_risk=r.predicted_risk_score,
            ground_reality_score=r.ground_reality_score,
            operational_priority=r.operational_priority,
            active_sos_reports=r.active_sos_reports,
            people_affected=r.people_affected_by_sos,
            medical_emergencies=r.medical_emergencies,
            population=r.population,
        )
        for r in ground_results
        if r.active_sos_reports > 0 or r.predicted_risk_score >= 60
    ]

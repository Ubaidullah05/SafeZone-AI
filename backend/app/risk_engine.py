"""
Risk Engine
===========

Converts raw hazard/exposure factors for a habitation into an explainable
0-100 Risk Score and a Risk Level (SAFE / MODERATE / HIGH / CRITICAL).

Architecture note (see spec section 34 - Optional ML Hook):

    RiskEngine
     |- WeightedRiskModel   <- implemented, used for the MVP
     `- MLModel (future)    <- not implemented; a model that exposes the same
                               `.score(village) -> float` interface could be
                               swapped in without touching any downstream
                               engine (vulnerability/relocation/capacity).

Every weight is a named constant so the scoring model can be tuned or
replaced without touching calculation logic elsewhere.
"""

from .models import VillageInput, RiskBreakdown

# Weighted formula (spec section 11) - kept as named constants on purpose.
WEIGHT_HAZARD_SEVERITY = 0.30
WEIGHT_SLOPE_RISK = 0.20
WEIGHT_POPULATION_EXPOSURE = 0.15
WEIGHT_ACCESSIBILITY_RISK = 0.15
WEIGHT_FACILITY_ACCESS_RISK = 0.10
WEIGHT_HISTORICAL_EVENT_RISK = 0.10

# Risk level thresholds (spec section 11)
THRESHOLD_SAFE_MAX = 30
THRESHOLD_MODERATE_MAX = 60
THRESHOLD_HIGH_MAX = 80
# anything above THRESHOLD_HIGH_MAX is CRITICAL


class WeightedRiskModel:
    """The MVP risk model: a transparent, auditable weighted sum."""

    def score(self, village: VillageInput) -> float:
        raw = (
            WEIGHT_HAZARD_SEVERITY * village.hazard_severity
            + WEIGHT_SLOPE_RISK * village.slope_risk
            + WEIGHT_POPULATION_EXPOSURE * village.population_exposure
            + WEIGHT_ACCESSIBILITY_RISK * village.accessibility_risk
            + WEIGHT_FACILITY_ACCESS_RISK * village.facility_access_risk
            + WEIGHT_HISTORICAL_EVENT_RISK * village.historical_event_risk
        )
        return round(min(max(raw, 0), 100), 1)


def classify_risk_level(risk_score: float) -> str:
    if risk_score <= THRESHOLD_SAFE_MAX:
        return "SAFE"
    if risk_score <= THRESHOLD_MODERATE_MAX:
        return "MODERATE"
    if risk_score <= THRESHOLD_HIGH_MAX:
        return "HIGH"
    return "CRITICAL"


def build_risk_breakdown(village: VillageInput) -> RiskBreakdown:
    return RiskBreakdown(
        hazard_severity=village.hazard_severity,
        slope_risk=village.slope_risk,
        population_exposure=village.population_exposure,
        accessibility_risk=village.accessibility_risk,
        facility_access_risk=village.facility_access_risk,
        historical_event_risk=village.historical_event_risk,
    )


def generate_risk_explanation(village: VillageInput, risk_level: str) -> list[str]:
    """
    Produces a factual, trace-back-able explanation of WHY a village received
    its risk level. Never invents reasons unrelated to the actual inputs
    (spec section 12).
    """
    reasons = []

    if village.hazard_severity >= 70:
        reasons.append("High hazard exposure")
    elif village.hazard_severity >= 40:
        reasons.append("Moderate hazard exposure")

    if village.slope_risk >= 70:
        reasons.append("Steep terrain / high slope risk")

    if village.population_exposure >= 60:
        reasons.append("Significant population exposure")

    if village.accessibility_risk >= 60:
        reasons.append("Poor emergency accessibility")
    elif village.accessibility_risk >= 40:
        reasons.append("Limited emergency accessibility")

    if village.facility_access_risk >= 50:
        reasons.append("Limited access to critical facilities")

    if village.historical_event_risk >= 60:
        reasons.append("Strong history of past hazard events")

    if not reasons:
        reasons.append("All contributing risk factors are within safe range")

    return reasons


_model = WeightedRiskModel()


def calculate_risk(village: VillageInput) -> tuple[float, str, list[str], RiskBreakdown]:
    """Convenience entry point used by the rest of the backend."""
    risk_score = _model.score(village)
    risk_level = classify_risk_level(risk_score)
    explanation = generate_risk_explanation(village, risk_level)
    breakdown = build_risk_breakdown(village)
    return risk_score, risk_level, explanation, breakdown

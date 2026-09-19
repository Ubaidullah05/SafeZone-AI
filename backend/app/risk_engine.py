"""
Risk Engine
===========

Converts raw hazard/exposure factors for a habitation into an explainable
0-100 Risk Score and a Risk Level (SAFE / MODERATE / HIGH / CRITICAL).

Upgrade note (Naithani et al., 2019 - multi-parametric micro-level
vulnerability for Uttarakhand):
  * the model is a transparent weighted composite of six indicators,
  * weights start from the published/AHP-derived prior set but are ADAPTIVE:
    they are updated online by the Learning Engine as authorities adjudicate
    real SOS events (learns from real-time data),
  * every score carries an explanation listing the driving factors and a
    confidence value proportional to the evidence seen so far.

The `score()` interface stays stable so an ML model exposing the same
`.score(village)` contract could be swapped in later without changing any
downstream engine.
"""

from .learning_engine import get_adaptive_weights, model_confidence
from .models import VillageInput, RiskBreakdown

# Fallback constants (only used before first learning-state read)
DEFAULT_WEIGHT_HAZARD_SEVERITY = 0.30
DEFAULT_WEIGHT_SLOPE_RISK = 0.20
DEFAULT_WEIGHT_POPULATION_EXPOSURE = 0.15
DEFAULT_WEIGHT_ACCESSIBILITY_RISK = 0.15
DEFAULT_WEIGHT_FACILITY_ACCESS_RISK = 0.10
DEFAULT_WEIGHT_HISTORICAL_EVENT_RISK = 0.10

# Risk level thresholds (spec section 11)
THRESHOLD_SAFE_MAX = 30
THRESHOLD_MODERATE_MAX = 60
THRESHOLD_HIGH_MAX = 80
# anything above THRESHOLD_HIGH_MAX is CRITICAL

WEIGHT_KEY = {
    "hazard_severity": "hazard_severity",
    "slope_risk": "slope_risk",
    "population_exposure": "population_exposure",
    "accessibility_risk": "accessibility_risk",
    "facility_access_risk": "facility_access_risk",
    "historical_event_risk": "historical_event_risk",
}


def _to_weight_key(factor: str) -> str:
    return WEIGHT_KEY[factor]


class WeightedRiskModel:
    """The MVP risk model: a transparent, adaptable weighted composite.

    Weights are read from the Learning Engine's posterior (which the weight
    bank initialises to the AHP-style prior). Callers may pass an explicit
    weight override dict for scenario testing.
    """

    def score(self, village: VillageInput, weights: dict = None) -> float:
        if weights is None:
            weights = get_adaptive_weights()
        raw = (
            weights.get("hazard_severity", DEFAULT_WEIGHT_HAZARD_SEVERITY) * village.hazard_severity
            + weights.get("slope_risk", DEFAULT_WEIGHT_SLOPE_RISK) * village.slope_risk
            + weights.get("population_exposure", DEFAULT_WEIGHT_POPULATION_EXPOSURE) * village.population_exposure
            + weights.get("accessibility_risk", DEFAULT_WEIGHT_ACCESSIBILITY_RISK) * village.accessibility_risk
            + weights.get("facility_access_risk", DEFAULT_WEIGHT_FACILITY_ACCESS_RISK) * village.facility_access_risk
            + weights.get("historical_event_risk", DEFAULT_WEIGHT_HISTORICAL_EVENT_RISK) * village.historical_event_risk
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


def generate_risk_explanation(village: VillageInput, risk_level: str, weights: dict = None) -> list[str]:
    """
    Produces a factual, trace-back-able explanation of WHY a village received
    its risk level, including the most dominant weighted contributors so the
    reasoning is auditable.
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

    # Top contributors by weighted influence (auditability).
    if weights:
        contributors = sorted(
            ((weights.get(k, 0.0) * getattr(village, k, 0.0), k) for k in WEIGHT_KEY),
            reverse=True,
        )[:2]
        top = ", ".join(k.replace("_", " ").title() for _, k in contributors if _ > 5)
        if top:
            reasons.append(f"Top driver(s): {top}")
    return reasons


_model = WeightedRiskModel()


def current_risk_weights() -> dict:
    """Expose the active adaptive weight set (for UI + audit)."""
    return get_adaptive_weights()


def calculate_risk(village: VillageInput) -> tuple[float, str, list[str], RiskBreakdown]:
    """Convenience entry point used by the rest of the backend."""
    weights = get_adaptive_weights()
    risk_score = _model.score(village, weights)
    risk_level = classify_risk_level(risk_score)
    explanation = generate_risk_explanation(village, risk_level, weights)
    breakdown = build_risk_breakdown(village)
    return risk_score, risk_level, explanation, breakdown


def calculate_risk_with_confidence(village: VillageInput) -> dict:
    """Risk + learning-model confidence for advisory/reasoning output."""
    risk_score, risk_level, explanation, breakdown = calculate_risk(village)
    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "explanation": explanation,
        "risk_breakdown": breakdown,
        "confidence": model_confidence(),
    }
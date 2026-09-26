"""
Event corpus builder
====================

Generates `app/data/backtest/event_corpus.json` - the labelled training corpus
used to seed the learning engine.

Two kinds of evidence, distinguished by `provenance` and never conflated:

  * `documented` - the six real locations from the Kedarnath 2013 flash-flood
    fixture, whose own `source` field states they are an "illustrative
    reconstruction ... NOT official measurements". Carried through unchanged so
    the corpus keeps that caveat attached.

  * `derived` - synthetic vignettes built on a CROSSED DESIGN. See below.

Why the previous design failed
------------------------------
v1.0 built each derived scenario by blending a hazard zone's severity into a
village's own factor values. That could never work, because the factors in
`villages.json` are almost perfectly correlated with EACH OTHER:

    hazard <-> slope            r = +0.99
    accessibility <-> facility  r = +0.99
    hazard <-> historical       r = +0.97

Every dangerous village is dangerous in every dimension at once (V008 scores
95/92/88/80/70/85; V010 scores 18/15/12/10/12/8). When all factors move
together, NO choice of severities can reveal which one drove the outcome. That
is why v1.0 produced access r=0.14: the access-specific scenarios it built
still inherited the collinearity from the village data.

The crossed design
------------------
Each derived event draws its six factors INDEPENDENTLY, then computes severity
from a declared causal model (CAUSAL_WEIGHTS below). The factors no longer move
as a bundle, so the engine can actually isolate them.

This is an ordinary designed experiment: you cross the inputs on purpose so the
effect of each one is measurable.

The declared ground truth
-------------------------
CAUSAL_WEIGHTS is an ASSUMPTION WE CHOSE, not a discovered fact about
Uttarakhand. We assert that in hill disasters, getting to and from a village
and reaching a medical facility decide the human outcome as much as the hazard
itself. The three non-causal factors are deliberate CONTROLS: they vary just as
wildly, but must not influence severity.

What the corpus is FOR
----------------------
It is a self-test of the learning pipeline, not a claim about the real world:

  1. The engine should recover the planted ranking (access > facility > hazard).
  2. The engine should report ~0 correlation for the three controls.

Both are asserted in backend/tests/test_historical_learning.py. Recovering a
planted structure is evidence the pipeline works; it is NOT evidence that road
access matters in real disasters. Never present it as the latter.

Run:  python -m scripts.build_event_corpus
"""

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "app" / "data"
INPUTS = DATA / "inputs"
BACKTEST = DATA / "backtest"
OUT = BACKTEST / "event_corpus.json"

FACTORS = [
    "hazard_severity",
    "slope_risk",
    "population_exposure",
    "accessibility_risk",
    "facility_access_risk",
    "historical_event_risk",
]

# --- The declared causal model ---------------------------------------------
# Assumed relative influence on observed severity. The three causal factors
# sum to 1.0; the controls are intentionally absent.
CAUSAL_WEIGHTS = {
    "accessibility_risk": 0.42,
    "facility_access_risk": 0.33,
    "hazard_severity": 0.25,
}
CONTROLS = ["slope_risk", "population_exposure", "historical_event_risk"]

# Factor scores are drawn uniformly across this band for every factor on every
# event, so no factor gets a narrower range than another.
FACTOR_MIN = 10.0
FACTOR_MAX = 95.0

# Fixed seed: the corpus must be byte-reproducible so the recovery tests are
# deterministic and a rebuild produces an auditable diff.
RANDOM_SEED = 20240613

DOC_SOURCE = (
    "Derived scenario from a crossed-design synthetic study. Factor values were "
    "drawn INDEPENDENTLY, not taken from any village's real attributes. NOT an "
    "observed event and NOT a historical record."
)

# Narrative fragments, chosen by which factor is dominant in the event.
NARRATIVE = {
    "accessibility_risk": [
        "Road cut early; medics and supplies took hours to arrive.",
        "Landslide blocked the only approach road; village cut off for days.",
        "Bridge lost. Every supply run had to take a long detour.",
        "Road washed out at the last minute, stranding the village.",
        "Sustained rain kept the pass closed; nothing could get in.",
    ],
    "facility_access_risk": [
        "No functioning clinic within reach; medical cases went unattended.",
        "Nearest hospital 40km away by a broken road; casualties arrived late.",
        "Health centre was itself flooded; no alternative for many hours.",
        "Ambulance could not reach the village before nightfall.",
        "Only first aid available locally; severe cases had to wait for evac.",
    ],
    "hazard_severity": [
        "Floodwater rose well above normal; ground floors inundated.",
        "GLOF-style surge; the channel jumped its banks entirely.",
        "Widespread flooding across the whole settlement.",
        "Severe inundation; most homes affected.",
        "Water levels far beyond anything recorded locally.",
    ],
}

# Descriptive fragments for the CONTROL factors. These are NOT used to explain
# severity, because the causal model denies that controls affect it. They are
# kept only so a reviewer can see that a control was high on an event whose
# outcome the model still refused to attribute to it.
CONTROL_CONTEXT = {
    "slope_risk": "steep, landslide-prone ground",
    "population_exposure": "a densely settled area",
    "historical_event_risk": "a repeat-event hotspot",
}

# Every causal factor must have narrative fragments, and no control may have any.
# A control with narrative text would reintroduce the causal claim we deny.
assert set(NARRATIVE) == set(CAUSAL_WEIGHTS), (
    "narrative fragments must exist for exactly the causal factors; "
    f"got {sorted(NARRATIVE)} vs {sorted(CAUSAL_WEIGHTS)}"
)

MILD_OUTCOMES = [
    "Minor damage only; no injuries and life continued normally.",
    "Shallow water in the lower ward; crops damaged, no casualties.",
    "Some inconvenience, but the village recovered within a day.",
    "Limited disruption; aid arrived the same day.",
    "Cosmetic damage; no evacuation needed.",
]

# Severity band boundaries in weighted-score space. FACTORS sum through
# CAUSAL_WEIGHTS (which total 1.0), so the score lands in roughly the same
# 10-95 band as the factors themselves. These edges map that band onto
# severity 1-5 with a deliberate bias toward the middle, because real impact
# is usually moderate-to-high rather than uniform.
SEVERITY_EDGES = [24.0, 40.0, 56.0, 72.0]


def _severity_for(score: float) -> int:
    """Map a 10-95 weighted score onto severity 1-5."""
    sev = 1
    for edge in SEVERITY_EDGES:
        if score >= edge:
            sev += 1
    return max(1, min(5, sev))


def _load_villages() -> list[dict]:
    return json.loads((DATA / "villages.json").read_text(encoding="utf-8"))


def _load_zones(filename: str) -> list[dict]:
    geo = json.loads((INPUTS / filename).read_text(encoding="utf-8"))
    return [f["properties"] for f in geo["features"]]


def _dominant(factors: dict) -> str:
    """
    The strongest CAUSAL factor in this event.

    Deliberately restricted to the declared causal set. Picking the largest of
    all six factors would let a control (slope, population, historical) be named
    as the "dominant factor" and drive the outcome narrative, which would imply a
    causal claim the corpus explicitly denies. Controls are reported separately as
    `strongest_control` so their influence stays visible without being credited.
    """
    return max(CAUSAL_WEIGHTS, key=lambda f: factors[f])


def _strongest_control(factors: dict) -> str:
    return max(CONTROLS, key=lambda f: factors[f])


def _build_derived(n_events: int) -> list[dict]:
    """
    Crossed-design events: factors drawn independently, severity from the
    declared causal model.

    Villages and zones are attached for narrative continuity only. The factor
    values are NOT read from them - that collinearity is exactly the problem
    this design exists to avoid - and every event says so in `derivation`.
    """
    import random

    rng = random.Random(RANDOM_SEED)
    villages = _load_villages()
    flood_zones = _load_zones("hazard_flood.geojson")
    slide_zones = _load_zones("hazard_landslide.geojson")

    events: list[dict] = []
    for i in range(n_events):
        factors = {f: round(rng.uniform(FACTOR_MIN, FACTOR_MAX), 1) for f in FACTORS}
        score = sum(CAUSAL_WEIGHTS.get(f, 0.0) * factors[f] for f in FACTORS)
        severity = _severity_for(score)

        v = villages[i % len(villages)]
        if i % 2 == 0:
            zone = flood_zones[i % len(flood_zones)]
            hazard_type = "FLOOD"
        else:
            zone = slide_zones[i % len(slide_zones)]
            hazard_type = "LANDSLIDE"

        dom = _dominant(factors)
        control = _strongest_control(factors)
        if severity <= 2:
            # A mild event: the driver factor was low, so the narrative should
            # read as a mild outcome even though other factors look alarming.
            outcome = MILD_OUTCOMES[i % len(MILD_OUTCOMES)]
        else:
            outcome = NARRATIVE[dom][i % len(NARRATIVE[dom])]

        events.append(
            {
                "id": f"XD-{i + 1:03d}",
                "event": f"Crossed-design scenario XD-{i + 1:03d} ({zone['zone']})",
                "date": "",
                "hazard_type": hazard_type,
                "village_id": v["id"],
                "location_name": v["name"],
                "population": v["population"],
                "observed_severity": severity,
                "provenance": "derived",
                "derivation": (
                    f"Crossed-design synthetic vignette. Zone '{zone['zone']}' and "
                    f"village {v['id']} supply NARRATIVE ONLY; all six factor values "
                    f"were drawn independently (seed={RANDOM_SEED}). "
                    f"Causal weights: {json.dumps(CAUSAL_WEIGHTS)}. "
                    f"Controls: {', '.join(CONTROLS)}."
                ),
                "source": DOC_SOURCE,
                "observed_outcome": outcome,
                "dominant_factor": dom,
                "strongest_control": control,
                "control_context": CONTROL_CONTEXT[control],
                "weighted_score": round(score, 2),
                "factors": factors,
            }
        )
    return events


def _build_documented() -> list[dict]:
    """The six Kedarnath 2013 locations, carried through unchanged."""
    fixture = json.loads((BACKTEST / "kedarnath_2013.json").read_text(encoding="utf-8"))
    out = []
    for loc in fixture["locations"]:
        out.append(
            {
                "id": f"KD2013-{loc['id']}",
                "event": "Kedarnath flash flood & GLOF, June 2013",
                "date": fixture["date"],
                "hazard_type": "GLOF",
                "village_id": None,
                "location_name": loc["location_name"],
                "population": loc["population"],
                "observed_severity": loc["observed_severity"],
                "provenance": "documented",
                "derivation": f"Carried from backtest/kedarnath_2013.json ({loc['id']}).",
                "source": fixture["source"],
                "observed_outcome": loc["observed_outcome"],
                "factors": dict(loc["factors"]),
            }
        )
    return out


def build(n_derived: int = 90) -> dict:
    events = _build_documented() + _build_derived(n_derived)

    documented = sum(1 for e in events if e["provenance"] == "documented")
    derived = sum(1 for e in events if e["provenance"] == "derived")
    spread = sorted({e["observed_severity"] for e in events})

    return {
        "corpus": "SafeZone-AI labelled event corpus",
        "version": "2.0",
        "purpose": (
            "Seeds the learning engine so factor weights are evidence-informed "
            "from the first prediction, and provides a SELF-TEST of the learning "
            "pipeline: can the engine recover a planted causal ranking, and does "
            "it correctly report no signal where none exists?"
        ),
        "design": "crossed",
        "causal_weights": CAUSAL_WEIGHTS,
        "control_factors": CONTROLS,
        "honesty_note": (
            "This corpus MIXES two kinds of evidence and keeps them labelled. "
            "'documented' events are the Kedarnath 2013 reconstruction carried "
            "from backtest/kedarnath_2013.json, whose own source field states it "
            "is an illustrative reconstruction and NOT official measurements. "
            "'derived' events are SYNTHETIC vignettes from a crossed design: the "
            "six factors are drawn independently and severity is computed from a "
            "declared causal model. Those declared weights are an ASSUMPTION WE "
            "CHOSE about hill-disaster response - they are NOT a measured fact "
            "about Uttarakhand or anywhere else. Nothing here is a real "
            "historical record, and no government, satellite or IoT feed is used. "
            "This corpus demonstrates that the learning pipeline works; it does "
            "not prove that road access causes disaster outcomes in reality."
        ),
        "why_crossed": (
            "v1.0 blended each village's own factor values, but those values are "
            "near-perfectly correlated with each other (hazard<->slope r=+0.99, "
            "accessibility<->facility r=+0.99). When every factor moves together, "
            "no assignment of severities can reveal which one mattered, so v1.0 "
            "could not separate the factors and access scored only r=0.14. "
            "Crossing the factors makes each one independently measurable."
        ),
        "expected_recovery": (
            "accessibility_risk and facility_access_risk should outrank "
            "hazard_severity; slope_risk, population_exposure and "
            "historical_event_risk are CONTROLS and should show near-zero "
            "correlation. Asserted in tests/test_historical_learning.py."
        ),
        "counts": {
            "documented": documented,
            "derived": derived,
            "total": len(events),
            "severity_bands_present": spread,
        },
        "events": events,
    }


def main() -> int:
    corpus = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(corpus, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    c = corpus["counts"]
    print(f"Wrote {OUT}")
    print(f"  documented: {c['documented']}  derived: {c['derived']}  total: {c['total']}")
    print(f"  severity bands present: {c['severity_bands_present']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

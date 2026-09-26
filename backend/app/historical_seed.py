"""
Historical seeding
==================

Seeds the learning engine from the labelled event corpus so factor weights are
evidence-informed from the very first prediction rather than starting at
hand-set defaults.

Design decisions worth being explicit about:

  * IDEMPOTENT. Every seed run is stamped with the corpus version. Re-running
    the server does not duplicate observations. A corpus change is detected by
    version and re-seeds, so the data can be corrected without manual surgery.

  * NO CONFIDENCE INFLATION. Seeded observations are stored with
    source='historical'. Confidence is computed from LIVE observations only, so
    replaying 33 historical events never makes the model look confident about
    live operations. The historical figure is reported separately as
    `historical_confidence`.

  * PROVENANCE IS PRESERVED. Each observation keeps `documented` or `derived`.
    Nothing derived is ever reported as a real historical record.
"""

import json
import logging
from pathlib import Path

from . import db
from .learning_engine import (
    clear_observations,
    get_adaptive_weights,
    historical_confidence,
    model_confidence,
    observation_count,
    record_observation,
    _invalidate_cache,
)

logger = logging.getLogger(__name__)

DATA = Path(__file__).resolve().parent / "data"
CORPUS_PATH = DATA / "backtest" / "event_corpus.json"

SEED_VERSION = "1.0"
SEED_STATE_KEY = "historical_seed_version"


def load_corpus() -> dict:
    if not CORPUS_PATH.exists():
        logger.warning("No event corpus at %s; skipping historical seed.", CORPUS_PATH)
        return {"version": None, "events": []}
    return json.loads(CORPUS_PATH.read_text(encoding="utf-8"))


def current_seed_version() -> str | None:
    return db.get_state(SEED_STATE_KEY, None)


def seed_if_needed(force: bool = False) -> dict:
    """
    Seed historical observations if the corpus is new or changed.

    Returns a summary dict. Safe to call on every startup.
    """
    corpus = load_corpus()
    version = corpus.get("version")
    events = corpus.get("events") or []

    if not events:
        return {
            "seeded": False,
            "reason": "corpus_missing_or_empty",
            "version": version,
        }

    already = current_seed_version()
    if already == version and not force:
        return {
            "seeded": False,
            "reason": "already_seeded",
            "version": version,
            "n_observations": observation_count("historical"),
        }

    # Clear only historical evidence; live adjudications are never discarded.
    clear_observations(source="historical")

    for e in events:
        record_observation(
            factors=e["factors"],
            observed_severity=int(e["observed_severity"]),
            source="historical",
            provenance=e.get("provenance", "derived"),
            village_id=e.get("village_id"),
            event_ref=e.get("id"),
        )

    db.set_state(SEED_STATE_KEY, version)
    _invalidate_cache()

    counts = corpus.get("counts", {})
    summary = {
        "seeded": True,
        "version": version,
        "n_historical_observations": observation_count("historical"),
        "documented": counts.get("documented"),
        "derived": counts.get("derived"),
        "n_live_observations": observation_count("live"),
        "confidence": model_confidence(),
        "historical_confidence": historical_confidence(),
        "weights": get_adaptive_weights(),
    }
    logger.info(
        "Seeded %s historical observations (corpus %s: %s documented, %s derived). "
        "Live confidence remains %.3f - historical evidence is not counted as "
        "live confidence.",
        summary["n_historical_observations"],
        version,
        summary["documented"],
        summary["derived"],
        summary["confidence"],
    )
    return summary


def reset_learning(keep_corpus_seed: bool = True) -> dict:
    """Official-only reset. Clears learned state so a demo can start clean."""
    clear_observations(source=None)

    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM model_state")
        conn.commit()
    finally:
        conn.close()
    _invalidate_cache()

    summary = {"reset": True, "reseeded": False}
    if keep_corpus_seed:
        summary["seed"] = seed_if_needed(force=True)
        summary["reseeded"] = True
    return summary


def corpus_summary() -> dict:
    """Metadata about the corpus, for the authority panel and docs."""
    corpus = load_corpus()
    counts = corpus.get("counts", {})
    return {
        "version": corpus.get("version"),
        "design": corpus.get("design"),
        # The declared ground truth is an assumption we chose. It is exposed
        # deliberately so a reviewer can see exactly what the corpus asserts
        # rather than having to infer it from the resulting weights.
        "causal_weights": corpus.get("causal_weights"),
        "control_factors": corpus.get("control_factors"),
        "expected_recovery": corpus.get("expected_recovery"),
        "why_crossed": corpus.get("why_crossed"),
        "purpose": corpus.get("purpose"),
        "honesty_note": corpus.get("honesty_note"),
        "counts": counts,
        "seeded_version": current_seed_version(),
    }

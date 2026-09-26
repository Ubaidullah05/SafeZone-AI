"""
Data ingestion script for SafeZone-AI
=====================================

Populates the SQLite database with real Kedarnath region data.

Usage:
    cd backend
    SAFEZONE_DB_PATH=app/data/safezone.db python -m scripts.ingest_data

Or with environment variables:
    SAFEZONE_DB_PATH=/path/to/safezone.db python -m scripts.ingest_data

The script is idempotent — re-running it replaces existing records.
"""

import csv
import json
import sys
from pathlib import Path

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import (
    insert_villages,
    insert_safe_zones,
    get_villages_from_db,
    get_safe_zones_from_db,
    init_db,
)

DATA_DIR = Path(__file__).parent.parent / "app" / "data"
INPUTS_DIR = DATA_DIR / "inputs"


def ingest_villages_from_csv() -> int:
    """Load villages from census_villages.csv and insert into database."""
    csv_path = INPUTS_DIR / "census_villages.csv"
    if not csv_path.exists():
        print(f"  CSV not found: {csv_path}")
        return 0

    villages = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Calculate hazard_severity as weighted average of other risk factors
            # This is a simplified heuristic for the prototype
            weights = {
                "slope_risk": 0.25,
                "accessibility_risk": 0.20,
                "facility_access_risk": 0.15,
                "historical_event_risk": 0.25,
                "population_exposure": 0.15,
            }
            hazard_severity = sum(
                float(row.get(k, 0)) * w for k, w in weights.items()
            )
            hazard_severity = min(100, max(0, round(hazard_severity, 1)))

            villages.append({
                "id": row["id"],
                "name": row["name"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "population": int(row["population"]),
                "hazard_severity": hazard_severity,
                "slope_risk": float(row.get("slope_risk", 0)),
                "population_exposure": float(row.get("population_exposure", 0)),
                "accessibility_risk": float(row.get("accessibility_risk", 0)),
                "facility_access_risk": float(row.get("facility_access_risk", 0)),
                "historical_event_risk": float(row.get("historical_event_risk", 0)),
            })

    if villages:
        count = insert_villages(villages)
        print(f"  Ingested {count} villages from {csv_path.name}")
        return count
    return 0


def ingest_safe_zones_from_json() -> int:
    """Load safe zones from safe_zones.json and insert into database."""
    json_path = DATA_DIR / "safe_zones.json"
    if not json_path.exists():
        print(f"  JSON not found: {json_path}")
        return 0

    with open(json_path, "r", encoding="utf-8") as f:
        zones = json.load(f)

    if zones:
        count = insert_safe_zones(zones)
        print(f"  Ingested {count} safe zones from {json_path.name}")
        return count
    return 0


def ingest_villages_from_json() -> int:
    """Load villages from villages.json and insert into database."""
    json_path = DATA_DIR / "villages.json"
    if not json_path.exists():
        print(f"  JSON not found: {json_path}")
        return 0

    with open(json_path, "r", encoding="utf-8") as f:
        villages = json.load(f)

    if villages:
        count = insert_villages(villages)
        print(f"  Ingested {count} villages from {json_path.name}")
        return count
    return 0


def main():
    print("=" * 60)
    print("SafeZone-AI Data Ingestion")
    print("=" * 60)

    # Ensure database schema exists
    print("\n[1/4] Initializing database schema...")
    init_db()
    print("  Schema ready.")

    # Ingest villages
    print("\n[2/4] Ingesting villages...")
    csv_count = ingest_villages_from_csv()
    if csv_count == 0:
        print("  CSV empty or missing, trying villages.json...")
        ingest_villages_from_json()

    # Ingest safe zones
    print("\n[3/4] Ingesting safe zones...")
    ingest_safe_zones_from_json()

    # Verify
    print("\n[4/4] Verifying...")
    villages = get_villages_from_db()
    zones = get_safe_zones_from_db()
    print(f"  Database now has {len(villages)} villages and {len(zones)} safe zones.")

    print("\n" + "=" * 60)
    print("Ingestion complete!")
    print("Start the server with: SAFEZONE_DEMO_MODE=0 python -m app.main")
    print("=" * 60)


if __name__ == "__main__":
    main()

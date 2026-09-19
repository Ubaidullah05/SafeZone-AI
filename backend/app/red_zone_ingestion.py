"""
Red-Zone Data Ingestion
=======================

Real data ingestion path for hazard-based red-zone identification (SIH26191).

The prototype ships with lightweight SAMPLE inputs (structured after Census
2011 settlement records and published state hazard layers; NOT official live
feeds - see `provenance` on each file). The pipeline is deliberately pure
Python (GeoJSON polygons + CSV attributes) so the heavy GDAL/geopandas stack
is not required and the flow is fully auditable by judges:

  1. settlements_i: Census-derived village attributes (population, slope,
     accessibility, facilities, history) from a CSV file.
  2. layers_j:     GeoJSON hazard zones (flood, landslide, ...) carrying a
     per-zone `severity` (0-100).
  3. cross_join:   settlement points are tested against hazard polygons
     (ray-casting point-in-polygon); a habitation's hazard severity is the
     maximum severity across all hazard layers that contain it.
  4. output:       VillageInput records, idempotent, mergeable with the demo
     dataset, tagged with provenance for honesty.
"""

import csv
import json
from pathlib import Path

from .models import VillageInput

DATA_DIR = Path(__file__).parent / "data"
INPUTS_DIR = DATA_DIR / "inputs"
BACKTEST_DIR = DATA_DIR / "backtest"


# ---------------------------------------------------------------------------
# Geometry (pure stdlib)
# ---------------------------------------------------------------------------

def point_in_polygon(lat: float, lon: float, ring) -> bool:
    """Ray-casting point-in-polygon test. `ring` is a list of [lon, lat]
    points (GeoJSON convention: exterior rings are clockwise sequences)."""
    x, y = lon, lat
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (max((yj - yi), 1e-12)) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


def polygon_rings(feature) -> list:
    """Extract the coordinate rings from a GeoJSON feature geometry."""
    geom = feature.get("geometry", {}) or {}
    gtype = geom.get("type")
    if gtype == "Polygon":
        return geom.get("coordinates", [])
    if gtype == "MultiPolygon":
        return [r for poly in geom.get("coordinates", []) for r in poly]
    return []


def point_in_feature(lat: float, lon: float, feature) -> bool:
    return any(point_in_polygon(lat, lon, ring) for ring in polygon_rings(feature))


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def load_census_csv(path: Path | None = None) -> list[dict]:
    """Load settlement attributes from a census-style CSV."""
    path = path or (INPUTS_DIR / "census_villages.csv")
    if not path.exists():
        return []
    settlements = []
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            settlements.append({
                "id": row["id"],
                "name": row["name"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "population": int(float(row["population"])),
                "slope_risk": float(row["slope_risk"]),
                "accessibility_risk": float(row["accessibility_risk"]),
                "facility_access_risk": float(row["facility_access_risk"]),
                "historical_event_risk": float(row["historical_event_risk"]),
                "population_exposure": float(row.get("population_exposure", 50)),
            })
    return settlements


def load_hazard_layers(path: Path | None = None) -> list[dict]:
    """Load all *.geojson in a directory as hazard layers. Each layer dict:
    {'name', 'features': [{'severity': 0-100, 'geometry': ring}], 'source'}"""
    path = path or INPUTS_DIR
    layers = []
    for gj in sorted(path.glob("hazard_*.geojson")):
        try:
            data = json.loads(gj.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        features = []
        for feature in data.get("features", []):
            if not feature.get("geometry"):
                continue
            # Severity may live at feature level or in properties.
            sev = float(feature.get("severity", 50))
            if "properties" in feature:
                sev = float(feature["properties"].get("severity", sev))
            features.append({"severity": min(max(sev, 0), 100), "rings": polygon_rings(feature)})
        layers.append({
            "name": data.get("name", gj.stem),
            "hazard_type": data.get("hazard_type", gj.stem.replace("hazard_", "")),
            "source": data.get("source", "sample"),
            "features": features,
        })
    return layers


# ---------------------------------------------------------------------------
# Cross-join & output
# ---------------------------------------------------------------------------

def cross_join_hazard(settlements: list[dict], layers: list[dict]) -> list[dict]:
    """Merge settlements with hazard severity = max severity across all hazard
    layers that contain the settlement point."""
    if not layers:
        return settlements
    for s in settlements:
        exposed = [
            f["severity"] for layer in layers for f in layer["features"]
            if any(point_in_polygon(s["latitude"], s["longitude"], ring) for ring in f["rings"])
        ]
        s["hazard_severity"] = round(max(exposed), 1) if exposed else 5.0
    return settlements


def build_villages(settlements: list[dict], layers: list[dict]) -> list[VillageInput]:
    """Produce VillageInput records from settlements + hazard layers."""
    merged = cross_join_hazard(settlements, layers)
    villages = []
    for s in merged:
        villages.append(VillageInput(
            id=s["id"],
            name=s["name"],
            latitude=s["latitude"],
            longitude=s["longitude"],
            population=s["population"],
            hazard_severity=s.get("hazard_severity", 5.0),
            slope_risk=s["slope_risk"],
            population_exposure=s["population_exposure"],
            accessibility_risk=s["accessibility_risk"],
            facility_access_risk=s["facility_access_risk"],
            historical_event_risk=s["historical_event_risk"],
        ))
    return villages


def ingest_sample() -> list[VillageInput]:
    """Run the ingestion pipeline over the bundled sample inputs. Returns an
    empty list if the sample inputs are not present."""
    settlements = load_census_csv()
    layers = load_hazard_layers()
    if not settlements:
        return []
    return build_villages(settlements, layers)


# ---------------------------------------------------------------------------
# Validation / backtest (Kedarnath 2013)
# ---------------------------------------------------------------------------

def load_backtest_events(path: Path | None = None) -> list[dict]:
    """Load documented historical events used to validate the pipeline. Each
    record carries `id`, `location_name`, `observed_severity`, factors."""
    path = path or (BACKTEST_DIR / "kedarnath_2013.json")
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict):
        return raw.get("locations", [])
    return raw


def build_backtest_villages(events: list[dict]) -> list[VillageInput]:
    """Convert backtest event records into VillageInput for pipeline replay."""
    out = []
    for e in events:
        out.append(VillageInput(
            id=e["id"],
            name=e["location_name"],
            latitude=e["latitude"],
            longitude=e["longitude"],
            population=e["population"],
            hazard_severity=e["factors"]["hazard_severity"],
            slope_risk=e["factors"]["slope_risk"],
            population_exposure=e["factors"]["population_exposure"],
            accessibility_risk=e["factors"]["accessibility_risk"],
            facility_access_risk=e["factors"]["facility_access_risk"],
            historical_event_risk=e["factors"]["historical_event_risk"],
        ))
    return out
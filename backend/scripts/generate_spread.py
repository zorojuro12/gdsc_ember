"""
Generates fire spread projection GeoJSON files from the McDougall Creek fire perimeter.

Uses Shapely buffer() in UTM Zone 11N (EPSG:32611) for accurate metric distances,
then reprojects back to WGS84 for Mapbox rendering.

Buffer distances are based on conservative flanking fire spread (~1 km/h) at
ISI 12-15 conditions observed at BCWS station 1277 on Aug 17, 2023.

Run from repo root:
    python3 backend/scripts/generate_spread.py
"""

import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union

SCENARIO_DIR = Path(__file__).parents[2] / "data" / "scenarios" / "2023-west-kelowna"
PERIMETER_FILE = SCENARIO_DIR / "mcdougall_creek_perimeter.geojson"

# (output filename, buffer distance in metres, label, hours)
SPREAD_STEPS = [
    ("spread_2hr.geojson", 2_000, "+2hr spread", 2),
    ("spread_4hr.geojson", 4_000, "+4hr spread", 4),
    ("spread_6hr.geojson", 6_000, "+6hr spread", 6),
]

# WGS84 <-> UTM Zone 11N (always_xy keeps lon/lat order consistent with GeoJSON)
_to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32611", always_xy=True).transform
_to_wgs84 = Transformer.from_crs("EPSG:32611", "EPSG:4326", always_xy=True).transform


def load_perimeter():
    with open(PERIMETER_FILE) as f:
        data = json.load(f)
    geometries = [shape(feat["geometry"]) for feat in data["features"]]
    return unary_union(geometries)


def make_feature_collection(geometry, label: str, hours: int) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": {"label": label, "hours": hours},
            }
        ],
    }


def main():
    print(f"Loading perimeter: {PERIMETER_FILE}")
    perimeter_wgs84 = load_perimeter()
    perimeter_utm = transform(_to_utm, perimeter_wgs84)

    for filename, distance_m, label, hours in SPREAD_STEPS:
        buffered_utm = perimeter_utm.buffer(distance_m)
        buffered_wgs84 = transform(_to_wgs84, buffered_utm)
        # Simplify in WGS84 — tolerance ~0.001° ≈ 110m, keeps file size small
        simplified = buffered_wgs84.simplify(0.001, preserve_topology=True)

        out_path = SCENARIO_DIR / filename
        with open(out_path, "w") as f:
            json.dump(make_feature_collection(simplified, label, hours), f)

        coords = len(list(simplified.exterior.coords)) if hasattr(simplified, "exterior") else "?"
        print(f"  {filename}: {distance_m}m buffer, {coords} vertices → {out_path}")

    print("Done.")


if __name__ == "__main__":
    main()

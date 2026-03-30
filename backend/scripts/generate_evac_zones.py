"""
Generates evacuation zone GeoJSON files from the McDougall Creek fire perimeter.

Pure Python implementation (no external deps). Steps:
  1. Load perimeter vertices and compute convex hull (Andrew's monotone chain).
  2. Radially expand each hull vertex outward from centroid by buffer distance,
     adjusting for lat/lng degree scaling at 49.86° N.
  3. Apply a southern latitude floor so the zones don't extend into the city
     shelter area south of West Kelowna.

Buffer distances:
  - evac_order_zone: 3 km, floor lat 49.90 (Rose Valley / Bear Creek area)
  - evac_alert_zone: 6 km, floor lat 49.90 (same southern boundary)

Run from repo root:
    python3 backend/scripts/generate_evac_zones.py
"""

import json
import math
from pathlib import Path

SCENARIO_DIR = Path(__file__).parents[2] / "data" / "scenarios" / "2023-west-kelowna"
PERIMETER_FILE = SCENARIO_DIR / "mcdougall_creek_perimeter.geojson"

# West Kelowna latitude — used to scale lng degrees to km
LAT_REF = 49.86
KM_PER_DEG_LAT = 111.0
KM_PER_DEG_LNG = 111.0 * math.cos(math.radians(LAT_REF))  # ≈ 71.3 km/deg

# Southernmost latitude the zones should reach — keeps them out of the city
# shelter area. Royal LePage is at 49.8587, so staying above 49.90 gives a
# clear visual gap between the danger zone and the reception centre.
SOUTH_FLOOR_LAT = 49.90

EVAC_ZONES = [
    ("evac_order_zone.geojson", 3.0, "Evacuation Order Zone"),
    ("evac_alert_zone.geojson", 6.0, "Evacuation Alert Zone"),
]


def load_perimeter_coords():
    with open(PERIMETER_FILE) as f:
        data = json.load(f)
    all_coords = []
    for feat in data["features"]:
        geom = feat["geometry"]
        if geom["type"] == "Polygon":
            all_coords.extend(geom["coordinates"][0])
        elif geom["type"] == "MultiPolygon":
            for poly in geom["coordinates"]:
                all_coords.extend(poly[0])
    return all_coords


def convex_hull(points):
    """Andrew's monotone chain convex hull. Returns vertices in CCW order."""
    pts = sorted(set(map(tuple, points)))
    if len(pts) <= 1:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def centroid(coords):
    cx = sum(c[0] for c in coords) / len(coords)
    cy = sum(c[1] for c in coords) / len(coords)
    return cx, cy


def expand_polygon(coords, buffer_km):
    """Radially expand each vertex outward from centroid by buffer_km."""
    cx, cy = centroid(coords)
    expanded = []
    for lng, lat in coords:
        dlng_km = (lng - cx) * KM_PER_DEG_LNG
        dlat_km = (lat - cy) * KM_PER_DEG_LAT
        dist = math.sqrt(dlng_km ** 2 + dlat_km ** 2)
        if dist < 1e-9:
            expanded.append([lng, lat])
            continue
        scale = (dist + buffer_km) / dist
        new_lng = cx + (dlng_km * scale) / KM_PER_DEG_LNG
        new_lat = cy + (dlat_km * scale) / KM_PER_DEG_LAT
        expanded.append([new_lng, new_lat])
    return expanded


def apply_south_floor(coords, floor_lat):
    """Clip any vertex that is south of floor_lat up to floor_lat.
    This prevents the zone from extending into the city's shelter area.
    """
    return [[lng, max(lat, floor_lat)] for lng, lat in coords]


def make_feature_collection(coords, label: str) -> dict:
    ring = [[c[0], c[1]] for c in coords] + [[coords[0][0], coords[0][1]]]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [ring],
                },
                "properties": {"label": label},
            }
        ],
    }


def main():
    print(f"Loading perimeter: {PERIMETER_FILE}")
    all_coords = load_perimeter_coords()
    print(f"  Perimeter: {len(all_coords)} vertices")

    hull = convex_hull(all_coords)
    print(f"  Convex hull: {len(hull)} vertices")

    hull_cx, hull_cy = centroid(hull)
    print(f"  Hull centroid: lat={hull_cy:.4f}, lng={hull_cx:.4f}")

    for filename, buffer_km, label in EVAC_ZONES:
        expanded = expand_polygon(hull, buffer_km)
        clipped = apply_south_floor(expanded, SOUTH_FLOOR_LAT)
        out_path = SCENARIO_DIR / filename
        with open(out_path, "w") as f:
            json.dump(make_feature_collection(clipped, label), f)
        lats = [c[1] for c in clipped]
        lngs = [c[0] for c in clipped]
        print(f"  {filename}: {buffer_km}km buffer, floor={SOUTH_FLOOR_LAT} "
              f"→ lat [{min(lats):.4f},{max(lats):.4f}] lng [{min(lngs):.4f},{max(lngs):.4f}]")

    print("Done.")


if __name__ == "__main__":
    main()

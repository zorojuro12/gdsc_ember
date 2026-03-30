"""
Generates evacuation zone GeoJSON files from the McDougall Creek fire perimeter.

Pure Python implementation (no external deps). Steps:
  1. Load perimeter vertices and compute convex hull (Andrew's monotone chain).
  2. Radially expand each hull vertex outward from centroid by buffer distance,
     adjusting for lat/lng degree scaling at 49.86° N.
  3. Apply a southern latitude floor — prevents zones extending into the city
     shelter area south of West Kelowna.
  4. Apply an eastern longitude ceiling — prevents zones crossing Okanagan Lake
     into Kelowna. Western lakeshore runs ~lng -119.505 in the relevant area.

Buffer distances:
  - evac_order_zone: 3 km, south floor 49.87,  east ceiling -119.505
  - evac_alert_zone: 6 km, south floor 49.865, east ceiling -119.505

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

# (filename, buffer_km, label, south_floor_lat, east_ceiling_lng)
#
# South floors — fire perimeter south edge: 49.8721, Royal LePage: 49.8587
#   Order floor 49.87  → fire perimeter just contained, Royal LePage excluded
#   Alert floor 49.865 → extends slightly further south, still excludes Royal LePage
#
# East ceilings — Okanagan Lake western shore: ~lng -119.505
#   Both zones clipped here so neither crosses the lake into Kelowna.
#   Salvation Army: -119.4835, Prospera: -119.4963 — both east of -119.505 → excluded.
EVAC_ZONES = [
    ("evac_order_zone.geojson", 3.0, "Evacuation Order Zone", 49.87,  -119.505),
    ("evac_alert_zone.geojson", 6.0, "Evacuation Alert Zone", 49.865, -119.505),
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
    """Clip vertices south of floor_lat back up to floor_lat."""
    return [[lng, max(lat, floor_lat)] for lng, lat in coords]


def apply_east_ceiling(coords, ceiling_lng):
    """Clip vertices east of ceiling_lng back to ceiling_lng.
    Prevents the zone from crossing Okanagan Lake into Kelowna.
    """
    return [[min(lng, ceiling_lng), lat] for lng, lat in coords]


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

    for filename, buffer_km, label, south_floor, east_ceiling in EVAC_ZONES:
        expanded = expand_polygon(hull, buffer_km)
        clipped = apply_south_floor(expanded, south_floor)
        clipped = apply_east_ceiling(clipped, east_ceiling)
        out_path = SCENARIO_DIR / filename
        with open(out_path, "w") as f:
            json.dump(make_feature_collection(clipped, label), f)
        lats = [c[1] for c in clipped]
        lngs = [c[0] for c in clipped]
        print(f"  {filename}: {buffer_km}km buffer, south≥{south_floor}, east≤{east_ceiling} "
              f"→ lat [{min(lats):.4f},{max(lats):.4f}] lng [{min(lngs):.4f},{max(lngs):.4f}]")

    print("Done.")


if __name__ == "__main__":
    main()

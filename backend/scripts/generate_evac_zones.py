"""
Generates evacuation zone GeoJSON files from the McDougall Creek fire perimeter.

Pure Python implementation (no external deps). Steps:
  1. Load perimeter vertices and compute convex hull (Andrew's monotone chain).
  2. Radially expand each hull vertex outward from centroid by buffer distance,
     adjusting for lat/lng degree scaling at 49.86° N.
  3. Apply a southern latitude floor — prevents zones extending south into the
     city shelter area.
  4. Apply an eastern lakeshore boundary — prevents zones crossing Okanagan Lake
     into Kelowna. The boundary is defined by waypoints along the western shore
     of the lake; the max longitude at any latitude is interpolated from these.

Eastern boundary waypoints (western shore of Okanagan Lake, south to north):
  (49.937021, -119.500331)  — Bear Creek / southern lakeshore
  (49.988060, -119.488148)  — Wilson Landing area

Run from repo root:
    python3 backend/scripts/generate_evac_zones.py
"""

import json
import math
from pathlib import Path

SCENARIO_DIR = Path(__file__).parents[2] / "data" / "scenarios" / "2023-west-kelowna"
PERIMETER_FILE = SCENARIO_DIR / "mcdougall_creek_perimeter.geojson"

LAT_REF = 49.86
KM_PER_DEG_LAT = 111.0
KM_PER_DEG_LNG = 111.0 * math.cos(math.radians(LAT_REF))  # ≈ 71.3 km/deg

# Waypoints along the western shore of Okanagan Lake (lat, lng), south to north.
# The eastern boundary of both evac zones is interpolated through these points
# so the zones follow the lakeshore shape rather than a flat vertical line.
LAKE_SHORE_WAYPOINTS = [
    (49.937021, -119.500331),  # Bear Creek / southern lakeshore
    (49.988060, -119.488148),  # Wilson Landing area
]

# (filename, buffer_km, label, south_floor_lat)
# East boundary is shared — both zones stop at the lakeshore waypoints.
EVAC_ZONES = [
    ("evac_order_zone.geojson", 3.0, "Evacuation Order Zone", 49.87),
    ("evac_alert_zone.geojson", 6.0, "Evacuation Alert Zone", 49.865),
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


def _east_limit_at_lat(lat, waypoints):
    """Interpolate (or extrapolate) the max longitude at a given latitude
    from the lakeshore waypoints, which are sorted south to north.
    """
    if lat <= waypoints[0][0]:
        return waypoints[0][1]
    if lat >= waypoints[-1][0]:
        return waypoints[-1][1]
    for i in range(len(waypoints) - 1):
        lat0, lng0 = waypoints[i]
        lat1, lng1 = waypoints[i + 1]
        if lat0 <= lat <= lat1:
            t = (lat - lat0) / (lat1 - lat0)
            return lng0 + t * (lng1 - lng0)
    return waypoints[-1][1]


def apply_east_boundary(coords, waypoints):
    """Clip each vertex to the interpolated lakeshore longitude at its latitude.
    Produces a curved eastern edge that follows the western shore of Okanagan Lake
    rather than a flat vertical line.
    """
    sorted_wp = sorted(waypoints, key=lambda p: p[0])
    return [[min(lng, _east_limit_at_lat(lat, sorted_wp)), lat] for lng, lat in coords]


def make_feature_collection(coords, label: str) -> dict:
    ring = [[c[0], c[1]] for c in coords] + [[coords[0][0], coords[0][1]]]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
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

    for filename, buffer_km, label, south_floor in EVAC_ZONES:
        expanded = expand_polygon(hull, buffer_km)
        clipped = apply_south_floor(expanded, south_floor)
        clipped = apply_east_boundary(clipped, LAKE_SHORE_WAYPOINTS)
        out_path = SCENARIO_DIR / filename
        with open(out_path, "w") as f:
            json.dump(make_feature_collection(clipped, label), f)
        lats = [c[1] for c in clipped]
        lngs = [c[0] for c in clipped]
        print(f"  {filename}: {buffer_km}km buffer, south≥{south_floor}, east≤lakeshore "
              f"→ lat [{min(lats):.4f},{max(lats):.4f}] lng [{min(lngs):.4f},{max(lngs):.4f}]")

    print("Done.")


if __name__ == "__main__":
    main()

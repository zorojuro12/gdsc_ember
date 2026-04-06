"""
Snaps hand-traced road closure waypoints to real OSM road geometry via the
Mapbox Map Matching API. One-shot dev-time script — result is committed to git
and loaded statically at demo time, so the demo stays fully offline.

Output: data/scenarios/2023-west-kelowna/road_closures_geometry.geojson
        (copied to frontend/public/ for Vite to serve)

Input:  MAPBOX_TOKEN in backend/.env (public pk.* token is fine)

Usage (from repo root):
    python3 backend/scripts/snap_closures_to_roads.py

Pilot mode: only processes the closures listed in CLOSURES_TO_PROCESS below.
Expand that list after visually verifying the pilot output.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load MAPBOX_TOKEN from backend/.env regardless of where the script is invoked from
load_dotenv(Path(__file__).parents[1] / ".env")

REPO_ROOT = Path(__file__).parents[2]
SCENARIO_DIR = REPO_ROOT / "data" / "scenarios" / "2023-west-kelowna"
FRONTEND_PUBLIC = REPO_ROOT / "frontend" / "public"

INPUT_FILE = SCENARIO_DIR / "road_closures.json"
OUTPUT_NAME = "road_closures_geometry.geojson"

MAPBOX_URL = "https://api.mapbox.com/matching/v5/mapbox/driving/{coords}"
MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving/{coords}"

CLOSURES_TO_PROCESS = ["closure_001", "closure_002", "closure_003", "closure_004"]

# Per-closure waypoint overrides applied before sending to Map Matching. Used
# to visually tune the snapped output without modifying the canonical
# road_closures.json research data (which CLAUDE.md forbids touching).
# - waypoints: replace the input trace entirely with this list
# - prepend:   extra points inserted at the start of the trace
# - append:    extra points inserted at the end of the trace
CLOSURE_OVERRIDES: dict[str, dict] = {
    # User-provided endpoints. The hand-traced waypoints in road_closures.json
    # had the Westside Road closure starting inside the fire perimeter, and
    # Bear Creek Road snapped to the wrong street entirely. These two-point
    # traces let Map Matching pick the correct road with the driving profile.
    "closure_001": {
        "waypoints": [
            {"lat": 49.882763, "lng": -119.536358},  # south end — outside fire perimeter
            {"lat": 50.088707, "lng": -119.502097},  # north end
        ],
    },
    "closure_004": {
        "waypoints": [
            {"lat": 49.898890, "lng": -119.546676},  # west end
            {"lat": 49.914774, "lng": -119.539844},  # east end
        ],
    },
}


def build_coord_string(waypoints: list[dict]) -> str:
    """Mapbox wants 'lng,lat;lng,lat;...' — note the lng,lat order."""
    return ";".join(f"{p['lng']},{p['lat']}" for p in waypoints)


def call_map_matching(waypoints: list[dict], token: str) -> dict:
    """Calls Mapbox Map Matching and returns the parsed JSON response."""
    coords = build_coord_string(waypoints)
    url = MAPBOX_URL.format(coords=coords)
    # Hand-traced waypoints can sit 20-30m off the true road centerline, which
    # exceeds Mapbox's default 5m snap radius and causes silent point drops.
    # A 50m radius per point gives the matcher enough slack to accept every
    # input point along the intended road.
    radiuses = ";".join(["50"] * len(waypoints))
    params = {
        "geometries": "geojson",  # return LineString directly, not encoded polyline
        "overview": "full",        # preserve all snapped vertices, not a simplified version
        "tidy": "true",            # drop near-duplicate input points that confuse the matcher
        "radiuses": radiuses,
        "access_token": token,
    }
    resp = httpx.get(url, params=params, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def call_directions(waypoints: list[dict], token: str) -> dict:
    """
    Calls Mapbox Directions API for endpoint-to-endpoint routing. Used when the
    input is just 2 points too far apart for Map Matching's trace semantics
    (the matcher 422s on long 2-point traces).
    """
    coords = build_coord_string(waypoints)
    url = MAPBOX_DIRECTIONS_URL.format(coords=coords)
    params = {
        "geometries": "geojson",
        "overview": "full",
        "access_token": token,
    }
    resp = httpx.get(url, params=params, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def snap_closure(closure: dict, token: str) -> tuple[dict, bool, float]:
    """
    Returns (feature, matched, confidence). matched=False means the API failed
    or returned no match — the caller should fall back to raw waypoints.
    """
    cid = closure["id"]
    override = CLOSURE_OVERRIDES.get(cid, {})

    if override.get("waypoints"):
        waypoints = list(override["waypoints"])
        print(f"  {cid}: using {len(waypoints)} override waypoint(s) (replacing JSON trace)")
    else:
        waypoints = list(closure.get("waypoints", []))
        if override.get("prepend"):
            waypoints = list(override["prepend"]) + waypoints
            print(f"  {cid}: prepended {len(override['prepend'])} override waypoint(s)")
        if override.get("append"):
            waypoints = waypoints + list(override["append"])
            print(f"  {cid}: appended {len(override['append'])} override waypoint(s)")

    if len(waypoints) < 2:
        print(f"  {cid}: only {len(waypoints)} waypoints, skipping API call")
        return _raw_feature(closure), False, 0.0

    # Pick the right API for the input shape. Map Matching is designed for
    # dense GPS traces — it 422s on 2-point inputs that are kilometres apart
    # because there's nothing to match. For sparse 2-point endpoint overrides
    # (e.g. closure_001 Westside Road, 23 km between the two points) we fall
    # back to the Directions API which routes between endpoints directly.
    use_directions = len(waypoints) == 2 and bool(override.get("waypoints"))
    api_name = "directions" if use_directions else "matching"

    try:
        data = (
            call_directions(waypoints, token)
            if use_directions
            else call_map_matching(waypoints, token)
        )
    except httpx.HTTPError as e:
        print(f"  {cid}: Mapbox API error ({api_name}): {e}")
        return _raw_feature(closure), False, 0.0

    if use_directions:
        if data.get("code") != "Ok" or not data.get("routes"):
            print(f"  {cid}: no directions route (code={data.get('code')!r}, message={data.get('message')!r})")
            return _raw_feature(closure), False, 0.0
        route = data["routes"][0]
        geometry = route["geometry"]
        # Directions API has no confidence score — use 1.0 to signal a clean
        # endpoint route that wasn't a noisy trace match.
        confidence = 1.0
    else:
        if data.get("code") != "Ok" or not data.get("matchings"):
            print(f"  {cid}: no matchings (code={data.get('code')!r}, message={data.get('message')!r})")
            return _raw_feature(closure), False, 0.0
        match = data["matchings"][0]
        confidence = float(match.get("confidence", 0.0))
        geometry = match["geometry"]  # already GeoJSON LineString

    feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "id": cid,
            "road_name": closure["road_name"],
            "status": closure["status"],
            "severity": closure.get("severity"),
            "matched": True,
            "confidence": round(confidence, 3),
            "api": api_name,
        },
    }
    print(f"  {cid}: {api_name} returned {len(geometry['coordinates'])} vertices, confidence={confidence:.3f}")
    return feature, True, confidence


def _raw_feature(closure: dict) -> dict:
    """Fallback: build a LineString directly from raw waypoints."""
    coords = [[p["lng"], p["lat"]] for p in closure.get("waypoints", [])]
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": {
            "id": closure["id"],
            "road_name": closure["road_name"],
            "status": closure["status"],
            "severity": closure.get("severity"),
            "matched": False,
            "confidence": 0.0,
        },
    }


def main() -> int:
    token = os.getenv("MAPBOX_TOKEN", "").strip()
    if not token:
        print("ERROR: MAPBOX_TOKEN not set in backend/.env", file=sys.stderr)
        return 1

    if not INPUT_FILE.exists():
        print(f"ERROR: {INPUT_FILE} not found", file=sys.stderr)
        return 1

    with open(INPUT_FILE) as f:
        data = json.load(f)

    all_closures = {c["id"]: c for c in data.get("road_closures", [])}
    missing = [cid for cid in CLOSURES_TO_PROCESS if cid not in all_closures]
    if missing:
        print(f"ERROR: closures not found in {INPUT_FILE.name}: {missing}", file=sys.stderr)
        return 1

    print(f"Processing {len(CLOSURES_TO_PROCESS)} closure(s): {CLOSURES_TO_PROCESS}")

    features = []
    any_failed = False
    for cid in CLOSURES_TO_PROCESS:
        feature, matched, confidence = snap_closure(all_closures[cid], token)
        features.append(feature)
        if not matched:
            any_failed = True
        elif confidence < 0.5:
            print(f"    WARNING: low confidence ({confidence:.3f}) for {cid} — inspect output")

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "description": "Road closure geometry snapped to real OSM roads via Mapbox Map Matching",
            "source": "Generated from road_closures.json waypoints — do not edit by hand",
            "script": "backend/scripts/snap_closures_to_roads.py",
            "processed": CLOSURES_TO_PROCESS,
        },
        "features": features,
    }

    # Write to canonical scenario location + copy to frontend public for Vite
    scenario_out = SCENARIO_DIR / OUTPUT_NAME
    frontend_out = FRONTEND_PUBLIC / OUTPUT_NAME
    for target in (scenario_out, frontend_out):
        with open(target, "w") as f:
            json.dump(out, f, indent=2)
        print(f"  wrote {target.relative_to(REPO_ROOT)}")

    if any_failed:
        print("\nDONE — with fallbacks (some closures used raw waypoints). Inspect output.")
        return 2
    print("\nDONE — all processed closures matched successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

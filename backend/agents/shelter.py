"""
Shelter Agent — ranks shelters based on drive time and profile flags.

In live mode, calls Google Directions API for real drive times (in parallel).
Falls back to haversine-based estimates in demo mode for any user position.

Ranking algorithm (modifies effective drive time, then sorts ascending):
  1. Load shelter list + current statuses from cache/demo_state
  2. Base drive times from Directions API (live) or haversine estimate (demo)
  3. Hard filter: mobility=true -> remove shelters where is_accessible=false
  4. Medical boost: medical=true and has_medical_power=true -> drive_time x 0.8
  5. Pet deprioritise: pets=true and has_pet_area=false -> +30 min penalty
  6. Near-full penalty: Near Full -> +10 min; Filling -> +5 min
  7. Closure-corridor penalty: +60 min per active closure that lies between
     the user and shelter on the direct path (closure blocks that route)
  8. Sort by effective drive time ascending. Return top shelter + full list.
"""

from __future__ import annotations

import asyncio
import math
from typing import Optional, Tuple

from shapely.geometry import LineString, shape

import cache
import demo_state
import directions

# Default demo coordinates (1240 Marble Terrace, West Kelowna).
# If the user is within this threshold of the default, use pre-computed
# demo_route.json times; otherwise compute haversine estimates.
_DEMO_LAT = 49.8625
_DEMO_LNG = -119.5800
_DEMO_THRESHOLD_DEG = 0.05  # ~5km

# Fire-path penalty: if the straight-line user→shelter path overlaps the fire
# polygon by more than this threshold (in coordinate degrees), the shelter is
# "through the fire" and gets a large time penalty to deprioritise it.
_FIRE_OVERLAP_THRESHOLD = 0.03   # ~3 km through fire = danger
_FIRE_OVERLAP_PENALTY = 200      # minutes


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _haversine_drive_min(user_lat: float, user_lng: float, dest_lat: float, dest_lng: float) -> int:
    """Rough drive-time estimate: haversine distance × road factor ÷ average speed."""
    km = _haversine_km(user_lat, user_lng, dest_lat, dest_lng)
    # Road factor 1.4 accounts for winding roads; 50 km/h average regional speed.
    return max(5, int(km * 1.4 / 50 * 60))


def _closure_blocks_path(
    user_lat: float, user_lng: float,
    shelter_lat: float, shelter_lng: float,
    closure_lat: float, closure_lng: float,
    lng_threshold: float = 0.08,
) -> bool:
    """
    Returns True if the closure midpoint lies between the user and shelter on
    the direct path. Checks both that the closure latitude falls within the
    user-shelter latitude interval and that its longitude is close to the
    interpolated path longitude at that latitude.
    """
    lat_lo = min(user_lat, shelter_lat)
    lat_hi = max(user_lat, shelter_lat)

    if not (lat_lo < closure_lat < lat_hi):
        return False

    # Interpolate the expected longitude at closure_lat along the user→shelter line.
    if abs(shelter_lat - user_lat) < 1e-9:
        return False
    t = (closure_lat - user_lat) / (shelter_lat - user_lat)
    expected_lng = user_lng + t * (shelter_lng - user_lng)

    return abs(closure_lng - expected_lng) < lng_threshold


async def _fetch_drive_time(user_lat: float, user_lng: float, shelter: dict) -> Tuple[str, Optional[int]]:
    minutes = await directions.get_drive_time(
        user_lat, user_lng, shelter["lat"], shelter["lng"]
    )
    return (shelter["id"], minutes)


async def run(user_lat: float, user_lng: float, profile: dict, demo_mode: bool) -> dict:
    shelters_data = cache.get("shelters:all")
    route_data = cache.get("directions:demo")
    state = demo_state.get_state()
    shelter_statuses = state.get("shelter_statuses", {})

    # Load fire perimeter for path-intersection penalty (Shapely required).
    fire_geom = None
    fire_data = cache.get("fire_perimeter:K52767")
    if fire_data and fire_data.get("features"):
        try:
            fire_geom = shape(fire_data["features"][0]["geometry"])
        except Exception:
            pass

    if not shelters_data:
        return {"shelter": None, "ranked": []}

    shelters = shelters_data.get("shelters", [])

    # ── Base drive times ─────────────────────────────────────────────────────
    # Live mode: real Directions API calls from the user's actual position.
    # Demo mode: use pre-computed times only when user is near the default demo
    # address; otherwise fall back to haversine estimates so that any address
    # produces geographically sensible rankings.

    live_times: dict = {}
    if not demo_mode:
        tasks = [_fetch_drive_time(user_lat, user_lng, s) for s in shelters]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, tuple):
                sid, minutes = result
                live_times[sid] = minutes

    near_default = (abs(user_lat - _DEMO_LAT) < _DEMO_THRESHOLD_DEG
                    and abs(user_lng - _DEMO_LNG) < _DEMO_THRESHOLD_DEG)
    hardcoded_times: dict = {}
    if demo_mode and near_default and route_data:
        hardcoded_times = route_data.get("shelter_drive_times", {})

    # ── Active closures (for corridor-blocking penalty) ──────────────────────
    closures_data = cache.get("drivebc:closures") or {}
    active_ids = state.get("active_closures", [])
    all_closures_map = {c["id"]: c for c in closures_data.get("road_closures", [])}
    active_closures = [all_closures_map[cid] for cid in active_ids if cid in all_closures_map]

    mobility = profile.get("mobility", False)
    medical = profile.get("medical", False)
    pets = profile.get("pets", False)

    scored = []
    for s in shelters:
        sid = s["id"]

        if mobility and not s.get("is_accessible", False):
            continue

        # Determine base drive time.
        if not demo_mode:
            live_t = live_times.get(sid)
            base_time = live_t if live_t is not None else _haversine_drive_min(user_lat, user_lng, s["lat"], s["lng"])
        elif hardcoded_times:
            base_time = hardcoded_times.get(sid, _haversine_drive_min(user_lat, user_lng, s["lat"], s["lng"]))
        else:
            base_time = _haversine_drive_min(user_lat, user_lng, s["lat"], s["lng"])

        effective_time = float(base_time)

        if medical and s.get("has_medical_power", False):
            effective_time *= 0.8

        if pets and not s.get("has_pet_area", False):
            effective_time += 30

        status = shelter_statuses.get(sid, "Open")
        if status == "Near Full":
            effective_time += 10
        elif status == "Filling":
            effective_time += 5

        # Closure-corridor penalty: +60 min for each active closure that lies
        # between the user and this shelter on the direct path.
        for closure in active_closures:
            mp = closure.get("midpoint", {})
            c_lat = mp.get("lat")
            c_lng = mp.get("lng")
            if c_lat is not None and c_lng is not None:
                if _closure_blocks_path(user_lat, user_lng, s["lat"], s["lng"], c_lat, c_lng):
                    effective_time += 60

        # Fire-path penalty: if the straight-line path to this shelter passes
        # through more than _FIRE_OVERLAP_THRESHOLD degrees of the fire polygon,
        # the route requires driving through active fire — add a large penalty.
        if fire_geom is not None:
            try:
                path = LineString([(user_lng, user_lat), (s["lng"], s["lat"])])
                overlap = path.intersection(fire_geom).length
                if overlap > _FIRE_OVERLAP_THRESHOLD:
                    effective_time += _FIRE_OVERLAP_PENALTY
            except Exception:
                pass

        scored.append({
            "id": sid,
            "name": s["name"],
            "address": s["address"],
            "lat": s["lat"],
            "lng": s["lng"],
            "status": status,
            "is_accessible": s.get("is_accessible", False),
            "has_pet_area": s.get("has_pet_area", False),
            "has_medical_power": s.get("has_medical_power", False),
            "drive_time_min": base_time,
            "effective_time_min": round(effective_time, 1),
        })

    scored.sort(key=lambda x: x["effective_time_min"])

    if not scored:
        return {"shelter": None, "ranked": []}

    top = scored[0]
    return {
        "shelter": {
            "id": top["id"],
            "name": top["name"],
            "address": top["address"],
            "lat": top["lat"],
            "lng": top["lng"],
            "status": top["status"],
            "is_accessible": top["is_accessible"],
            "has_pet_area": top["has_pet_area"],
        },
        "ranked": scored,
    }

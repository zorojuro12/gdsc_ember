"""
Shelter Agent — ranks shelters based on drive time and profile flags.

In live mode, calls Google Directions API for real drive times (in parallel).
Falls back to hardcoded times from demo_route.json on API failure.

Ranking algorithm (modifies effective drive time, then sorts ascending):
  1. Load shelter list + current statuses from cache/demo_state
  2. Base drive times from Directions API (live) or demo_route.json (fallback)
  3. Hard filter: mobility=true -> remove shelters where is_accessible=false
  4. Medical boost: medical=true and has_medical_power=true -> drive_time x 0.8
  5. Pet deprioritise: pets=true and has_pet_area=false -> +30 min penalty
  6. Near-full penalty: Near Full -> +10 min; Filling -> +5 min
  7. Sort by effective drive time ascending. Return top shelter + full list.
"""

from __future__ import annotations

import asyncio
from typing import Optional, Tuple

import cache
import demo_state
import directions


# Fetches real drive time for one shelter, returns (shelter_id, minutes).
async def _fetch_drive_time(user_lat: float, user_lng: float, shelter: dict) -> Tuple[str, Optional[int]]:
    minutes = await directions.get_drive_time(
        user_lat, user_lng, shelter["lat"], shelter["lng"]
    )
    return (shelter["id"], minutes)


# Ranks shelters by effective drive time with profile-based adjustments.
async def run(user_lat: float, user_lng: float, profile: dict, demo_mode: bool) -> dict:
    shelters_data = cache.get("shelters:all")
    route_data = cache.get("directions:demo")
    state = demo_state.get_state()
    shelter_statuses = state.get("shelter_statuses", {})

    if not shelters_data:
        return {"shelter": None, "ranked": []}

    shelters = shelters_data.get("shelters", [])
    hardcoded_times = {}
    if route_data:
        hardcoded_times = route_data.get("shelter_drive_times", {})

    live_times: dict[str, int | None] = {}
    if not demo_mode:
        tasks = [_fetch_drive_time(user_lat, user_lng, s) for s in shelters]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, tuple):
                sid, minutes = result
                live_times[sid] = minutes

    mobility = profile.get("mobility", False)
    medical = profile.get("medical", False)
    pets = profile.get("pets", False)

    scored = []
    for s in shelters:
        sid = s["id"]

        if mobility and not s.get("is_accessible", False):
            continue

        live_t = live_times.get(sid)
        base_time = live_t if live_t is not None else hardcoded_times.get(sid, 60)
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

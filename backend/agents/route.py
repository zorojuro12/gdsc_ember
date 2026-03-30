"""
Route Agent — returns the recommended evacuation route and active closure list.

In live mode, calls Google Directions API for a real route from user to the
nearest shelter. Falls back to cached demo_route.json on API failure.
"""

from __future__ import annotations

import cache
import demo_state
import directions


# Builds the active closures list from demo_state and cached closure data.
def _build_closures() -> list[dict]:
    closures_data = cache.get("drivebc:closures")
    state = demo_state.get_state()
    active_ids = state.get("active_closures", [])

    closures = []
    if closures_data:
        all_closures = {c["id"]: c for c in closures_data.get("road_closures", [])}
        for cid in active_ids:
            c = all_closures.get(cid)
            if c:
                closures.append({
                    "road": c["road_name"],
                    "status": c["status"],
                    "lat": c["midpoint"]["lat"],
                    "lng": c["midpoint"]["lng"],
                })
    return closures


# Returns the recommended evacuation route with active road closures.
async def run(user_lat: float, user_lng: float, demo_mode: bool) -> dict:
    closures = _build_closures()

    if not demo_mode:
        shelters_data = cache.get("shelters:all")
        if shelters_data:
            top_shelter = shelters_data["shelters"][0]
            avoid_roads = [c["road"] for c in closures]
            live_route = await directions.get_route(
                user_lat, user_lng,
                top_shelter["lat"], top_shelter["lng"],
                avoid_roads=avoid_roads,
            )
            if live_route:
                return {
                    "summary": live_route["summary"],
                    "distance_km": live_route["distance_km"],
                    "duration_min": live_route["duration_min"],
                    "polyline": live_route["polyline"],
                    "fallback_summary": "Hwy 97C West to Merritt",
                    "closures": closures,
                }

    route_data = cache.get("directions:demo")
    if route_data:
        primary = route_data["primary"]
        fallback = route_data["fallback"]
        return {
            "summary": primary["summary"],
            "distance_km": primary["distance_km"],
            "duration_min": primary["duration_min"],
            "polyline": primary.get("polyline", ""),
            "fallback_summary": fallback["summary"],
            "closures": closures,
        }

    return {
        "summary": "Hwy 97 South via Boucherie Rd",
        "distance_km": 5.8,
        "duration_min": 8,
        "polyline": "",
        "fallback_summary": "Hwy 97C West to Merritt",
        "closures": closures,
    }

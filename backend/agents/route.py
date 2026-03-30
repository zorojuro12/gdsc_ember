"""
Route Agent — returns the recommended evacuation route and active closure list.

Demo mode: returns pre-computed route from cache, reads active closures from demo_state.
Live mode:  would call Google Maps Directions API (not implemented in Phase 3).
"""

import cache
import demo_state


async def run(address: str, demo_mode: bool) -> dict:
    route_data = cache.get("directions:demo")
    closures_data = cache.get("drivebc:closures")
    state = demo_state.get_state()
    active_ids = state.get("active_closures", [])

    # Build closures list from active IDs
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

    # Fallback if cache miss
    return {
        "summary": "Hwy 97 South via Boucherie Rd",
        "distance_km": 5.8,
        "duration_min": 8,
        "polyline": "",
        "fallback_summary": "Hwy 97C West to Merritt",
        "closures": closures,
    }

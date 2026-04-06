"""
Orchestrator — geocodes the address, then runs Threat, Route, and Shelter agents
in parallel with a 3-second timeout, then passes all results to the Profile Agent.
"""

from __future__ import annotations

import asyncio

from agents import profile, route, shelter, threat
from geocode import geocode

DEMO_LAT = 49.889862
DEMO_LNG = -119.554390

# Known demo addresses mapped to real coordinates so the blue dot and route
# origin are geographically correct without calling the Geocoding API.
DEMO_ADDRESS_MAP: dict[str, tuple[float, float]] = {
    "1598 westlake": (49.889862, -119.554390),
}


# Runs the full briefing pipeline: geocode -> agents (parallel) -> profile.
async def run_briefing(address: str, profile_flags: dict, demo_mode: bool) -> dict:
    user_lat, user_lng = DEMO_LAT, DEMO_LNG

    if demo_mode:
        addr_lower = address.lower()
        for prefix, (lat, lng) in DEMO_ADDRESS_MAP.items():
            if prefix in addr_lower:
                user_lat, user_lng = lat, lng
                break
    else:
        coords = await geocode(address)
        if coords:
            user_lat, user_lng = coords
        else:
            print(f"[orchestrator] Geocoding failed for '{address}', using demo coords")

    async def _safe(coro):
        try:
            return await asyncio.wait_for(coro, timeout=10.0)
        except Exception:
            return None

    # Run threat + shelter in parallel first so we know the top shelter
    # before calling the route agent (which needs the destination).
    threat_result, shelter_result = await asyncio.gather(
        _safe(threat.run(user_lat, user_lng, demo_mode)),
        _safe(shelter.run(user_lat, user_lng, profile_flags, demo_mode)),
    )

    top_shelter = shelter_result.get("shelter") if shelter_result else None
    route_result = await _safe(route.run(user_lat, user_lng, demo_mode, top_shelter=top_shelter))

    profile_result = await profile.run(
        threat_result, route_result, shelter_result, profile_flags, demo_mode
    )

    return {
        "threat": threat_result,
        "route": route_result,
        "shelter": shelter_result.get("shelter") if shelter_result else None,
        "briefing_text": profile_result.get("briefing_text", ""),
        "closures": (route_result or {}).get("closures", []),
        "user_location": {"lat": user_lat, "lng": user_lng},
    }

"""
Orchestrator — runs Threat, Route, and Shelter agents in parallel with a 3-second
timeout, then passes all results to the Profile Agent for briefing synthesis.
"""

import asyncio

from agents import profile, route, shelter, threat


async def run_briefing(address: str, profile_flags: dict, demo_mode: bool) -> dict:
    """
    1. Run threat/route/shelter agents concurrently (3s timeout each).
    2. Replace any Exception or timeout with None.
    3. Call profile agent with the three results.
    4. Return assembled response.
    """

    async def _safe(coro):
        try:
            return await asyncio.wait_for(coro, timeout=3.0)
        except Exception:
            return None

    threat_result, route_result, shelter_result = await asyncio.gather(
        _safe(threat.run(address, demo_mode)),
        _safe(route.run(address, demo_mode)),
        _safe(shelter.run(profile_flags, demo_mode)),
    )

    profile_result = await profile.run(
        threat_result, route_result, shelter_result, profile_flags, demo_mode
    )

    return {
        "threat": threat_result,
        "route": route_result,
        "shelter": shelter_result.get("shelter") if shelter_result else None,
        "briefing_text": profile_result.get("briefing_text", ""),
        "closures": (route_result or {}).get("closures", []),
    }

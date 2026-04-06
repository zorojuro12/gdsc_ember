"""
Profile Agent — assembles structured payload from all three agents, then returns
a plain-language briefing via one of three tiers:

  Tier 1: Pre-generated LLM output from demo_briefing.json (demo mode only)
  Tier 2: Template-composed briefing (fallback when LLM is unavailable)
  Tier 3: Live Anthropic API call (when ANTHROPIC_API_KEY is set)
"""

from __future__ import annotations

import os

import cache


# Read at call time — see run() and _call_anthropic()


# Maps a profile dict to one of the pre-generated briefing keys.
# Returns a compound key like "mobility_pets" for multi-flag combos.
def _flag_key(profile: dict) -> str:
    active = [k for k in ("mobility", "medical", "pets", "no_vehicle") if profile.get(k)]
    if not active:
        return "default"
    return "_".join(active)


# Tier 2 — composes a briefing from structured data without calling the LLM.
def _template_briefing(payload: dict) -> str:
    threat = payload.get("threat", {})
    route = payload.get("route", {})
    shelter = payload.get("shelter", {})
    closures = payload.get("closures", [])
    profile = payload.get("profile", {})

    dist = threat.get("distance_km", "?")
    hrs = threat.get("time_to_perimeter_hours", "?")
    wind_speed = threat.get("wind_speed_kmh", "?")
    wind_dir = threat.get("wind_direction", "?")
    route_summary = route.get("primary", "?")
    route_km = route.get("distance_km")
    route_min = route.get("duration_min", "?")
    shelter_name = shelter.get("name", "?")

    # Format distance: sub-1km as metres for urgency
    if isinstance(dist, (int, float)) and dist < 1:
        dist_str = f"{int(dist * 1000)} metres"
    else:
        dist_str = f"{dist} km"

    text = (
        f"Fire is {dist_str} from your address and closing fast \u2014 evacuate now. "
        f"Proceed to {shelter_name} via {route_summary}"
    )
    if route_km:
        text += f", {route_km} km, about {route_min} minutes."
    else:
        text += f", approximately {route_min} minutes."

    if profile.get("mobility"):
        if shelter.get("is_accessible"):
            text += " Accessible entry confirmed."
        else:
            text += " Call ahead to confirm accessibility."
    if profile.get("medical"):
        if shelter.get("has_medical_power"):
            text += " This shelter has full electrical infrastructure for medical equipment."
        else:
            text += " Bring backup power for medical equipment."
    if profile.get("pets"):
        if shelter.get("has_pet_area"):
            text += " Recommended shelter accepts pets."
        else:
            text += " Contact shelter staff about pet accommodation on arrival."
    if profile.get("no_vehicle"):
        text += " If you need transportation assistance, call Emergency Support Services at 1-800-387-4258."

    if closures:
        road_list = " and ".join(c if isinstance(c, str) else c.get("road", "") for c in closures[:2])
        text += f" Avoid {road_list}."

    return text


# Builds the structured JSON payload for the LLM from all agent outputs.
def _build_payload(threat: dict, route: dict, shelter_result: dict, profile: dict) -> dict:
    shelter = shelter_result.get("shelter") if shelter_result else None
    closures = route.get("closures", []) if route else []
    return {
        "threat": {
            "distance_km": (threat or {}).get("distance_km", 7.4),
            "time_to_perimeter_hours": (threat or {}).get("time_to_perimeter_hours", 4.2),
            "spread_rate": (threat or {}).get("spread_rate", "HIGH"),
            "wind_speed_kmh": ((threat or {}).get("wind") or {}).get("speed_kmh", 42),
            "wind_direction": ((threat or {}).get("wind") or {}).get("direction", "NE"),
        },
        "route": {
            "primary": (route or {}).get("summary", "Hwy 97 South"),
            "distance_km": (route or {}).get("distance_km", 5.8),
            "duration_min": (route or {}).get("duration_min", 8),
            "fallback": (route or {}).get("fallback_summary", "Hwy 97C West to Merritt"),
        },
        "shelter": {
            "name": (shelter or {}).get("name", "Royal LePage Place"),
            "address": (shelter or {}).get("address", ""),
            "status": (shelter or {}).get("status", "Open"),
            "is_accessible": (shelter or {}).get("is_accessible", True),
            "has_pet_area": (shelter or {}).get("has_pet_area", False),
        },
        "closures": [c["road"] + " — " + c["status"] if isinstance(c, dict) else c for c in closures],
        "profile": profile,
    }


# Calls Claude Sonnet to synthesize a plain-language briefing from structured data.
async def _call_anthropic(payload: dict) -> str:
    import anthropic
    import json

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    client = anthropic.AsyncAnthropic(api_key=api_key)
    system = (
        "You are EMBER, an emergency evacuation assistant for BC wildfire emergencies. "
        "Given structured data about a resident's situation, generate a 3-4 sentence "
        "plain-language evacuation briefing.\n\n"
        "Be direct, specific, and actionable. Use no jargon. Include: distance to fire, "
        "time estimate, recommended route, shelter name, and any road closures to avoid. "
        "If accessibility flags are set, mention the relevant accommodation. "
        "Do not add disclaimers or caveats — the system labels projections on the map already."
    )
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=system,
        messages=[{"role": "user", "content": json.dumps(payload, indent=2)}],
    )
    return message.content[0].text.strip()


# Generates the evacuation briefing using the best available method.
async def run(
    threat: dict,
    route: dict,
    shelter_result: dict,
    profile: dict,
    demo_mode: bool,
) -> dict:
    payload = _build_payload(threat, route, shelter_result, profile)

    if demo_mode:
        # Only use pre-generated briefings when the shelter is Royal LePage
        # (the default). If the shelter changed (e.g. reroute due to capacity),
        # fall through to the template which uses the actual shelter name.
        shelter_name = payload.get("shelter", {}).get("name", "")
        if "Royal LePage" in shelter_name:
            briefing_data = cache.get("briefing:demo")
            if briefing_data:
                key = _flag_key(profile)
                text = briefing_data.get("briefings", {}).get(key)
                if text:
                    return {"briefing_text": text, "payload": payload}
        return {"briefing_text": _template_briefing(payload), "payload": payload}

    if os.getenv("ANTHROPIC_API_KEY", ""):
        try:
            text = await _call_anthropic(payload)
            return {"briefing_text": text, "payload": payload}
        except Exception as e:
            print(f"[profile] Anthropic API failed, falling back to template: {e}")

    return {"briefing_text": _template_briefing(payload), "payload": payload}

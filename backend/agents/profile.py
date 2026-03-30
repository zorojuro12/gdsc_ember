"""
Profile Agent — assembles structured payload from all three agents, then returns
a plain-language briefing via one of three tiers:

  Tier 1: Pre-generated LLM output from demo_briefing.json (demo mode, primary)
  Tier 2: Template-composed briefing (demo mode, fallback for uncached flag combos)
  Tier 3: Live Anthropic API call (live mode only)
"""

import os

import cache

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def _flag_key(profile: dict) -> str:
    """Map a profile dict to one of the pre-generated briefing keys."""
    if profile.get("mobility"):
        return "mobility"
    if profile.get("medical"):
        return "medical"
    if profile.get("pets"):
        return "pets"
    if profile.get("no_vehicle"):
        return "no_vehicle"
    return "default"


def _template_briefing(payload: dict) -> str:
    """Tier 2 — compose a briefing from structured data without calling the LLM."""
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
    route_km = route.get("distance_km", "?")
    route_min = route.get("duration_min", "?")
    shelter_name = shelter.get("name", "?")

    text = (
        f"Fire is {dist} km from your address. "
        f"At current wind speed ({wind_speed} km/h {wind_dir}), "
        f"the projected boundary reaches your area in approximately {hrs} hours. "
        f"Evacuate via {route_summary} to {shelter_name} — {route_km} km, about {route_min} minutes."
    )

    if profile.get("mobility"):
        text += " Recommended shelter has confirmed accessible entry."
    if profile.get("medical"):
        text += " This shelter has full electrical infrastructure for medical equipment."
    if profile.get("pets"):
        if shelter.get("has_pet_area"):
            text += " Recommended shelter accepts pets."
        else:
            text += " Contact shelter staff about pet accommodation on arrival."
    if profile.get("no_vehicle"):
        text += " If you need transportation assistance, call Emergency Support Services at 1-800-387-4258."

    if closures:
        road_list = " and ".join(c["road"] for c in closures[:2])
        text += f" Avoid {road_list} — closed due to fire activity."

    return text


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
        "closures": [c["road"] + " — " + c["status"] for c in closures],
        "profile": profile,
    }


async def _call_anthropic(payload: dict) -> str:
    """Tier 3 — live Anthropic API call."""
    import anthropic
    import json

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
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


async def run(
    threat: dict,
    route: dict,
    shelter_result: dict,
    profile: dict,
    demo_mode: bool,
) -> dict:
    payload = _build_payload(threat, route, shelter_result, profile)

    if demo_mode:
        # Tier 1: pre-generated briefing lookup
        briefing_data = cache.get("briefing:demo")
        if briefing_data:
            key = _flag_key(profile)
            text = briefing_data.get("briefings", {}).get(key)
            if text:
                return {"briefing_text": text, "payload": payload}

        # Tier 2: template fallback
        return {"briefing_text": _template_briefing(payload), "payload": payload}

    # Tier 3: live API call
    text = await _call_anthropic(payload)
    return {"briefing_text": text, "payload": payload}

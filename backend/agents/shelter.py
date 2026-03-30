"""
Shelter Agent — ranks shelters based on drive time and profile flags.

Ranking algorithm (modifies effective drive time, then sorts ascending):
  1. Load shelter list + current statuses from cache/demo_state
  2. Base drive times from directions:demo cache
  3. Hard filter: mobility=true → remove shelters where is_accessible=false
  4. Medical boost: medical=true and has_medical_power=true → drive_time × 0.8
  5. Pet deprioritise: pets=true and has_pet_area=false → +30 min penalty
  6. Near-full penalty: Near Full → +10 min; Filling → +5 min
  7. Sort by effective drive time ascending. Return top shelter + full list.
"""

import cache
import demo_state


async def run(profile: dict, demo_mode: bool) -> dict:
    shelters_data = cache.get("shelters:all")
    route_data = cache.get("directions:demo")
    state = demo_state.get_state()
    shelter_statuses = state.get("shelter_statuses", {})

    if not shelters_data:
        return {"shelter": None, "ranked": []}

    shelters = shelters_data.get("shelters", [])
    base_times = {}
    if route_data:
        base_times = route_data.get("shelter_drive_times", {})

    mobility = profile.get("mobility", False)
    medical = profile.get("medical", False)
    pets = profile.get("pets", False)

    scored = []
    for s in shelters:
        sid = s["id"]

        # Hard filter: accessibility
        if mobility and not s.get("is_accessible", False):
            continue

        base_time = base_times.get(sid, 60)
        effective_time = float(base_time)

        # Medical boost
        if medical and s.get("has_medical_power", False):
            effective_time *= 0.8

        # Pet deprioritise
        if pets and not s.get("has_pet_area", False):
            effective_time += 30

        # Occupancy penalty
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

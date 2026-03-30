import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import cache
import demo_state
import orchestrator

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"

SCENARIO_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "scenarios", "2023-west-kelowna")


# Loads scenario files into cache on startup regardless of mode.
@asynccontextmanager
async def lifespan(app: FastAPI):
    from demo import load_demo_data
    load_demo_data()
    yield


app = FastAPI(title="EMBER API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve scenario GeoJSON and JSON files at /static/
app.mount("/static", StaticFiles(directory=SCENARIO_DIR), name="static")


@app.get("/api/config")
def get_config():
    return {"demo_mode": DEMO_MODE}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/briefing")
async def get_briefing(
    address: str = Query(default="1240 Marble Terrace, West Kelowna, BC"),
    mobility: bool = Query(default=False),
    medical: bool = Query(default=False),
    pets: bool = Query(default=False),
    no_vehicle: bool = Query(default=False),
):
    profile_flags = {
        "mobility": mobility,
        "medical": medical,
        "pets": pets,
        "no_vehicle": no_vehicle,
    }

    result = await orchestrator.run_briefing(address, profile_flags, DEMO_MODE)

    state = demo_state.get_state()
    updated_at = state.get("current_time", datetime.now(timezone.utc).isoformat())

    return {
        "updated_at": updated_at,
        "threat": result.get("threat"),
        "route": {
            "summary": (result.get("route") or {}).get("summary"),
            "distance_km": (result.get("route") or {}).get("distance_km"),
            "duration_min": (result.get("route") or {}).get("duration_min"),
            "polyline": (result.get("route") or {}).get("polyline", ""),
            "fallback_summary": (result.get("route") or {}).get("fallback_summary"),
        } if result.get("route") else None,
        "shelter": result.get("shelter"),
        "closures": result.get("closures", []),
        "briefing_text": result.get("briefing_text", ""),
        "user_location": result.get("user_location"),
        "fire_perimeter_geojson": "/static/mcdougall_creek_perimeter.geojson",
        "projections_geojson": [
            "/static/spread_2hr.geojson",
            "/static/spread_4hr.geojson",
            "/static/spread_6hr.geojson",
        ],
    }


@app.get("/api/admin/situation")
async def get_situation():
    state = demo_state.get_state()
    shelters_data = cache.get("shelters:all") or {}
    closures_data = cache.get("drivebc:closures") or {}
    weather_data = cache.get("weather:1277") or {}

    # Look up wind from the weather CSV at the hour matching current sim time.
    wind = {"speed_kmh": 42, "direction": "NE"}
    current_time_str = state.get("current_time", "")
    try:
        sim_hour = datetime.fromisoformat(current_time_str).hour
    except (ValueError, TypeError):
        sim_hour = 19
    hourly = weather_data.get("hourly", [])
    for entry in hourly:
        if entry.get("date") == "2023-08-17" and entry.get("hour") == sim_hour:
            spd = entry.get("wind_speed_kmh")
            deg = entry.get("wind_direction_deg", 0)
            if spd is not None:
                dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
                wind = {"speed_kmh": spd, "direction": dirs[round(deg / 45) % 8]}
            break

    active_ids = state.get("active_closures", [])
    all_closures = {c["id"]: c for c in closures_data.get("road_closures", [])}
    roads = [
        {
            "road": all_closures[cid]["road_name"],
            "status": all_closures[cid]["status"],
            "lat": all_closures[cid]["midpoint"]["lat"],
            "lng": all_closures[cid]["midpoint"]["lng"],
        }
        for cid in active_ids
        if cid in all_closures
    ]

    shelter_statuses = state.get("shelter_statuses", {})
    shelters_out = [
        {
            "id": s["id"],
            "name": s["name"],
            "status": shelter_statuses.get(s["id"], "Open"),
            "capacity_estimate": s.get("capacity_estimate"),
            "is_accessible": s.get("is_accessible"),
            "has_pet_area": s.get("has_pet_area"),
            "has_medical_power": s.get("has_medical_power"),
        }
        for s in shelters_data.get("shelters", [])
    ]

    evacuations = state.get("evacuations", {"under_order": 2462, "under_alert": 4801})

    return {
        "fire": {
            "id": "K52767",
            "name": "McDougall Creek",
            "hectares": 1100,
            "spread_rate": "HIGH",
            "wind": wind,
            "perimeter_url": "/static/mcdougall_creek_perimeter.geojson",
        },
        "evacuations": evacuations,
        "roads": roads,
        "shelters": shelters_out,
        "updated_at": state.get("current_time"),
        "timeline_step": state.get("timeline_step", 1),
        "max_step": demo_state.MAX_STEP,
        "active_closure_ids": active_ids,
    }


@app.post("/api/admin/shelter/{shelter_id}/status")
async def set_shelter_status(shelter_id: str, body: dict):
    status = body.get("status")
    if not status:
        return {"error": "status field required"}
    demo_state.set_shelter_status(shelter_id, status)
    return {
        "id": shelter_id,
        "status": status,
        "updated_at": demo_state.get_state().get("current_time"),
    }


@app.post("/api/admin/simulate/closure")
async def simulate_closure(body: dict):
    closure_id = body.get("closure_id")
    if not closure_id:
        return {"error": "closure_id field required"}
    state = demo_state.get_state()
    active = list(state.get("active_closures", []))
    if closure_id not in active:
        active.append(closure_id)
    demo_state.set_active_closures(active)
    return {
        "active_closures": active,
        "updated_at": state.get("current_time"),
    }


@app.post("/api/admin/simulate/advance")
async def simulate_advance():
    state = demo_state.advance_time()
    return {
        "current_time": state["current_time"],
        "timeline_step": state["timeline_step"],
        "max_step": demo_state.MAX_STEP,
    }


@app.post("/api/admin/simulate/reset")
async def simulate_reset():
    demo_state.reset()
    state = demo_state.get_state()
    return {
        "current_time": state["current_time"],
        "timeline_step": state["timeline_step"],
        "max_step": demo_state.MAX_STEP,
    }

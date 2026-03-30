"""
Demo data loader — pre-populates the cache from scenario files at startup.
Called once by main.py lifespan when DEMO_MODE=true.
"""

import json
from pathlib import Path

import cache
import demo_state

SCENARIO_DIR = Path(__file__).parent.parent / "data" / "scenarios" / "2023-west-kelowna"

_FILES = {
    "fire_perimeter:K52767": "mcdougall_creek_perimeter.geojson",
    "weather:1277": "station_1277_weather.json",
    "drivebc:closures": "road_closures.json",
    "shelters:all": "shelters.json",
    "directions:demo": "demo_route.json",
    "briefing:demo": "demo_briefing.json",
    "spread:2hr": "spread_2hr.geojson",
    "spread:4hr": "spread_4hr.geojson",
    "spread:6hr": "spread_6hr.geojson",
}


def load_demo_data() -> None:
    """Load all scenario files into the in-memory cache and reset demo state."""
    for cache_key, filename in _FILES.items():
        path = SCENARIO_DIR / filename
        if path.exists():
            with open(path) as f:
                cache.set(cache_key, json.load(f), no_expire=True)
        else:
            print(f"[demo] WARNING: {path} not found — skipping {cache_key}")

    demo_state.reset()
    print(f"[demo] Loaded {len(_FILES)} scenario files into cache.")

"""
Threat Agent — computes fire threat assessment for a given location.

Inputs:  user (lat, lng) + fire perimeter GeoJSON + weather data (from cache)
Outputs: distance_km, time_to_perimeter_hours, spread_rate, wind
"""

from __future__ import annotations

import math

import cache

# Aug 17 7PM weather snapshot from station 1277 (used as fallback)
DEMO_WEATHER = {
    "speed_kmh": 42,
    "direction": "NE",
    "isi": 24.4,
}

# ISI to rate of spread (km/h) + classification
ISI_TABLE = [
    (5, 0.5, "LOW"),
    (10, 1.0, "MODERATE"),
    (20, 2.0, "HIGH"),
    (float("inf"), 4.0, "EXTREME"),
]


# Maps an ISI value to (rate_kmh, classification).
def _isi_to_spread(isi: float):
    for threshold, rate, label in ISI_TABLE:
        if isi < threshold:
            return rate, label
    return 4.0, "EXTREME"


# Converts wind direction in degrees to a compass label.
def _deg_to_compass(deg: float) -> str:
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = round(deg / 45) % 8
    return directions[idx]


# Computes great-circle distance in km between two lat/lng points.
def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Finds the nearest distance from user coords to any vertex of the fire perimeter.
def _nearest_perimeter_distance_km(user_lat: float, user_lng: float, perimeter: dict) -> float:
    min_dist = float("inf")
    for feature in perimeter.get("features", []):
        geom = feature.get("geometry", {})
        rings = geom.get("coordinates", [])
        if geom.get("type") == "MultiPolygon":
            vertex_lists = [ring for poly in rings for ring in poly]
        else:
            vertex_lists = rings
        for ring in vertex_lists:
            for lng, lat in ring:
                d = _haversine_km(user_lat, user_lng, lat, lng)
                if d < min_dist:
                    min_dist = d
    return round(min_dist, 2)


# Returns wind/ISI data from the weather cache or demo defaults.
def _get_weather() -> dict:
    weather_data = cache.get("weather:1277")
    if not weather_data:
        return DEMO_WEATHER

    hourly = weather_data.get("hourly", [])
    snapshot = None
    for entry in hourly:
        if entry.get("date") == "2023-08-17" and entry.get("hour") == 19:
            snapshot = entry
            break
    if not snapshot:
        return DEMO_WEATHER

    speed = snapshot.get("wind_speed_kmh") or DEMO_WEATHER["speed_kmh"]
    deg = snapshot.get("wind_direction_deg") or 0
    isi = snapshot.get("isi") or DEMO_WEATHER["isi"]
    return {"speed_kmh": speed, "direction": _deg_to_compass(deg), "isi": isi}


# Computes fire threat assessment for the given user coordinates.
async def run(user_lat: float, user_lng: float, demo_mode: bool) -> dict:
    weather = _get_weather()
    spread_rate_kmh, spread_label = _isi_to_spread(weather["isi"])

    perimeter = cache.get("fire_perimeter:K52767")
    if perimeter:
        distance_km = _nearest_perimeter_distance_km(user_lat, user_lng, perimeter)
    else:
        distance_km = 7.4

    time_to_perimeter = round(distance_km / spread_rate_kmh, 1) if spread_rate_kmh > 0 else 99.0

    return {
        "distance_km": distance_km,
        "time_to_perimeter_hours": time_to_perimeter,
        "spread_rate": spread_label,
        "wind": {
            "speed_kmh": weather["speed_kmh"],
            "direction": weather["direction"],
        },
    }

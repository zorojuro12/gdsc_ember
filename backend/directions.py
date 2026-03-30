"""
Google Maps Directions API wrapper — route calculation and drive time lookups.
Results are cached by origin+destination to avoid repeat API calls.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

import cache

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


# Returns a route dict {summary, distance_km, duration_min, polyline} or None on failure.
async def get_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    avoid_roads: list[str] | None = None,
) -> dict | None:
    cache_key = f"directions:{origin_lat},{origin_lng}->{dest_lat},{dest_lng}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    if not GOOGLE_MAPS_API_KEY:
        return None

    try:
        params: dict = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "key": GOOGLE_MAPS_API_KEY,
            "mode": "driving",
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(DIRECTIONS_URL, params=params)
            data = resp.json()

        if data.get("status") != "OK" or not data.get("routes"):
            return None

        route = data["routes"][0]
        leg = route["legs"][0]

        result = {
            "summary": route.get("summary", ""),
            "distance_km": round(leg["distance"]["value"] / 1000, 1),
            "duration_min": round(leg["duration"]["value"] / 60),
            "polyline": route["overview_polyline"]["points"],
        }
        cache.set(cache_key, result)
        return result
    except Exception as e:
        print(f"[directions] get_route error: {e}")
        return None


# Returns drive time in minutes from origin to destination, or None on failure.
async def get_drive_time(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> int | None:
    cache_key = f"drivetime:{origin_lat},{origin_lng}->{dest_lat},{dest_lng}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    if not GOOGLE_MAPS_API_KEY:
        return None

    try:
        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "key": GOOGLE_MAPS_API_KEY,
            "mode": "driving",
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(DIRECTIONS_URL, params=params)
            data = resp.json()

        if data.get("status") != "OK" or not data.get("routes"):
            return None

        minutes = round(data["routes"][0]["legs"][0]["duration"]["value"] / 60)
        cache.set(cache_key, minutes)
        return minutes
    except Exception as e:
        print(f"[directions] get_drive_time error: {e}")
        return None

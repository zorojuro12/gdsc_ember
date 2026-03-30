"""
Google Maps Geocoding API wrapper — converts an address string to (lat, lng).
Results are cached in the in-memory cache to avoid repeat API calls.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

import cache

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


# Converts an address string to (lat, lng) via Google Geocoding API, with cache.
async def geocode(address: str) -> tuple[float, float] | None:
    cache_key = f"geocode:{address}"
    cached = cache.get(cache_key)
    if cached:
        return (cached["lat"], cached["lng"])

    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                GEOCODE_URL,
                params={"address": address, "key": api_key},
            )
            data = resp.json()

        if data.get("status") != "OK" or not data.get("results"):
            return None

        location = data["results"][0]["geometry"]["location"]
        lat, lng = location["lat"], location["lng"]
        cache.set(cache_key, {"lat": lat, "lng": lng})
        return (lat, lng)
    except Exception as e:
        print(f"[geocode] Error: {e}")
        return None

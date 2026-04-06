import time

_cache: dict = {}

TTL = {
    "fire_perimeter": 900,
    "drivebc": 300,
    "weather": 900,
    "directions": 600,
    "geocode": 3600,
    "drivetime": 600,
}


# Returns cached data for the given key if it exists and has not expired.
def get(key: str):
    entry = _cache.get(key)
    if entry:
        if entry.get("no_expire") or time.time() - entry["ts"] < TTL.get(key.split(":")[0], 300):
            return entry["data"]
    return None


# Stores data in the cache under the given key with the current timestamp.
# Pass no_expire=True for static data that should never be evicted (demo mode).
def set(key: str, data, no_expire: bool = False) -> None:
    _cache[key] = {"data": data, "ts": time.time(), "no_expire": no_expire}


# Removes all entries from the cache — used when resetting demo state.
def clear() -> None:
    _cache.clear()

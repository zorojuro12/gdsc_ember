"""
Mutable demo scenario state — module-level singleton shared by all agents.
Phase 5 admin endpoints mutate this; all agents read from it.
Phase 3 implements get_state, set_shelter_status, set_active_closures, reset.
Phase 5 adds advance_time.
"""

_state: dict = {}

# Initial state: Aug 17 7:00 PM — 2 closures active (Bear Creek + Westside)
_INITIAL_STATE = {
    "current_time": "2023-08-17T19:00:00-07:00",
    "timeline_step": 1,
    "active_closures": ["closure_004", "closure_001"],
    "shelter_statuses": {
        "shelter_001": "Open",
        "shelter_002": "Open",
        "shelter_003": "Open",
        "shelter_004": "Open",
        "shelter_005": "Open",
    },
}


def reset() -> None:
    """Restore state to the Aug 17 7PM starting point."""
    global _state
    _state = {
        "current_time": _INITIAL_STATE["current_time"],
        "timeline_step": _INITIAL_STATE["timeline_step"],
        "active_closures": list(_INITIAL_STATE["active_closures"]),
        "shelter_statuses": dict(_INITIAL_STATE["shelter_statuses"]),
    }


def get_state() -> dict:
    return _state


def set_shelter_status(shelter_id: str, status: str) -> None:
    _state["shelter_statuses"][shelter_id] = status


def set_active_closures(closure_ids: list) -> None:
    _state["active_closures"] = list(closure_ids)


# Initialise on import so agents can always read a valid state.
reset()

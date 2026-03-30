"""
Mutable demo scenario state — module-level singleton shared by all agents.
Phase 5 admin endpoints mutate this; all agents read from it.
"""

_state: dict = {}

# Ordered timeline milestones. Each step is a full snapshot — closures,
# shelter statuses, and evacuations are applied wholesale when that step
# becomes active. Advancing always moves exactly one step forward.
TIMELINE = [
    {
        "step": 1,
        "time": "2023-08-17T19:00:00-07:00",
        "active_closures": ["closure_004", "closure_001"],
        "shelter_statuses": {
            "shelter_001": "Open",
            "shelter_002": "Open",
            "shelter_003": "Open",
            "shelter_004": "Open",
            "shelter_005": "Open",
        },
        "evacuations": {"under_order": 2462, "under_alert": 4801},
    },
    {
        "step": 2,
        "time": "2023-08-17T20:00:00-07:00",
        "active_closures": ["closure_004", "closure_001", "closure_002"],
        "shelter_statuses": {
            "shelter_001": "Open",
            "shelter_002": "Open",
            "shelter_003": "Open",
            "shelter_004": "Open",
            "shelter_005": "Open",
        },
        "evacuations": {"under_order": 2462, "under_alert": 4801},
    },
    {
        "step": 3,
        "time": "2023-08-17T21:00:00-07:00",
        "active_closures": ["closure_004", "closure_001", "closure_002", "closure_003"],
        "shelter_statuses": {
            "shelter_001": "Filling",
            "shelter_002": "Open",
            "shelter_003": "Open",
            "shelter_004": "Open",
            "shelter_005": "Open",
        },
        "evacuations": {"under_order": 2462, "under_alert": 4801},
    },
    {
        "step": 4,
        "time": "2023-08-17T21:55:00-07:00",
        "active_closures": ["closure_004", "closure_001", "closure_002", "closure_003"],
        "shelter_statuses": {
            "shelter_001": "Near Full",
            "shelter_002": "Filling",
            "shelter_003": "Open",
            "shelter_004": "Open",
            "shelter_005": "Open",
        },
        "evacuations": {"under_order": 2462, "under_alert": 4801},
    },
]

MAX_STEP = len(TIMELINE)


def _apply_step(step_dict: dict) -> None:
    _state["current_time"] = step_dict["time"]
    _state["timeline_step"] = step_dict["step"]
    _state["active_closures"] = list(step_dict["active_closures"])
    _state["shelter_statuses"] = dict(step_dict["shelter_statuses"])
    _state["evacuations"] = dict(step_dict["evacuations"])


def reset() -> None:
    """Restore state to the Aug 17 7PM starting point (step 1)."""
    global _state
    _state = {}
    _apply_step(TIMELINE[0])


def get_state() -> dict:
    return _state


def advance_time() -> dict:
    """Advance one step forward. Capped at the last milestone. Returns new state."""
    current_step = _state.get("timeline_step", 1)
    next_step = min(current_step + 1, MAX_STEP)
    _apply_step(TIMELINE[next_step - 1])
    return get_state()


def set_shelter_status(shelter_id: str, status: str) -> None:
    _state["shelter_statuses"][shelter_id] = status


def set_active_closures(closure_ids: list) -> None:
    _state["active_closures"] = list(closure_ids)


# Initialise on import so agents can always read a valid state.
reset()

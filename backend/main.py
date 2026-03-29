import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"


# Runs once at startup — pre-populates cache when in Demo Mode.
@asynccontextmanager
async def lifespan(app: FastAPI):
    if DEMO_MODE:
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


# Returns whether the backend is running in Demo Mode.
@app.get("/api/config")
def get_config():
    return {"demo_mode": DEMO_MODE}


# Returns current server health status.
@app.get("/api/health")
def health():
    return {"status": "ok"}


# Returns the full evacuation briefing for a given address.
@app.get("/api/briefing")
async def get_briefing(address: str):
    # Orchestrator wired in Phase 3
    return {"detail": "not implemented"}


# Returns fire situation summary for the admin dashboard.
@app.get("/api/admin/situation")
async def get_situation():
    # Implemented in Phase 3
    return {"detail": "not implemented"}


# Overrides the status of a shelter by ID.
@app.post("/api/admin/shelter/{shelter_id}/status")
async def set_shelter_status(shelter_id: str, body: dict):
    # Implemented in Phase 5
    return {"detail": "not implemented"}


# Activates a road closure in the demo timeline.
@app.post("/api/admin/simulate/closure")
async def simulate_closure(body: dict):
    # Implemented in Phase 5
    return {"detail": "not implemented"}


# Advances the demo clock by a given number of hours.
@app.post("/api/admin/simulate/advance")
async def simulate_advance(body: dict):
    # Implemented in Phase 5
    return {"detail": "not implemented"}

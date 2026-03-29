# EMBER — BC Wildfire Community Evacuation Intelligence Platform

Real-time wildfire evacuation briefings using BC government open data. Built for the GDSC Hack the Sem hackathon.

**Demo scenario:** 2023 McDougall Creek Fire (K52767), Aug 15–19, West Kelowna, BC.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS v4, Mapbox GL JS, React Query |
| Backend | Python 3.11+, FastAPI, Shapely, pandas |
| LLM | Anthropic Claude Sonnet (single call per briefing) |
| Deploy | Vercel (frontend), Railway (backend) |

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **npm** (comes with Node)

## Getting Started

### 1. Clone and set up environment variables

```bash
git clone https://github.com/<your-org>/gdsc_ember.git
cd gdsc_ember
cp .env.example .env
```

Edit `.env` and fill in your keys:

```
MAPBOX_TOKEN=your_mapbox_token
GOOGLE_MAPS_API_KEY=your_google_maps_key
ANTHROPIC_API_KEY=your_anthropic_key
DEMO_MODE=true
```

> **Demo Mode** (`DEMO_MODE=true`) is the default. Everything works fully offline from static scenario files — no API keys required to run the demo.

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be running at `http://localhost:8000`. Check health at `http://localhost:8000/api/health`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`.

## Project Structure

```
frontend/              React app (Vite + TypeScript)
backend/               FastAPI app
  main.py              App entrypoint, all API endpoints
  cache.py             In-memory dict cache with TTL
  demo.py              Demo data loader (pre-populates cache from scenario files)
  agents/              The 4 agent modules (Threat, Route, Shelter, Profile)
data/scenarios/        Static demo scenario files
  2023-west-kelowna/   McDougall Creek fire data (GeoJSON, JSON, CSV)
docs/                  Project overview documents
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/config` | Returns demo mode status |
| GET | `/api/briefing?address=...` | Full evacuation briefing for a resident |
| GET | `/api/admin/situation` | Fire situation summary for admin dashboard |
| POST | `/api/admin/shelter/{id}/status` | Override shelter status |
| POST | `/api/admin/simulate/closure` | Activate a road closure in demo |
| POST | `/api/admin/simulate/advance` | Advance demo clock |

## License

MIT

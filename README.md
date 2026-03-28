# Iten Forge

12-week marathon training plan engine. Forged in the City of Champions.

Set your goal time. Every pace, every interval, every long run recalculates. One input, 84 days of structured training.

## Quickstart

```bash
# Install
poetry install

# Run locally
make serve

# Run tests
make test

# API is at http://localhost:8000
```

## How it works

One input drives the entire plan:

```
ITEN_FORGE_GOAL_TIME=2:50:00
```

All pace zones are derived mathematically from your marathon goal:

| Zone | Offset from MP | Example (2:50 goal) |
|------|---------------|-------------------|
| Easy | MP + 2:10 | ~8:39/mi |
| Recovery | MP + 3:15 | ~9:44/mi |
| Marathon | MP | 6:29/mi |
| Tempo | MP - 0:20 | ~6:09/mi |
| Threshold | MP - 0:30 | ~5:59/mi |
| 5K/Interval | MP - 0:55 | ~5:34/mi |

Change the goal, everything repopulates. Works in miles or kilometers.

## API

All endpoints are stateless. Pass your goal as a query parameter:

```
GET /api/plan?goal=3:15:00&unit=km
GET /api/plan/paces?goal=2:50:00
GET /api/plan/workout/2026-03-10?goal=2:50:00
GET /api/plan/week/5?goal=2:50:00
```

The `/api/plan` response includes pace zones, estimated weekly mileage, and all 84 days of workouts.

## Weekly structure

| Day | Session |
|-----|---------|
| Monday | Progressive Run |
| Tuesday | Track Intervals |
| Wednesday | Tempo Run |
| Thursday | Fartlek |
| Friday | Easy Run |
| Saturday | Long Run |
| Sunday | Rest |

Evening sessions Mon-Fri alternate between recovery runs and weights.

Periodization: Build (weeks 1-4), Peak (5-9), Taper (10-12).

## Configuration

Environment variables (or `.env` file):

```bash
ITEN_FORGE_GOAL_TIME=2:50:00     # Marathon goal (H:MM:SS)
ITEN_FORGE_START_DATE=2026-03-09  # First day of training
ITEN_FORGE_UNIT=mi                # "mi" or "km"
```

## Docker

```bash
docker compose up --build
```

## Project structure

```
iten-forge/
  iten_forge/
    config.py       Settings from environment
    paces.py        Pace zone calculator
    plan.py         12-week plan engine
    server.py       FastAPI server
  static/           Frontend (HTML/CSS/JS)
  tests/
  pyproject.toml
  Dockerfile
  docker-compose.yml
  Makefile
```

## Development

```bash
make install    # poetry install
make serve      # uvicorn with hot reload
make test       # pytest
make lint       # ruff check
make format     # ruff format
make clean      # cleanup
```

## License

MIT

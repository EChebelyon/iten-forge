# Iten Forge

12-week marathon training plan engine. Forged in the City of Champions.

Set your goal time. Every pace, every interval, every long run recalculates. One input, 84 days of structured training.

## Quickstart

```bash
# Install
poetry install

# Run tests
make test

# Local dev (Postgres + API server)
make dev

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

All plan endpoints are stateless. Pass your goal as a query parameter:

```
GET /api/plan?goal=3:15:00&unit=km
GET /api/plan/paces?goal=2:50:00
GET /api/plan/workout/2026-03-10?goal=2:50:00
GET /api/plan/week/5?goal=2:50:00
```

Journal endpoints (require Postgres):

```
GET /api/entries?week=5&entry_type=rpe
GET /api/summary/7
```

## Weekly structure

| Day | Session | Icon |
|-----|---------|------|
| Monday | Progressive Run | `progressive` |
| Tuesday | Track Intervals | `track` |
| Wednesday | Tempo Run | `tempo` |
| Thursday | Fartlek | `fartlek` |
| Friday | Easy Run | `easy` |
| Saturday | Long Run | `long-run` |
| Sunday | Rest | `rest` |

Evening sessions Mon-Fri alternate between recovery runs and weights.

Periodization: Build (weeks 1-4), Peak (5-9), Taper (10-12).

## Configuration

Environment variables (or `.env` file):

```bash
ITEN_FORGE_GOAL_TIME=2:50:00     # Marathon goal (H:MM:SS)
ITEN_FORGE_START_DATE=2026-03-09  # First day of training
ITEN_FORGE_UNIT=mi                # "mi" or "km"
DATABASE_URL=postgresql://...     # For journal features
```

See `.env.example` for the full list including Twilio config.

## Docker

```bash
# Full stack (Postgres + API)
docker compose up --build

# Just build
docker compose build
```

## WhatsApp journal

The server doubles as a WhatsApp bot via Twilio webhook. Log RPE, injuries, nutrition, route notes. See `.env.example` for Twilio setup.

Commands: `rpe 7`, `injury left shin`, `fuel 3 gels`, `today`, `tomorrow`, `summary`, `help`

## Garmin export

```bash
poetry run python garmin/export_garmin_workouts.py > garmin_workouts.json
```

## Project structure

```
iten-forge/
  iten_forge/
    config.py       Settings from environment
    paces.py        Pace zone calculator
    plan.py         12-week plan engine
    server.py       FastAPI server
  tests/
  scripts/
    send_reminder.py  GitHub Actions daily WhatsApp reminder
  garmin/
    export_garmin_workouts.py
  pyproject.toml
  Dockerfile
  docker-compose.yml
  Makefile
```

## Development

```bash
make install    # poetry install
make test       # pytest
make lint       # ruff check
make format     # ruff format
make dev        # docker compose up
make clean      # tear down + cleanup
```

## License

MIT

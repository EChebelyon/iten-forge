# Iten Forge

12-week training plan engine for 5K, 10K, half marathon, and marathon. Forged in the City of Champions.

Set your goal time and distance. Every pace, every interval, every long run recalculates. Two inputs, 84 days of structured training.

> Even 1500m world record holders run ~50 miles a week. Volume is the foundation — speed is the seasoning.

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

Two inputs drive the entire plan:

```
ITEN_FORGE_GOAL_TIME=17:00
ITEN_FORGE_DISTANCE=5k        # marathon | half | 10k | 5k
```

### Pace model

Training zones are anchored to your **5K-equivalent pace**, not your race pace. Why: a 17:00 5K runner and a 2:50 marathoner have very different race paces, but their easy, tempo, and interval efforts live at similar *physiological* efforts relative to their VO2max. Anchoring to 5K-equivalent keeps those relationships honest across distances.

The 5K-equivalent is derived from your goal via Riegel's formula:

```
T_5k = T_goal × (5K / goal_distance)^1.06
```

Zones then sit at fixed offsets from that equivalent pace (seconds per mile; scaled for km):

| Zone | Offset from 5K-equiv | What it is |
|------|---------------------|------------|
| 5K / Interval | +0 | VO2max reps — 1K/mile repeats |
| Threshold | +0:15 | Cruise intervals, ~1hr race pace |
| Tempo | +0:25 | Sustained tempo / "comfortably hard" |
| Easy | +1:45 | Conversational aerobic miles |
| Recovery | +2:45 | Shakeouts, recovery doubles |
| Race pace | goal ÷ goal distance | Actual target pace for the race |

### Example paces by goal

| Goal | Race pace | Tempo | Easy | 5K/Interval |
|------|-----------|-------|------|-------------|
| 5K 17:00 | 5:28/mi | 5:53/mi | 7:13/mi | 5:28/mi |
| 10K 36:00 | 5:48/mi | 5:58/mi | 7:18/mi | 5:33/mi |
| Half 1:20 | 6:06/mi | 6:01/mi | 7:21/mi | 5:36/mi |
| Marathon 2:50 | 6:29/mi | 6:08/mi | 7:28/mi | 5:43/mi |

Change the goal or distance, everything repopulates. Works in miles or kilometers.

## Tiers: Competitive vs. Just Finish

Every distance has two tiers, picked automatically from your goal time:

| Distance | Competitive if faster than |
|----------|---------------------------|
| Marathon | 3:30:00 |
| Half | 1:35:00 |
| 10K | 42:00 |
| 5K | 20:00 |

**Competitive** — higher mileage, structured speedwork, doubles, progressive long runs with fast finishes.

**Just Finish** — moderate mileage, mostly easy running, no doubles, long runs kept honest. Built to get you to the line healthy.

If you can't access a track, substitute an equivalent road/path interval session — the plan still works.

## API

All endpoints are stateless. Pass your goal as a query parameter:

```
GET /api/plan?goal=17:00&distance=5k&unit=mi
GET /api/plan/paces?goal=2:50:00&distance=marathon
GET /api/plan/workout/2026-03-10?goal=1:20:00&distance=half
GET /api/plan/week/5?goal=40:00&distance=10k
```

Valid `distance` values: `marathon`, `half`, `10k`, `5k`.

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

Evening sessions Mon-Fri alternate between recovery runs and weights (competitive tier).

Periodization: Build (weeks 1-4), Peak (5-9), Taper (10-12).

Long runs scale with the goal distance: 40K peak for marathon, 24K for half, 17K for 10K, 13K for 5K.

## Configuration

Environment variables (or `.env` file):

```bash
ITEN_FORGE_GOAL_TIME=2:50:00      # Goal time (H:MM:SS or MM:SS)
ITEN_FORGE_DISTANCE=marathon      # marathon | half | 10k | 5k
ITEN_FORGE_START_DATE=2026-03-09  # First day of training
ITEN_FORGE_UNIT=mi                # "mi" or "km"
```

## Docker

```bash
docker compose up --build
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

"""
FastAPI server. REST API for training plan paces and workouts.

The plan endpoints are stateless -- pass ?goal=2:50:00&distance=marathon to get a personalized plan.
"""

import logging
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from iten_forge.config import DISTANCE, GOAL_TIME, START_DATE, UNIT
from iten_forge.plan import Plan

log = logging.getLogger(__name__)

VALID_DISTANCES = {"marathon", "half"}

app = FastAPI(
    title="Iten Forge",
    description="Forged in the City of Champions",
    version="0.2.0",
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def root():
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(str(index))
    return {"message": "Iten Forge API", "docs": "/docs"}


def _plan(goal: str | None = None, unit: str | None = None, distance: str | None = None) -> Plan:
    d = distance or DISTANCE
    if d not in VALID_DISTANCES:
        raise HTTPException(status_code=400, detail=f"Invalid distance: {d}")
    return Plan(
        goal_time=goal or GOAL_TIME,
        start_date=START_DATE,
        unit=unit or UNIT,
        distance=d,
    )


# -- Plan API (stateless) --


@app.get("/api/plan")
def get_plan(goal: str = GOAL_TIME, unit: str = UNIT, distance: str = DISTANCE):
    """Full 12-week plan for a given goal time and distance."""
    plan = _plan(goal, unit, distance)
    return {
        "goal": goal,
        "unit": unit,
        "distance": distance,
        "tier": "competitive" if plan.is_competitive else "just_finish",
        "start_date": plan.start_date.isoformat(),
        "race_day": plan.race_day.isoformat(),
        "paces": plan.paces.all_zones(),
        "mileage": plan.weekly_mileage(),
        "workouts": plan.all_workouts(),
    }


@app.get("/api/plan/paces")
def get_paces(goal: str = GOAL_TIME, unit: str = UNIT, distance: str = DISTANCE):
    """Pace zones for a given goal time."""
    plan = _plan(goal, unit, distance)
    return {"goal": goal, "unit": unit, "distance": distance, "paces": plan.paces.all_zones()}


@app.get("/api/plan/workout/{target_date}")
def get_workout(target_date: str, goal: str = GOAL_TIME, unit: str = UNIT, distance: str = DISTANCE):
    """Single day workout."""
    plan = _plan(goal, unit, distance)
    d = date.fromisoformat(target_date)
    w = plan.workout(d)
    if w is None:
        return {"error": "Date outside training window"}
    return w


@app.get("/api/plan/week/{week}")
def get_week(week: int, goal: str = GOAL_TIME, unit: str = UNIT, distance: str = DISTANCE):
    """All workouts for a given week (1-12)."""
    plan = _plan(goal, unit, distance)
    start = plan.start_date + timedelta(weeks=week - 1)
    workouts = []
    for i in range(7):
        d = start + timedelta(days=i)
        w = plan.workout(d)
        if w:
            workouts.append(w)
    return {"week": week, "phase": plan.phase(week), "workouts": workouts}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

#!/usr/bin/env python3
"""
Export the full training plan as structured JSON for Garmin Connect.

Usage:
    python -m garmin.export_garmin_workouts > garmin_workouts.json
    # or
    poetry run python garmin/export_garmin_workouts.py > garmin_workouts.json
"""

import json

from iten_forge.config import GOAL_TIME, START_DATE, UNIT
from iten_forge.plan import Plan


def main():
    plan = Plan(goal_time=GOAL_TIME, start_date=START_DATE, unit=UNIT)
    workouts = []

    for w in plan.all_workouts():
        if w["title"] == "Rest Day":
            continue
        workouts.append(
            {
                "date": w["date"],
                "week": w["week"],
                "phase": w["phase"],
                "name": f"W{w['week']}_{w['day'][:3]}_{w['title'].replace(' ', '_')}",
                "title": w["title"],
                "summary": w["summary"],
                "steps": w.get("garmin_steps", []),
            }
        )

    print(json.dumps(workouts, indent=2))


if __name__ == "__main__":
    main()

import os
from datetime import date

GOAL_TIME = os.environ.get("ITEN_FORGE_GOAL_TIME", "2:50:00")
START_DATE = date.fromisoformat(os.environ.get("ITEN_FORGE_START_DATE", "2026-03-09"))
UNIT = os.environ.get("ITEN_FORGE_UNIT", "mi")

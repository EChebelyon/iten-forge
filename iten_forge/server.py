"""
FastAPI server. Webhook for WhatsApp journal logging + REST API for training plan.

The plan endpoints are stateless -- pass ?goal=2:50:00 to get a personalized plan.
The journal endpoints use PostgreSQL for persistence.
"""

import re
from contextlib import asynccontextmanager
from datetime import date, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional

import asyncpg
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from twilio.twiml.messaging_response import MessagingResponse

from iten_forge.config import DATABASE_URL, GOAL_TIME, START_DATE, UNIT
from iten_forge.plan import Plan

# -- Lifespan --

db_pool: Optional[asyncpg.Pool] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS journal_entries (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                training_date DATE NOT NULL,
                week INT NOT NULL,
                entry_type VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                rpe_value INT
            );
            CREATE INDEX IF NOT EXISTS idx_entries_date ON journal_entries(training_date);
            CREATE INDEX IF NOT EXISTS idx_entries_week ON journal_entries(week);
            CREATE INDEX IF NOT EXISTS idx_entries_type ON journal_entries(entry_type);
        """)
    yield
    if db_pool:
        await db_pool.close()


app = FastAPI(
    title="Iten Forge",
    description="Forged in the City of Champions",
    version="0.1.0",
    lifespan=lifespan,
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


def _plan(goal: str | None = None, unit: str | None = None) -> Plan:
    return Plan(
        goal_time=goal or GOAL_TIME,
        start_date=START_DATE,
        unit=unit or UNIT,
    )


# -- Plan API (stateless) --


@app.get("/api/plan")
def get_plan(goal: str = GOAL_TIME, unit: str = UNIT):
    """Full 12-week plan for a given goal time."""
    plan = _plan(goal, unit)
    return {
        "goal": goal,
        "unit": unit,
        "start_date": plan.start_date.isoformat(),
        "race_day": plan.race_day.isoformat(),
        "paces": plan.paces.all_zones(),
        "workouts": plan.all_workouts(),
    }


@app.get("/api/plan/paces")
def get_paces(goal: str = GOAL_TIME, unit: str = UNIT):
    """Pace zones for a given goal time."""
    plan = _plan(goal, unit)
    return {"goal": goal, "unit": unit, "paces": plan.paces.all_zones()}


@app.get("/api/plan/workout/{target_date}")
def get_workout(target_date: str, goal: str = GOAL_TIME, unit: str = UNIT):
    """Single day workout."""
    plan = _plan(goal, unit)
    d = date.fromisoformat(target_date)
    w = plan.workout(d)
    if w is None:
        return {"error": "Date outside training window"}
    return w


@app.get("/api/plan/week/{week}")
def get_week(week: int, goal: str = GOAL_TIME, unit: str = UNIT):
    """All workouts for a given week (1-12)."""
    plan = _plan(goal, unit)
    start = plan.start_date + timedelta(weeks=week - 1)
    workouts = []
    for i in range(7):
        d = start + timedelta(days=i)
        w = plan.workout(d)
        if w:
            workouts.append(w)
    return {"week": week, "phase": plan.phase(week), "workouts": workouts}


# -- Journal API (persistent) --


class EntryType(str, Enum):
    RPE = "rpe"
    ROUTE = "route"
    INJURY = "injury"
    NUTRITION = "nutrition"
    JOURNAL = "journal"


class JournalEntry(BaseModel):
    id: Optional[int] = None
    created_at: Optional[str] = None
    training_date: str
    week: int
    entry_type: str
    content: str
    rpe_value: Optional[int] = None


@app.get("/api/entries")
async def get_entries(
    week: Optional[int] = None, entry_type: Optional[str] = None, limit: int = 50
):
    query = "SELECT * FROM journal_entries WHERE 1=1"
    params = []
    i = 1
    if week:
        query += f" AND week = ${i}"
        params.append(week)
        i += 1
    if entry_type:
        query += f" AND entry_type = ${i}"
        params.append(entry_type)
        i += 1
    query += f" ORDER BY created_at DESC LIMIT ${i}"
    params.append(limit)
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


@app.get("/api/summary/{week}")
async def get_week_summary(week: int):
    async with db_pool.acquire() as conn:
        entries = await conn.fetch(
            "SELECT * FROM journal_entries WHERE week = $1 ORDER BY training_date", week
        )
        rpe_values = [e["rpe_value"] for e in entries if e["rpe_value"] is not None]
    return {
        "week": week,
        "total_entries": len(entries),
        "avg_rpe": round(sum(rpe_values) / len(rpe_values), 1) if rpe_values else None,
        "entries_by_type": {
            t: len([e for e in entries if e["entry_type"] == t])
            for t in set(e["entry_type"] for e in entries)
        },
        "entries": [dict(e) for e in entries],
    }


# -- WhatsApp Webhook --


def parse_message(text: str) -> dict:
    text = text.strip()
    lower = text.lower()

    rpe_match = re.match(r"^rpe\s+(\d{1,2})(?:\s+(.*))?$", lower, re.DOTALL)
    if rpe_match:
        rpe_val = max(1, min(10, int(rpe_match.group(1))))
        note = rpe_match.group(2) or ""
        content = f"RPE: {rpe_val}" + (f" -- {note}" if note else "")
        return {"type": EntryType.RPE, "content": content.strip(), "rpe": rpe_val}

    for prefix, entry_type in [
        ("injury", EntryType.INJURY),
        ("pain", EntryType.INJURY),
        ("sore", EntryType.INJURY),
        ("fuel", EntryType.NUTRITION),
        ("nutrition", EntryType.NUTRITION),
        ("ate", EntryType.NUTRITION),
        ("route", EntryType.ROUTE),
    ]:
        if lower.startswith(prefix):
            content = text[text.index(" ") + 1 :] if " " in text else text
            return {"type": entry_type, "content": content}

    commands = {
        "summary": "summary",
        "week": "summary",
        "this week": "summary",
        "today": "today",
        "workout": "today",
        "what's today": "today",
        "tomorrow": "tomorrow",
        "what's tomorrow": "tomorrow",
        "help": "help",
        "commands": "help",
        "?": "help",
    }
    if lower in commands:
        return {"type": "command", "command": commands[lower]}

    if lower.startswith("note ") or lower.startswith("journal "):
        return {"type": EntryType.JOURNAL, "content": text[text.index(" ") + 1 :]}

    return {"type": EntryType.JOURNAL, "content": text}


@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    form_data = await request.form()
    incoming_msg = form_data.get("Body", "").strip()

    resp = MessagingResponse()

    if not incoming_msg:
        resp.message("Send your training notes. Type 'help' for commands.")
        return Response(content=str(resp), media_type="application/xml")

    parsed = parse_message(incoming_msg)
    plan = _plan()

    if parsed.get("type") == "command":
        reply = await _handle_command(parsed["command"], plan)
        resp.message(reply)
        return Response(content=str(resp), media_type="application/xml")

    today = date.today()
    week, _ = plan.week_and_day(today)
    if week == 0:
        week = max(1, min(12, (today - plan.start_date).days // 7 + 1))

    entry_type = parsed["type"].value if isinstance(parsed["type"], EntryType) else parsed["type"]

    async with db_pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO journal_entries (training_date, week, entry_type, content, rpe_value)
               VALUES ($1, $2, $3, $4, $5)""",
            today,
            week,
            entry_type,
            parsed["content"],
            parsed.get("rpe"),
        )

    confirmations = {
        EntryType.RPE: f"RPE {parsed.get('rpe', '?')} logged.",
        EntryType.INJURY: "Injury note logged. Take care of yourself.",
        EntryType.NUTRITION: "Nutrition note logged.",
        EntryType.ROUTE: "Route note logged.",
        EntryType.JOURNAL: "Journal entry saved.",
    }
    resp.message(confirmations.get(parsed["type"], "Logged."))
    return Response(content=str(resp), media_type="application/xml")


async def _handle_command(command: str, plan: Plan) -> str:
    if command == "today":
        w = plan.workout(date.today())
        return plan.format_message(w)

    if command == "tomorrow":
        w = plan.workout(date.today() + timedelta(days=1))
        return plan.format_message(w)

    if command == "summary":
        return await _weekly_summary(plan)

    if command == "help":
        return (
            "ITEN FORGE -- Commands\n\n"
            "Log entries:\n"
            "  rpe 7 -- Log RPE (1-10)\n"
            "  rpe 8 felt strong -- RPE with notes\n"
            "  injury left shin tight -- Log injury\n"
            "  fuel 3 gels, water every 3k -- Nutrition\n"
            "  route construction on 5th ave -- Route note\n"
            "  note any text -- Journal entry\n\n"
            "Info:\n"
            "  today -- Today's workout\n"
            "  tomorrow -- Tomorrow's workout\n"
            "  summary -- This week's summary\n"
            "  help -- This message"
        )

    return "Unknown command. Type 'help' for options."


async def _weekly_summary(plan: Plan) -> str:
    today = date.today()
    week, _ = plan.week_and_day(today)
    if week == 0:
        return "Outside training window."

    async with db_pool.acquire() as conn:
        entries = await conn.fetch(
            "SELECT training_date, entry_type, content, rpe_value "
            "FROM journal_entries WHERE week = $1 ORDER BY training_date, created_at",
            week,
        )

    if not entries:
        return f"WEEK {week} SUMMARY\n\nNo entries logged yet. Start with 'rpe', 'note', etc."

    rpe_values = [e["rpe_value"] for e in entries if e["rpe_value"] is not None]
    avg_rpe = round(sum(rpe_values) / len(rpe_values), 1) if rpe_values else None
    injuries = sum(1 for e in entries if e["entry_type"] == "injury")

    lines = [f"WEEK {week} SUMMARY ({week}/12)", ""]
    if avg_rpe is not None:
        lines.append(f"Average RPE: {avg_rpe}/10 ({len(rpe_values)} sessions)")
    if injuries:
        lines.append(f"Injury notes: {injuries}")
    lines.append(f"Total entries: {len(entries)}")
    lines.append("")

    for e in entries[-5:]:
        lines.append(f"  {e['training_date']}: {e['content'][:60]}")

    return "\n".join(lines)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

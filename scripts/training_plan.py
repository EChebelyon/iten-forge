# training_plan.py
# Complete 12-week sub-2:50 marathon training plan
# Start date: 2026-03-09 (Monday)

from datetime import date, timedelta
from typing import Optional

START_DATE = date(2026, 3, 9)
RACE_DAY = START_DATE + timedelta(weeks=12)

PACES = {
    "easy": "8:30–9:00/mi",
    "recovery": "9:30–10:00/mi",
    "marathon": "6:10/mi",
    "tempo": "5:50–6:00/mi",
    "threshold": "5:40–5:50/mi",
    "5k": "5:15–5:25/mi",
}


def get_phase(week: int) -> str:
    if week <= 4:
        return "Build"
    elif week <= 9:
        return "Peak"
    return "Taper"


def get_phase_emoji(week: int) -> str:
    phase = get_phase(week)
    return {"Build": "🧱", "Peak": "🔥", "Taper": "🪶"}[phase]


def get_week_and_day(target_date: date) -> tuple[int, int]:
    """Returns (week_number 1-12, day_of_week 0=Mon..6=Sun) for a given date."""
    delta = (target_date - START_DATE).days
    if delta < 0 or delta >= 84:
        return (0, 0)
    week = delta // 7 + 1
    day = delta % 7
    return (week, day)


def get_workout(target_date: date) -> Optional[dict]:
    """Get the full workout for a given date."""
    week, day = get_week_and_day(target_date)
    if week == 0:
        return None

    phase = get_phase(week)
    workout = _build_workout(week, day)
    evening = _build_evening(week, day)

    return {
        "date": target_date.isoformat(),
        "week": week,
        "phase": phase,
        "phase_emoji": get_phase_emoji(week),
        "day_name": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
            day
        ],
        **workout,
        "evening": evening,
    }


def _build_workout(week: int, day: int) -> dict:
    if day == 0:
        return _monday(week)
    elif day == 1:
        return _tuesday(week)
    elif day == 2:
        return _wednesday(week)
    elif day == 3:
        return _thursday(week)
    elif day == 4:
        return _friday(week)
    elif day == 5:
        return _saturday(week)
    else:
        return _sunday(week)


def _monday(week: int) -> dict:
    durations = {
        1: 60,
        2: 60,
        3: 65,
        4: 65,
        5: 65,
        6: 70,
        7: 70,
        8: 70,
        9: 65,
        10: 60,
        11: 50,
        12: 40,
    }
    dur = durations[week]
    end_pace = "6:00/mi" if week <= 9 else ("6:30/mi" if week == 12 else "6:15/mi")
    return {
        "icon": "📈",
        "title": "Progressive Run",
        "duration": f"{dur} min",
        "summary": f"{dur} min progressive: 8:30 → {end_pace}",
        "details": f"Start at 8:30/mi, middle third ~7:15/mi, final third descend to {end_pace}. Smooth cadence increase throughout.",
        "garmin_steps": [
            {"type": "warmup", "duration_min": dur // 3, "target": "8:30/mi"},
            {"type": "active", "duration_min": dur // 3, "target": "7:15/mi"},
            {"type": "active", "duration_min": dur - 2 * (dur // 3), "target": end_pace},
        ],
    }


def _tuesday(week: int) -> dict:
    reps = {1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 10, 8: 10, 9: 10, 10: 8, 11: 6, 12: 4}
    r = reps[week]
    recovery = "90s" if week <= 4 or week >= 10 else "60–75s"
    return {
        "icon": "🏟️",
        "title": "Track Intervals",
        "duration": "~70–80 min",
        "summary": f"{r} × 1000m @ {PACES['5k']} ({recovery} jog recovery)",
        "details": f"Warm up 15 min easy + 4 strides. {r} × 1000m at 5K pace ({PACES['5k']}), {recovery} easy jog between. Cool down 10 min. Target each 1000m in ~3:16–3:22.",
        "garmin_steps": [
            {"type": "warmup", "duration_min": 15, "target": PACES["easy"]},
            *[
                item
                for _ in range(r)
                for item in [
                    {"type": "interval", "distance_m": 1000, "target": PACES["5k"]},
                    {
                        "type": "recovery",
                        "duration_sec": 90 if week <= 4 or week >= 10 else 75,
                        "target": "jog",
                    },
                ]
            ],
            {"type": "cooldown", "duration_min": 10, "target": PACES["easy"]},
        ],
    }


def _wednesday(week: int) -> dict:
    durations = {
        1: 50,
        2: 55,
        3: 60,
        4: 65,
        5: 70,
        6: 75,
        7: 80,
        8: 75,
        9: 70,
        10: 60,
        11: 45,
        12: 30,
    }
    dur = durations[week]
    tempo_min = round(dur * 0.6)
    wu = round(dur * 0.2)
    cd = dur - tempo_min - wu
    return {
        "icon": "⏱️",
        "title": "Tempo Run",
        "duration": f"{dur} min",
        "summary": f"{dur} min with {tempo_min} min @ {PACES['tempo']}",
        "details": f"Warm up {wu} min easy. Tempo block: {tempo_min} min at {PACES['tempo']} — comfortably hard, controlled breathing. Cool down {cd} min easy.",
        "garmin_steps": [
            {"type": "warmup", "duration_min": wu, "target": PACES["easy"]},
            {"type": "active", "duration_min": tempo_min, "target": PACES["tempo"]},
            {"type": "cooldown", "duration_min": cd, "target": PACES["easy"]},
        ],
    }


def _thursday(week: int) -> dict:
    reps_map = {1: 5, 2: 6, 3: 8, 4: 10, 5: 12, 6: 13, 7: 15, 8: 15, 9: 13, 10: 10, 11: 7, 12: 4}
    r = reps_map[week]
    total_min = r * 4 + 25
    return {
        "icon": "⚡",
        "title": "Fartlek",
        "duration": f"~{total_min} min",
        "summary": f"{r} × (3 min ON / 1 min OFF) — ON @ {PACES['threshold']}–{PACES['tempo']}",
        "details": f"Warm up 15 min easy + strides. {r} reps of 3 min hard ({PACES['threshold']}) / 1 min easy float. Cool down 10 min. Continuous running.",
        "garmin_steps": [
            {"type": "warmup", "duration_min": 15, "target": PACES["easy"]},
            *[
                item
                for _ in range(r)
                for item in [
                    {"type": "interval", "duration_min": 3, "target": PACES["threshold"]},
                    {"type": "recovery", "duration_min": 1, "target": PACES["easy"]},
                ]
            ],
            {"type": "cooldown", "duration_min": 10, "target": PACES["easy"]},
        ],
    }


def _friday(week: int) -> dict:
    durations = {
        1: 50,
        2: 55,
        3: 60,
        4: 65,
        5: 70,
        6: 75,
        7: 80,
        8: 75,
        9: 70,
        10: 60,
        11: 45,
        12: 30,
    }
    dur = durations[week]
    return {
        "icon": "🌿",
        "title": "Easy Run",
        "duration": f"{dur} min",
        "summary": f"{dur} min easy @ {PACES['easy']}",
        "details": f"Relaxed aerobic run. Keep heart rate in zone 2. Flat terrain preferred. This is recovery — resist the urge to push.",
        "garmin_steps": [
            {"type": "active", "duration_min": dur, "target": PACES["easy"]},
        ],
    }


def _saturday(week: int) -> dict:
    long_runs = {
        1: {
            "km": 25,
            "summary": "25K long run — first 15K easy, last 10K descending to marathon pace",
        },
        2: {"km": 28, "summary": "28K long run — first 18K easy, last 10K progressive to MP"},
        3: {"km": 30, "summary": "30K with 3 × 5K @ MP (6:10/mi) w/ 1K easy between"},
        4: {"km": 32, "summary": "32K progressive — start 8:30/mi, finish last 8K at MP"},
        5: {"km": 34, "summary": "34K with 4 × 5K @ MP (6:10/mi) w/ 1K easy between"},
        6: {"km": 35, "summary": "35K progressive — start easy, last 12K descending to 6:10/mi"},
        7: {"km": 38, "summary": "38K with 5 × 5K @ MP (6:10/mi) w/ 1K easy between"},
        8: {"km": 40, "summary": "40K progressive — THE BIG ONE. Start 8:30, last 15K at MP"},
        9: {"km": 35, "summary": "35K with 5 × 5K @ MP (6:10/mi) w/ 800m easy between"},
        10: {"km": 30, "summary": "30K progressive — start easy, last 10K at MP. Begin taper."},
        11: {"km": 22, "summary": "22K easy with last 5K at marathon pace. Stay sharp."},
        12: {"km": 10, "summary": "10K shakeout with 4 × 1K at MP. Trust the work."},
    }
    lr = long_runs[week]
    miles = round(lr["km"] * 0.621, 1)
    return {
        "icon": "🏔️",
        "title": "Long Run",
        "duration": f"{lr['km']}K ({miles} mi)",
        "summary": lr["summary"],
        "details": f"Practice race-day nutrition. Take gels every 45 min. Hydrate every 20 min. MP = 6:10/mi.",
        "garmin_steps": [
            {"type": "active", "distance_km": lr["km"], "target": "progressive to MP"},
        ],
    }


def _sunday(week: int) -> dict:
    return {
        "icon": "😴",
        "title": "Rest Day",
        "duration": "Off",
        "summary": "Complete rest. No running.",
        "details": "Full recovery. Foam roll, stretch, hydrate. Sleep 8+ hours.",
        "garmin_steps": [],
    }


def _build_evening(week: int, day: int) -> Optional[dict]:
    """Evening sessions Mon–Fri: alternate recovery runs and weights."""
    if day >= 5:
        return None
    if week == 12 and day >= 3:
        return None

    pattern = ["recovery", "weights", "recovery", "weights", "recovery"]
    session_type = pattern[day]

    if session_type == "recovery":
        return {
            "icon": "🐢",
            "title": "PM Recovery Run",
            "duration": "40 min",
            "description": f"40 min very easy @ {PACES['recovery']}. Conversational pace only.",
        }
    else:
        if week <= 4:
            focus = (
                "Foundation: squats, deadlifts, lunges, calf raises, core. 3×10–12 moderate weight."
            )
        elif week <= 9:
            focus = "Maintenance: lighter load, explosive movements. Single-leg work, box jumps, hip stability. 3×8."
        else:
            focus = "Activation: bodyweight circuits, bands, mobility. Keep muscles engaged without fatigue."
        return {
            "icon": "🏋️",
            "title": "PM Weights",
            "duration": "40 min",
            "description": focus,
        }


def format_workout_message(workout: dict) -> str:
    """Format a workout as a WhatsApp-friendly message."""
    if workout is None:
        return "No workout scheduled for this date."

    lines = [
        f"{workout['phase_emoji']} *Week {workout['week']} · {workout['phase']} Phase*",
        f"📅 {workout['day_name']}, {workout['date']}",
        "",
        f"{workout['icon']} *{workout['title']}* — {workout['duration']}",
        workout["summary"],
        "",
        f"📝 {workout['details']}",
    ]

    if workout.get("evening"):
        ev = workout["evening"]
        lines += [
            "",
            f"{ev['icon']} *{ev['title']}* — {ev['duration']}",
            ev["description"],
        ]

    return "\n".join(lines)


def get_garmin_workouts_json() -> list[dict]:
    """Export all workouts in a Garmin-Connect-friendly format for batch reference."""
    workouts = []
    for day_offset in range(84):
        d = START_DATE + timedelta(days=day_offset)
        w = get_workout(d)
        if w and w["title"] != "Rest Day":
            workouts.append(
                {
                    "date": w["date"],
                    "week": w["week"],
                    "phase": w["phase"],
                    "name": f"W{w['week']}_{w['day_name'][:3]}_{w['title'].replace(' ', '_')}",
                    "title": w["title"],
                    "summary": w["summary"],
                    "steps": w.get("garmin_steps", []),
                }
            )
    return workouts

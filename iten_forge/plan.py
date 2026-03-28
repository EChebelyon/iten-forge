"""
12-week marathon training plan.

All paces are dynamically computed from the athlete's goal time.
Workout structure is periodized: Build (weeks 1-4), Peak (5-9), Taper (10-12).
"""

from datetime import date, timedelta

from iten_forge.paces import PaceZones, format_pace

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class Plan:
    def __init__(self, goal_time: str, start_date: date, unit: str = "mi"):
        self.paces = PaceZones.from_goal_time(goal_time, unit)
        self.start_date = start_date
        self.race_day = start_date + timedelta(weeks=12)
        self.unit = unit

    def phase(self, week: int) -> str:
        if week <= 4:
            return "Build"
        if week <= 9:
            return "Peak"
        return "Taper"

    def week_and_day(self, target_date: date) -> tuple[int, int]:
        delta = (target_date - self.start_date).days
        if delta < 0 or delta >= 84:
            return (0, 0)
        return (delta // 7 + 1, delta % 7)

    def workout(self, target_date: date) -> dict | None:
        week, day = self.week_and_day(target_date)
        if week == 0:
            return None

        builders = [
            self._monday,
            self._tuesday,
            self._wednesday,
            self._thursday,
            self._friday,
            self._saturday,
            self._sunday,
        ]
        w = builders[day](week)
        evening = self._evening(week, day)

        return {
            "date": target_date.isoformat(),
            "week": week,
            "phase": self.phase(week),
            "day": DAY_NAMES[day],
            "icon": w["icon"],
            "title": w["title"],
            "duration": w["duration"],
            "summary": w["summary"],
            "details": w["details"],
            "garmin_steps": w.get("garmin_steps", []),
            "evening": evening,
            "paces": self.paces.all_zones(),
        }

    def all_workouts(self) -> list[dict]:
        workouts = []
        for offset in range(84):
            d = self.start_date + timedelta(days=offset)
            w = self.workout(d)
            if w:
                workouts.append(w)
        return workouts

    def weekly_mileage(self) -> list[dict]:
        """Estimated weekly mileage for weeks 1-12.

        Time-based workouts are converted to distance using the
        appropriate training pace.  Saturday long runs use the
        explicit km distance.  Evening recovery doubles are included.
        """
        km_per_mile = 1.60934
        results = []

        for week in range(1, 13):
            total_km = 0.0

            # Monday – progressive (use easy pace as rough average)
            mon_dur = {1: 60, 2: 60, 3: 65, 4: 65, 5: 65, 6: 70, 7: 70, 8: 70, 9: 65, 10: 60, 11: 50, 12: 40}
            pace_sec_per_km = self.paces.marathon + round(80 * self.paces._scale)  # between easy and marathon
            if self.paces.unit == "mi":
                pace_sec_per_km = pace_sec_per_km / km_per_mile
            total_km += mon_dur[week] * 60 / pace_sec_per_km

            # Tuesday – track: 15 warm + reps*(~4min) + 10 cool at easy, reps*1km at 5k pace
            tue_reps = {1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 10, 8: 10, 9: 10, 10: 8, 11: 6, 12: 4}
            easy_sec_per_km = self.paces.easy / km_per_mile if self.paces.unit == "mi" else self.paces.easy
            easy_mins = 25  # warmup + cooldown
            total_km += easy_mins * 60 / easy_sec_per_km
            total_km += tue_reps[week]  # 1km per rep
            recovery_jog_km = tue_reps[week] * 0.3  # ~300m jog between reps
            total_km += recovery_jog_km

            # Wednesday – tempo
            wed_dur = {1: 50, 2: 55, 3: 60, 4: 65, 5: 70, 6: 75, 7: 80, 8: 75, 9: 70, 10: 60, 11: 45, 12: 30}
            tempo_sec_per_km = self.paces.tempo / km_per_mile if self.paces.unit == "mi" else self.paces.tempo
            avg_wed = (easy_sec_per_km * 0.4 + tempo_sec_per_km * 0.6)
            total_km += wed_dur[week] * 60 / avg_wed

            # Thursday – fartlek
            thu_reps = {1: 5, 2: 6, 3: 8, 4: 10, 5: 12, 6: 13, 7: 15, 8: 15, 9: 13, 10: 10, 11: 7, 12: 4}
            thu_dur = thu_reps[week] * 4 + 25
            thresh_sec_per_km = self.paces.threshold / km_per_mile if self.paces.unit == "mi" else self.paces.threshold
            avg_thu = (easy_sec_per_km * 0.4 + thresh_sec_per_km * 0.6)
            total_km += thu_dur * 60 / avg_thu

            # Friday – easy
            fri_dur = {1: 50, 2: 55, 3: 60, 4: 65, 5: 70, 6: 75, 7: 80, 8: 75, 9: 70, 10: 60, 11: 45, 12: 30}
            total_km += fri_dur[week] * 60 / easy_sec_per_km

            # Saturday – long run (explicit km)
            lr_km = {1: 25, 2: 28, 3: 30, 4: 32, 5: 34, 6: 35, 7: 38, 8: 40, 9: 35, 10: 30, 11: 22, 12: 10}
            total_km += lr_km[week]

            # Evening recovery doubles (Mon/Wed/Fri = 3x 40min, except week 12 after Wed)
            rec_sec_per_km = self.paces.recovery / km_per_mile if self.paces.unit == "mi" else self.paces.recovery
            if week < 12:
                total_km += 3 * 40 * 60 / rec_sec_per_km
            else:
                total_km += 2 * 40 * 60 / rec_sec_per_km  # only Mon & Wed evenings

            if self.unit == "mi":
                total_dist = round(total_km / km_per_mile, 1)
            else:
                total_dist = round(total_km, 1)

            results.append({
                "week": week,
                "phase": self.phase(week),
                "mileage": total_dist,
            })

        return results

    def format_message(self, workout: dict | None) -> str:
        if workout is None:
            return "No workout scheduled for this date."

        lines = [
            f"WEEK {workout['week']} | {workout['phase']} Phase",
            f"{workout['day']}, {workout['date']}",
            "",
            f"{workout['title'].upper()} | {workout['duration']}",
            workout["summary"],
            "",
            workout["details"],
        ]

        if workout.get("evening"):
            ev = workout["evening"]
            lines += ["", f"{ev['title'].upper()} | {ev['duration']}", ev["description"]]

        return "\n".join(lines)

    # -- Day builders --

    def _monday(self, week: int) -> dict:
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
        end_pace = self.paces.tempo if week <= 9 else self.paces.marathon
        end_str = format_pace(end_pace, self.unit)
        easy_str = format_pace(self.paces.easy, self.unit)
        mid_pace = self.paces.easy - 60
        mid_str = format_pace(mid_pace, self.unit)

        return {
            "icon": "progressive",
            "title": "Progressive Run",
            "duration": f"{dur} min",
            "summary": f"{dur} min progressive: {easy_str} down to {end_str}",
            "details": (
                f"Start at {easy_str}, middle third at ~{mid_str}, "
                f"final third descend to {end_str}. Smooth cadence increase throughout."
            ),
            "garmin_steps": [
                {"type": "warmup", "duration_min": dur // 3, "target": easy_str},
                {"type": "active", "duration_min": dur // 3, "target": mid_str},
                {"type": "active", "duration_min": dur - 2 * (dur // 3), "target": end_str},
            ],
        }

    def _tuesday(self, week: int) -> dict:
        reps = {1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 10, 8: 10, 9: 10, 10: 8, 11: 6, 12: 4}
        r = reps[week]
        recovery_sec = 90 if week <= 4 or week >= 10 else 75
        recovery_str = f"{recovery_sec}s" if recovery_sec < 120 else f"{recovery_sec // 60} min"
        pace_5k = self.paces.format("5k")
        pace_easy = self.paces.format("easy")
        target_1k = self.paces.interval_1k_target()

        return {
            "icon": "track",
            "title": "Track Intervals",
            "duration": "~70-80 min",
            "summary": f"{r} x 1000m @ {pace_5k} ({recovery_str} jog recovery)",
            "details": (
                f"Warm up 15 min easy + 4 strides. "
                f"{r} x 1000m at 5K pace ({pace_5k}), {recovery_str} easy jog between. "
                f"Cool down 10 min. Target each 1000m in ~{target_1k}."
            ),
            "garmin_steps": [
                {"type": "warmup", "duration_min": 15, "target": pace_easy},
                *[
                    step
                    for _ in range(r)
                    for step in [
                        {"type": "interval", "distance_m": 1000, "target": pace_5k},
                        {"type": "recovery", "duration_sec": recovery_sec, "target": "jog"},
                    ]
                ],
                {"type": "cooldown", "duration_min": 10, "target": pace_easy},
            ],
        }

    def _wednesday(self, week: int) -> dict:
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
        pace_tempo = self.paces.format("tempo")
        pace_easy = self.paces.format("easy")

        return {
            "icon": "tempo",
            "title": "Tempo Run",
            "duration": f"{dur} min",
            "summary": f"{dur} min with {tempo_min} min @ {pace_tempo}",
            "details": (
                f"Warm up {wu} min easy. Tempo block: {tempo_min} min at {pace_tempo} "
                f"-- comfortably hard, controlled breathing. Cool down {cd} min easy."
            ),
            "garmin_steps": [
                {"type": "warmup", "duration_min": wu, "target": pace_easy},
                {"type": "active", "duration_min": tempo_min, "target": pace_tempo},
                {"type": "cooldown", "duration_min": cd, "target": pace_easy},
            ],
        }

    def _thursday(self, week: int) -> dict:
        reps = {1: 5, 2: 6, 3: 8, 4: 10, 5: 12, 6: 13, 7: 15, 8: 15, 9: 13, 10: 10, 11: 7, 12: 4}
        r = reps[week]
        total_min = r * 4 + 25
        pace_threshold = self.paces.format("threshold")
        pace_easy = self.paces.format("easy")

        return {
            "icon": "fartlek",
            "title": "Fartlek",
            "duration": f"~{total_min} min",
            "summary": f"{r} x (3 min ON / 1 min OFF) -- ON @ {pace_threshold}",
            "details": (
                f"Warm up 15 min easy + strides. {r} reps of 3 min hard ({pace_threshold}) / "
                f"1 min easy float. Cool down 10 min. Continuous running."
            ),
            "garmin_steps": [
                {"type": "warmup", "duration_min": 15, "target": pace_easy},
                *[
                    step
                    for _ in range(r)
                    for step in [
                        {"type": "interval", "duration_min": 3, "target": pace_threshold},
                        {"type": "recovery", "duration_min": 1, "target": pace_easy},
                    ]
                ],
                {"type": "cooldown", "duration_min": 10, "target": pace_easy},
            ],
        }

    def _friday(self, week: int) -> dict:
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
        pace_easy = self.paces.format("easy")

        return {
            "icon": "easy",
            "title": "Easy Run",
            "duration": f"{dur} min",
            "summary": f"{dur} min easy @ {pace_easy}",
            "details": (
                "Relaxed aerobic run. Keep heart rate in zone 2. "
                "Flat terrain preferred. This is recovery -- resist the urge to push."
            ),
            "garmin_steps": [
                {"type": "active", "duration_min": dur, "target": pace_easy},
            ],
        }

    def _saturday(self, week: int) -> dict:
        pace_mp = self.paces.format("marathon")
        long_runs = {
            1: {
                "km": 25,
                "summary": f"25K long run -- first 15K easy, last 10K descending to {pace_mp}",
            },
            2: {
                "km": 28,
                "summary": f"28K long run -- first 18K easy, last 10K progressive to {pace_mp}",
            },
            3: {"km": 30, "summary": f"30K with 3 x 5K @ {pace_mp} w/ 1K easy between"},
            4: {"km": 32, "summary": f"32K progressive -- start easy, finish last 8K at {pace_mp}"},
            5: {"km": 34, "summary": f"34K with 4 x 5K @ {pace_mp} w/ 1K easy between"},
            6: {
                "km": 35,
                "summary": f"35K progressive -- start easy, last 12K descending to {pace_mp}",
            },
            7: {"km": 38, "summary": f"38K with 5 x 5K @ {pace_mp} w/ 1K easy between"},
            8: {
                "km": 40,
                "summary": f"40K progressive -- THE BIG ONE. Start easy, last 15K at {pace_mp}",
            },
            9: {"km": 35, "summary": f"35K with 5 x 5K @ {pace_mp} w/ 800m easy between"},
            10: {
                "km": 30,
                "summary": f"30K progressive -- start easy, last 10K at {pace_mp}. Begin taper.",
            },
            11: {"km": 22, "summary": f"22K easy with last 5K at {pace_mp}. Stay sharp."},
            12: {"km": 10, "summary": f"10K shakeout with 4 x 1K at {pace_mp}. Trust the work."},
        }
        lr = long_runs[week]
        miles = round(lr["km"] * 0.621, 1)

        return {
            "icon": "long-run",
            "title": "Long Run",
            "duration": f"{lr['km']}K ({miles} mi)",
            "summary": lr["summary"],
            "details": (
                f"Practice race-day nutrition. Take gels every 45 min. "
                f"Hydrate every 20 min. MP = {pace_mp}."
            ),
            "garmin_steps": [
                {"type": "active", "distance_km": lr["km"], "target": f"progressive to {pace_mp}"},
            ],
        }

    def _sunday(self, _week: int) -> dict:
        return {
            "icon": "rest",
            "title": "Rest Day",
            "duration": "Off",
            "summary": "Complete rest. No running.",
            "details": "Full recovery. Foam roll, stretch, hydrate. Sleep 8+ hours.",
            "garmin_steps": [],
        }

    def _evening(self, week: int, day: int) -> dict | None:
        if day >= 5:
            return None
        if week == 12 and day >= 3:
            return None

        pattern = ["recovery", "weights", "recovery", "weights", "recovery"]
        session_type = pattern[day]

        if session_type == "recovery":
            pace_recovery = self.paces.format("recovery")
            return {
                "title": "PM Recovery Run",
                "duration": "40 min",
                "description": f"40 min very easy @ {pace_recovery}. Conversational pace only.",
            }

        if week <= 4:
            focus = (
                "Foundation: squats, deadlifts, lunges, calf raises, core. 3x10-12 moderate weight."
            )
        elif week <= 9:
            focus = (
                "Maintenance: lighter load, explosive movements. "
                "Single-leg work, box jumps, hip stability. 3x8."
            )
        else:
            focus = (
                "Activation: bodyweight circuits, bands, mobility. "
                "Keep muscles engaged without fatigue."
            )

        return {
            "title": "PM Weights",
            "duration": "40 min",
            "description": focus,
        }

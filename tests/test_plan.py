from datetime import date

from iten_forge.plan import Plan


def _plan() -> Plan:
    return Plan(goal_time="2:50:00", start_date=date(2026, 3, 9), unit="mi")


def test_week_and_day():
    plan = _plan()
    assert plan.week_and_day(date(2026, 3, 9)) == (1, 0)  # Week 1 Monday
    assert plan.week_and_day(date(2026, 3, 15)) == (1, 6)  # Week 1 Sunday
    assert plan.week_and_day(date(2026, 5, 31)) == (12, 6)  # Week 12 Sunday


def test_outside_window():
    plan = _plan()
    assert plan.week_and_day(date(2026, 3, 8)) == (0, 0)  # Before start
    assert plan.week_and_day(date(2026, 6, 1)) == (0, 0)  # After end


def test_workout_returns_dict():
    plan = _plan()
    w = plan.workout(date(2026, 3, 9))
    assert w is not None
    assert w["week"] == 1
    assert w["phase"] == "Build"
    assert w["day"] == "Monday"
    assert w["title"] == "Progressive Run"
    assert "icon" in w
    assert "paces" in w


def test_workout_outside_window_returns_none():
    plan = _plan()
    assert plan.workout(date(2025, 1, 1)) is None


def test_all_workouts_count():
    plan = _plan()
    workouts = plan.all_workouts()
    assert len(workouts) == 84  # 12 weeks * 7 days


def test_phases():
    plan = _plan()
    assert plan.phase(1) == "Build"
    assert plan.phase(4) == "Build"
    assert plan.phase(5) == "Peak"
    assert plan.phase(9) == "Peak"
    assert plan.phase(10) == "Taper"
    assert plan.phase(12) == "Taper"


def test_format_message_no_emojis():
    plan = _plan()
    w = plan.workout(date(2026, 3, 9))
    msg = plan.format_message(w)
    # Should contain structured text, no emojis
    assert "WEEK 1" in msg
    assert "Build Phase" in msg
    assert "PROGRESSIVE RUN" in msg


def test_icon_is_semantic_string():
    plan = _plan()
    icons_seen = set()
    for w in plan.all_workouts():
        icons_seen.add(w["icon"])
    expected = {"progressive", "track", "tempo", "fartlek", "easy", "long-run", "rest"}
    assert icons_seen == expected


def test_dynamic_paces_change_with_goal():
    fast = Plan(goal_time="2:30:00", start_date=date(2026, 3, 9))
    slow = Plan(goal_time="3:20:00", start_date=date(2026, 3, 9))

    fast_w = fast.workout(date(2026, 3, 9))
    slow_w = slow.workout(date(2026, 3, 9))

    # Both competitive — same structure, different paces
    assert fast_w["title"] == slow_w["title"]
    assert fast_w["paces"]["race"] != slow_w["paces"]["race"]


def test_sunday_is_rest():
    plan = _plan()
    w = plan.workout(date(2026, 3, 15))  # Sunday
    assert w["title"] == "Rest Day"
    assert w["icon"] == "rest"


def test_evening_sessions():
    plan = _plan()
    # Monday (day 0) should have PM recovery
    mon = plan.workout(date(2026, 3, 9))
    assert mon["evening"] is not None
    assert mon["evening"]["title"] == "PM Recovery Run"

    # Tuesday (day 1) should have PM weights
    tue = plan.workout(date(2026, 3, 10))
    assert tue["evening"] is not None
    assert tue["evening"]["title"] == "PM Weights"

    # Saturday (day 5) should have no evening
    sat = plan.workout(date(2026, 3, 14))
    assert sat["evening"] is None


# -- Just Finish tier --


def _jf_plan() -> Plan:
    return Plan(goal_time="4:00:00", start_date=date(2026, 3, 9), unit="mi")


def test_just_finish_tier_detection():
    assert _plan().is_competitive is True
    assert _jf_plan().is_competitive is False
    # Boundary: exactly 3:30 is just finish (marathon)
    boundary = Plan(goal_time="3:30:00", start_date=date(2026, 3, 9))
    assert boundary.is_competitive is False


def test_just_finish_all_workouts_count():
    plan = _jf_plan()
    assert len(plan.all_workouts()) == 84


def test_just_finish_thursday_is_rest():
    plan = _jf_plan()
    workouts = plan.all_workouts()
    thursdays = [w for w in workouts if w["day"] == "Thursday"]
    assert len(thursdays) == 12
    assert all(w["title"] == "Rest Day" for w in thursdays)


def test_just_finish_no_evening_sessions():
    plan = _jf_plan()
    workouts = plan.all_workouts()
    assert all(w["evening"] is None for w in workouts)


def test_just_finish_no_track_icon():
    plan = _jf_plan()
    icons = {w["icon"] for w in plan.all_workouts()}
    assert "track" not in icons
    assert "progressive" not in icons
    assert "fartlek" not in icons


def test_just_finish_mileage_lower_than_competitive():
    comp = _plan()
    jf = _jf_plan()
    comp_peak = max(w["mileage"] for w in comp.weekly_mileage())
    jf_peak = max(w["mileage"] for w in jf.weekly_mileage())
    assert jf_peak < comp_peak


# -- Half marathon --


def _half_plan() -> Plan:
    return Plan(goal_time="1:30:00", start_date=date(2026, 3, 9), unit="mi", distance="half")


def _half_jf_plan() -> Plan:
    return Plan(goal_time="2:00:00", start_date=date(2026, 3, 9), unit="mi", distance="half")


def test_default_distance_is_marathon():
    plan = _plan()
    assert plan.distance == "marathon"


def test_half_competitive_cutoff():
    # 1:30 is competitive for half
    assert _half_plan().is_competitive is True
    # 1:40 is just finish
    jf = Plan(goal_time="1:40:00", start_date=date(2026, 3, 9), distance="half")
    assert jf.is_competitive is False
    # Boundary: exactly 1:35 is just finish
    boundary = Plan(goal_time="1:35:00", start_date=date(2026, 3, 9), distance="half")
    assert boundary.is_competitive is False


def test_half_all_workouts_count():
    assert len(_half_plan().all_workouts()) == 84
    assert len(_half_jf_plan().all_workouts()) == 84


def test_half_no_evening_for_jf():
    plan = _half_jf_plan()
    workouts = plan.all_workouts()
    assert all(w["evening"] is None for w in workouts)


def test_half_long_run_peak():
    # Competitive half peaks at 24km
    comp = _half_plan()
    saturdays = [w for w in comp.all_workouts() if w["day"] == "Saturday"]
    # Extract km from duration string like "24K (14.9 mi)"
    peak_km = max(int(s["duration"].split("K")[0]) for s in saturdays)
    assert peak_km == 24

    # JF half peaks at 18km
    jf = _half_jf_plan()
    saturdays_jf = [w for w in jf.all_workouts() if w["day"] == "Saturday"]
    peak_km_jf = max(int(s["duration"].split("K")[0]) for s in saturdays_jf)
    assert peak_km_jf == 18


def test_half_mileage_lower_than_marathon():
    marathon_comp = _plan()
    half_comp = _half_plan()
    m_peak = max(w["mileage"] for w in marathon_comp.weekly_mileage())
    h_peak = max(w["mileage"] for w in half_comp.weekly_mileage())
    assert h_peak < m_peak


def test_half_evening_recovery_30min():
    plan = _half_plan()
    mon = plan.workout(date(2026, 3, 9))  # Monday
    assert mon["evening"] is not None
    assert "30 min" in mon["evening"]["duration"]

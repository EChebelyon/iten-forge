from iten_forge.paces import PaceZones, format_pace, parse_time


def test_parse_time_hhmmss():
    assert parse_time("2:50:00") == 10200


def test_parse_time_mmss():
    assert parse_time("6:30") == 390


def test_marathon_pace_miles():
    zones = PaceZones.from_goal_time("2:50:00", unit="mi")
    # 10200 / 26.2 = 389.3 -> 389 sec = 6:29/mi
    assert zones.marathon == 389
    assert format_pace(zones.marathon, "mi") == "6:29/mi"


def test_marathon_pace_km():
    zones = PaceZones.from_goal_time("2:50:00", unit="km")
    # 10200 / 42.195 = 241.7 -> 242 sec = 4:02/km
    assert zones.marathon == 242
    assert format_pace(zones.marathon, "km") == "4:02/km"


def test_zone_ordering():
    zones = PaceZones.from_goal_time("2:50:00")
    assert (
        zones.interval_5k
        < zones.threshold
        < zones.tempo
        < zones.marathon
        < zones.easy
        < zones.recovery
    )


def test_all_zones_returns_all_keys():
    zones = PaceZones.from_goal_time("3:00:00")
    result = zones.all_zones()
    assert set(result.keys()) == {"easy", "recovery", "marathon", "tempo", "threshold", "5k"}


def test_different_goals_produce_different_paces():
    fast = PaceZones.from_goal_time("2:30:00")
    slow = PaceZones.from_goal_time("4:00:00")
    assert fast.marathon < slow.marathon
    assert fast.easy < slow.easy

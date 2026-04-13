from iten_forge.paces import PaceZones, format_pace, parse_time


def test_parse_time_hhmmss():
    assert parse_time("2:50:00") == 10200


def test_parse_time_mmss():
    assert parse_time("6:30") == 390


def test_marathon_pace_miles():
    zones = PaceZones.from_goal_time("2:50:00", unit="mi")
    # 10200 / 26.2 = 389.3 -> 389 sec = 6:29/mi
    assert zones.race_pace == 389
    assert format_pace(zones.race_pace, "mi") == "6:29/mi"


def test_marathon_pace_km():
    zones = PaceZones.from_goal_time("2:50:00", unit="km")
    # 10200 / 42.195 = 241.7 -> 242 sec = 4:02/km
    assert zones.race_pace == 242
    assert format_pace(zones.race_pace, "km") == "4:02/km"


def test_zone_ordering():
    zones = PaceZones.from_goal_time("2:50:00")
    assert (
        zones.interval_5k
        < zones.threshold
        < zones.tempo
        < zones.race_pace
        < zones.easy
        < zones.recovery
    )


def test_all_zones_returns_all_keys():
    zones = PaceZones.from_goal_time("3:00:00")
    result = zones.all_zones()
    assert set(result.keys()) == {"easy", "recovery", "race", "tempo", "threshold", "5k"}


def test_different_goals_produce_different_paces():
    fast = PaceZones.from_goal_time("2:30:00")
    slow = PaceZones.from_goal_time("4:00:00")
    assert fast.race_pace < slow.race_pace
    assert fast.easy < slow.easy


# -- Half marathon --


def test_half_marathon_pace_miles():
    zones = PaceZones.from_goal_time("1:20:00", unit="mi", distance="half")
    # 4800 / 13.1 = 366.4 -> 366 sec = 6:06/mi
    assert zones.race_pace == 366
    assert format_pace(zones.race_pace, "mi") == "6:06/mi"


def test_half_marathon_pace_km():
    zones = PaceZones.from_goal_time("1:20:00", unit="km", distance="half")
    # 4800 / 21.0975 = 227.5 -> 228 sec = 3:48/km
    assert zones.race_pace == 228
    assert format_pace(zones.race_pace, "km") == "3:48/km"


def test_half_zone_ordering():
    zones = PaceZones.from_goal_time("1:30:00", distance="half")
    assert (
        zones.interval_5k
        < zones.threshold
        < zones.tempo
        < zones.race_pace
        < zones.easy
        < zones.recovery
    )


def test_5k_pace():
    zones = PaceZones.from_goal_time("20:00", unit="mi", distance="5k")
    # 1200 / 3.10686 = 386.2 -> 386 sec = 6:26/mi
    assert zones.race_pace == 386


def test_10k_pace():
    zones = PaceZones.from_goal_time("45:00", unit="mi", distance="10k")
    # 2700 / 6.21371 = 434.6 -> 435 sec = 7:15/mi
    assert zones.race_pace == 435


def test_default_distance_is_marathon():
    zones = PaceZones.from_goal_time("2:50:00")
    assert zones.distance == "marathon"

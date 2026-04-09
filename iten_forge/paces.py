"""
Pace calculator. All training zones derived from a goal time and race distance.

Standard zone offsets (seconds per mile, scaled for km):
    easy       = RP + 130
    recovery   = RP + 195
    race       = RP
    tempo      = RP - 20
    threshold  = RP - 30
    interval   = RP - 55
"""

from dataclasses import dataclass

MARATHON_MILES = 26.2
MARATHON_KM = 42.195
HALF_MARATHON_MILES = 13.1
HALF_MARATHON_KM = 21.0975

DISTANCES = {
    "marathon": {"mi": MARATHON_MILES, "km": MARATHON_KM},
    "half": {"mi": HALF_MARATHON_MILES, "km": HALF_MARATHON_KM},
}


def parse_time(time_str: str) -> int:
    """Parse 'H:MM:SS' or 'MM:SS' into total seconds."""
    parts = time_str.strip().split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    raise ValueError(f"Invalid time format: {time_str}")


def format_pace(seconds: int, unit: str = "mi") -> str:
    """Format seconds-per-unit as 'M:SS/unit'."""
    m, s = divmod(max(0, seconds), 60)
    return f"{m}:{s:02d}/{unit}"


def format_range(low: int, high: int, unit: str = "mi") -> str:
    return f"{format_pace(low, unit)}-{format_pace(high, unit)}"


@dataclass(frozen=True)
class PaceZones:
    """Training pace zones derived from a goal time and race distance."""

    goal_seconds: int
    unit: str = "mi"
    distance: str = "marathon"

    @classmethod
    def from_goal_time(
        cls, goal_time: str, unit: str = "mi", distance: str = "marathon"
    ) -> "PaceZones":
        return cls(goal_seconds=parse_time(goal_time), unit=unit, distance=distance)

    @property
    def _distance(self) -> float:
        return DISTANCES[self.distance][self.unit]

    @property
    def _scale(self) -> float:
        """Offset scale factor. Mile offsets are baseline; km offsets are smaller."""
        return 1.0 if self.unit == "mi" else 0.621

    @property
    def race_pace(self) -> int:
        return round(self.goal_seconds / self._distance)

    @property
    def easy(self) -> int:
        return self.race_pace + round(130 * self._scale)

    @property
    def recovery(self) -> int:
        return self.race_pace + round(195 * self._scale)

    @property
    def tempo(self) -> int:
        return self.race_pace - round(20 * self._scale)

    @property
    def threshold(self) -> int:
        return self.race_pace - round(30 * self._scale)

    @property
    def interval_5k(self) -> int:
        return self.race_pace - round(55 * self._scale)

    def format(self, zone: str) -> str:
        """Format a named zone as a pace string."""
        mapping = {
            "easy": (self.easy - 15, self.easy + 15),
            "recovery": (self.recovery - 15, self.recovery + 15),
            "race": None,
            "tempo": (self.tempo - 5, self.tempo + 5),
            "threshold": (self.threshold - 5, self.threshold + 5),
            "5k": (self.interval_5k - 5, self.interval_5k + 5),
        }
        val = mapping[zone]
        if val is None:
            return format_pace(self.race_pace, self.unit)
        return format_range(val[0], val[1], self.unit)

    def all_zones(self) -> dict[str, str]:
        return {
            z: self.format(z) for z in ["easy", "recovery", "race", "tempo", "threshold", "5k"]
        }

    def interval_1k_target(self) -> str:
        """Target time for a 1000m interval rep."""
        if self.unit == "mi":
            secs = round(self.interval_5k * 0.621)
        else:
            secs = self.interval_5k
        m, s = divmod(secs, 60)
        return f"{m}:{s:02d}"

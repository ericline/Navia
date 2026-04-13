# backend/arrangement.py
"""Deterministic arrangement strategies.

Given a list of unscheduled Activity rows, a list of Day rows, and user
preferences, produce up to 5 distinct arrangements. Each arrangement is a dict:

    {
      "name": "Balanced",
      "description": "Spreads activities evenly across days",
      "assignments": [
         {"activity_id": 12, "day_id": 3, "position": 1, "start_time": "09:00:00"},
         ...
      ]
    }

Nothing is committed — the caller decides whether to persist.
"""
from __future__ import annotations

import math
from datetime import datetime, time, timedelta
from typing import Any


Assignment = dict[str, Any]
Arrangement = dict[str, Any]


# ---------- helpers ----------

def _pace_budget_minutes(pace: str) -> int:
    """Usable minutes per day based on pace preference."""
    return {
        "relaxed": 300,   # ~5h
        "balanced": 420,  # ~7h
        "packed": 600,    # ~10h
    }.get(pace, 420)


def _day_window_minutes(day_start: time, day_end: time) -> int:
    start_min = day_start.hour * 60 + day_start.minute
    end_min = day_end.hour * 60 + day_end.minute
    return max(0, end_min - start_min - 60)  # -1h for meals/transit buffer


def _activity_minutes(a) -> int:
    return int(a.est_duration_minutes or 90)


def _format_time(total_min: int) -> str:
    h = (total_min // 60) % 24
    m = total_min % 60
    return f"{h:02d}:{m:02d}:00"


def _existing_end_minute(existing: list[Any], day_start: time) -> int:
    """Compute the minute-of-day at which the last existing activity ends."""
    if not existing:
        return 0
    latest_end = 0
    for a in existing:
        if a.start_time:
            start_min = a.start_time.hour * 60 + a.start_time.minute
        else:
            start_min = day_start.hour * 60 + day_start.minute
        latest_end = max(latest_end, start_min + _activity_minutes(a) + 30)
    return latest_end


def _schedule_within_days(
    ordered_by_day: list[list[Any]],
    days: list[Any],
    day_start: time,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[Assignment]:
    """Given activities bucketed per day (same length as days), assign start_times
    and positions sequentially within each day, starting after existing activities."""
    start_min_base = day_start.hour * 60 + day_start.minute
    existing_by_day = existing_by_day or {}
    assignments: list[Assignment] = []
    for day_idx, acts in enumerate(ordered_by_day):
        if day_idx >= len(days):
            break
        day = days[day_idx]
        existing = existing_by_day.get(day.id, [])
        existing_end = _existing_end_minute(existing, day_start)
        cursor = max(start_min_base, existing_end)
        pos_offset = len(existing)
        for pos, a in enumerate(acts):
            assignments.append(
                {
                    "activity_id": a.id,
                    "day_id": day.id,
                    "position": pos_offset + pos,
                    "start_time": _format_time(cursor),
                }
            )
            cursor += _activity_minutes(a) + 30  # 30min transit buffer
    return assignments


# ---------- strategies ----------

def _strategy_balanced(
    activities: list[Any], days: list[Any], prefs,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[list[Any]]:
    """Round-robin activities across days, respecting daily duration budget."""
    existing_by_day = existing_by_day or {}
    budget = min(_pace_budget_minutes(prefs.pace), _day_window_minutes(prefs.day_start, prefs.day_end))
    buckets: list[list[Any]] = [[] for _ in days]
    # Pre-fill day_used with existing scheduled activity durations
    day_used = [
        sum(_activity_minutes(a) for a in existing_by_day.get(day.id, []))
        for day in days
    ]
    # Sort by must_do first, then by duration desc so the big items get placed first
    sorted_acts = sorted(activities, key=lambda a: (not bool(a.must_do), -_activity_minutes(a)))
    for a in sorted_acts:
        dur = _activity_minutes(a)
        # Pick the day with the most remaining capacity
        idx = min(range(len(days)), key=lambda i: day_used[i])
        if day_used[idx] + dur > budget and any(day_used[i] + dur <= budget for i in range(len(days))):
            idx = next(i for i in range(len(days)) if day_used[i] + dur <= budget)
        buckets[idx].append(a)
        day_used[idx] += dur
    return buckets


def _strategy_cluster_by_location(
    activities: list[Any], days: list[Any], prefs,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[list[Any]] | None:
    """K-means clustering on lat/lng into len(days) clusters. Returns None if
    not enough activities have coordinates — caller will skip this strategy.
    Existing scheduled activities influence centroid positions but are not reassigned."""
    existing_by_day = existing_by_day or {}
    # Collect all activities with coordinates (new + existing) for centroid calculation
    all_existing_with_coords = [
        a for acts in existing_by_day.values() for a in acts
        if a.lat is not None and a.lng is not None
    ]
    coords_acts = [a for a in activities if a.lat is not None and a.lng is not None]
    all_coords = coords_acts + all_existing_with_coords
    if len(all_coords) < max(2, len(days)):
        return None

    k = min(len(days), len(all_coords))

    # Simple k-means: initialize with the k most spread-out points (greedy)
    centroids: list[tuple[float, float]] = [(all_coords[0].lat, all_coords[0].lng)]
    while len(centroids) < k:
        # pick the point farthest from existing centroids
        farthest = max(
            all_coords,
            key=lambda a: min(
                (a.lat - cy) ** 2 + (a.lng - cx) ** 2 for cy, cx in centroids
            ),
        )
        centroids.append((farthest.lat, farthest.lng))

    for _ in range(20):
        buckets_c: list[list[Any]] = [[] for _ in range(k)]
        for a in all_coords:
            dists = [
                (a.lat - cy) ** 2 + (a.lng - cx) ** 2 for cy, cx in centroids
            ]
            buckets_c[dists.index(min(dists))].append(a)
        new_centroids = []
        for i, bucket in enumerate(buckets_c):
            if bucket:
                avg_lat = sum(b.lat for b in bucket) / len(bucket)
                avg_lng = sum(b.lng for b in bucket) / len(bucket)
                new_centroids.append((avg_lat, avg_lng))
            else:
                new_centroids.append(centroids[i])
        if new_centroids == centroids:
            break
        centroids = new_centroids

    # Remove existing activities from buckets — they stay where they are
    for bucket in buckets_c:
        existing_ids = {a.id for a in all_existing_with_coords}
        bucket[:] = [a for a in bucket if a.id not in existing_ids]

    # Distribute new activities without coordinates across buckets round-robin
    no_coords = [a for a in activities if a.lat is None or a.lng is None]
    buckets: list[list[Any]] = list(buckets_c) + [[] for _ in range(len(days) - k)]
    for i, a in enumerate(no_coords):
        buckets[i % len(days)].append(a)

    return buckets


def _strategy_must_do_first(
    activities: list[Any], days: list[Any], prefs,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[list[Any]]:
    """Front-load must-do activities into early days."""
    must = [a for a in activities if a.must_do]
    rest = [a for a in activities if not a.must_do]
    ordered = must + rest
    buckets: list[list[Any]] = [[] for _ in days]
    for i, a in enumerate(ordered):
        buckets[i % len(days)].append(a)
    return buckets


def _strategy_energy_paced(
    activities: list[Any], days: list[Any], prefs,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[list[Any]]:
    """High energy early each day, low energy later. Distribute round-robin."""
    energy_rank = {"high": 0, "medium": 1, "low": 2}
    # Bucket round-robin, then sort each day by energy
    buckets: list[list[Any]] = [[] for _ in days]
    for i, a in enumerate(activities):
        buckets[i % len(days)].append(a)
    for b in buckets:
        b.sort(key=lambda a: energy_rank.get((a.energy_level or "medium"), 1))
    return buckets


def _strategy_budget_first(
    activities: list[Any], days: list[Any], prefs,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[list[Any]]:
    """Distribute expensive activities evenly so no single day is too costly."""
    existing_by_day = existing_by_day or {}
    sorted_acts = sorted(activities, key=lambda a: -(a.cost_estimate or 0))
    buckets: list[list[Any]] = [[] for _ in days]
    # Pre-fill day_cost with existing scheduled activity costs
    day_cost = [
        sum(a.cost_estimate or 0 for a in existing_by_day.get(day.id, []))
        for day in days
    ]
    for a in sorted_acts:
        idx = day_cost.index(min(day_cost))
        buckets[idx].append(a)
        day_cost[idx] += a.cost_estimate or 0
    return buckets


# ---------- entry point ----------

_STRATEGIES = [
    (
        "Balanced",
        "Spreads activities evenly across days, respecting your pace.",
        _strategy_balanced,
    ),
    (
        "Minimal travel",
        "Groups nearby activities together to cut down on transit time.",
        _strategy_cluster_by_location,
    ),
    (
        "Must-do first",
        "Front-loads your must-do activities into the earliest days.",
        _strategy_must_do_first,
    ),
    (
        "Energy-paced",
        "Starts each day with high-energy activities and winds down.",
        _strategy_energy_paced,
    ),
    (
        "Budget-conscious",
        "Distributes your expensive activities so no single day breaks the bank.",
        _strategy_budget_first,
    ),
]


def generate_arrangements(
    activities: list[Any],
    days: list[Any],
    prefs,
    existing_by_day: dict[int, list[Any]] | None = None,
) -> list[Arrangement]:
    """Run each strategy and return a list of non-empty arrangements (max 5).

    Args:
        existing_by_day: Already-scheduled activities per day (read-only context).
            Strategies use these for capacity/cost/location awareness but never reassign them.
    """
    existing_by_day = existing_by_day or {}
    out: list[Arrangement] = []
    for name, desc, fn in _STRATEGIES:
        try:
            buckets = fn(activities, days, prefs, existing_by_day=existing_by_day)
        except Exception as exc:
            print(f"[arrangement] strategy {name} failed: {exc}")
            continue
        if not buckets:
            continue
        assignments = _schedule_within_days(buckets, days, prefs.day_start, existing_by_day)
        if not assignments:
            continue
        out.append({"name": name, "description": desc, "assignments": assignments})
    return out[:5]

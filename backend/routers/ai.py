"""AI endpoints: activity recommendations (Claude Haiku) and deterministic arrangement strategies."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import ai_client
import arrangement
import crud
import models
from auth import get_current_user, get_db, verify_trip_access

router = APIRouter(prefix="/ai", tags=["ai"])


class RecommendationResponse(BaseModel):
    enabled: bool
    recommendations: list[dict]


@router.post("/trips/{trip_id}/recommend", response_model=RecommendationResponse)
def recommend_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate AI-powered activity recommendations based on trip destination and user preferences."""
    trip = verify_trip_access(db, trip_id, current_user)
    prefs = crud.user_preferences_from_db(current_user)
    prefs_dict = {
        "likes": prefs.likes,
        "dislikes": prefs.dislikes,
        "max_activity_budget": prefs.max_activity_budget,
        "max_walking_km": prefs.max_walking_km,
        "pace": prefs.pace,
        "dietary": prefs.dietary,
    }
    days = (trip.end_date - trip.start_date).days + 1
    recs = ai_client.recommend_activities(trip.destination, days, prefs_dict)
    return RecommendationResponse(
        enabled=ai_client.is_enabled(),
        recommendations=recs,
    )


class ArrangementAssignment(BaseModel):
    activity_id: int
    day_id: int
    position: int
    start_time: str | None = None  # "HH:MM:SS"


class ArrangementOut(BaseModel):
    name: str
    description: str
    assignments: list[ArrangementAssignment]


@router.post("/trips/{trip_id}/arrange", response_model=list[ArrangementOut])
def arrange_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate up to 5 deterministic arrangement strategies for unscheduled activities."""
    trip = verify_trip_access(db, trip_id, current_user)
    prefs = crud.user_preferences_from_db(current_user)

    # All activities for this trip that are unscheduled (day_id is null)
    unscheduled = [
        a for a in crud.get_activities_for_trip(db, trip_id) if a.day_id is None
    ]
    days = (
        db.query(models.Day)
        .filter(models.Day.trip_id == trip_id)
        .order_by(models.Day.date)
        .all()
    )

    if not unscheduled:
        raise HTTPException(status_code=400, detail="No unscheduled activities to arrange")
    if not days:
        raise HTTPException(status_code=400, detail="Trip has no days to arrange into")

    return arrangement.generate_arrangements(unscheduled, days, prefs)


class ApplyArrangementRequest(BaseModel):
    assignments: list[ArrangementAssignment]


@router.post("/trips/{trip_id}/apply-arrangement")
def apply_arrangement(
    trip_id: int,
    req: ApplyArrangementRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Apply a chosen arrangement by batch-updating activity day/position/time assignments."""
    verify_trip_access(db, trip_id, current_user)

    # Single IN query instead of N individual fetches
    activity_ids = [a.activity_id for a in req.assignments]
    activities = (
        db.query(models.Activity)
        .filter(models.Activity.id.in_(activity_ids), models.Activity.trip_id == trip_id)
        .all()
    )
    valid_ids = {a.id for a in activities}

    # Build bulk update mappings
    from datetime import time as _time

    mappings = []
    for a in req.assignments:
        if a.activity_id not in valid_ids:
            continue
        update: dict = {"id": a.activity_id, "day_id": a.day_id, "position": a.position}
        if a.start_time:
            parts = a.start_time.split(":")
            try:
                update["start_time"] = _time(
                    int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
                )
            except (ValueError, IndexError):
                pass
        mappings.append(update)

    if mappings:
        db.bulk_update_mappings(models.Activity, mappings)
    db.commit()
    return {"status": "ok", "applied": len(mappings)}

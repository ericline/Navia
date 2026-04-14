"""Activity CRUD operations: lookup, creation, partial update, and deletion."""
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas


def get_activities_for_trip(db: Session, trip_id: int):
    """Return all activities for a trip, ordered by position."""
    return (
        db.query(models.Activity)
        .filter(models.Activity.trip_id == trip_id)
        .order_by(models.Activity.position)
        .all()
    )


def get_activities_for_day(db: Session, day_id: int):
    """Return all activities scheduled on a specific day, ordered by position."""
    return (
        db.query(models.Activity)
        .filter(models.Activity.day_id == day_id)
        .order_by(models.Activity.position)
        .all()
    )


def get_activity(db: Session, activity_id: int):
    """Fetch a single activity by ID."""
    return db.query(models.Activity).filter(models.Activity.id == activity_id).first()


def create_activity(db: Session, activity: schemas.ActivityCreate):
    """Create an activity and auto-assign the next position in its trip."""
    max_pos = (
        db.query(func.max(models.Activity.position))
        .filter(models.Activity.trip_id == activity.trip_id)
        .scalar()
    ) or 0
    db_activity = models.Activity(
        trip_id=activity.trip_id,
        day_id=activity.day_id,
        name=activity.name,
        category=activity.category,
        address=activity.address,
        lat=activity.lat,
        lng=activity.lng,
        est_duration_minutes=activity.est_duration_minutes,
        cost_estimate=activity.cost_estimate,
        energy_level=activity.energy_level,
        must_do=activity.must_do,
        start_time=activity.start_time,
        notes=activity.notes,
        position=max_pos + 1,
        google_place_id=activity.google_place_id,
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


def update_activity(db: Session, activity_id: int, update: schemas.ActivityUpdate):
    """Partially update an activity. Uses model_fields_set to distinguish
    'not sent' from 'explicitly set to null/zero'."""
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not db_activity:
        return None

    provided = update.model_fields_set

    if update.unschedule:
        db_activity.day_id = None
    elif "day_id" in provided:
        db_activity.day_id = update.day_id

    updatable_fields = [
        "name", "category", "address", "lat", "lng",
        "est_duration_minutes", "cost_estimate", "energy_level", "must_do",
        "start_time", "notes", "position",
    ]
    for field in updatable_fields:
        if field in provided:
            setattr(db_activity, field, getattr(update, field))

    db.commit()
    db.refresh(db_activity)
    return db_activity


def delete_activity(db: Session, activity_id: int):
    """Delete an activity by ID. Returns True if found and deleted, False otherwise."""
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not db_activity:
        return False
    db.delete(db_activity)
    db.commit()
    return True

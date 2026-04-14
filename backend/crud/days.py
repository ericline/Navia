"""Day CRUD operations: lookup, creation, and auto-generation from trip date range."""
from datetime import timedelta

from sqlalchemy.orm import Session

import models
import schemas


def get_days_for_trip(db: Session, trip_id: int):
    """Return all days for a trip."""
    return db.query(models.Day).filter(models.Day.trip_id == trip_id).all()


def get_day(db: Session, day_id: int):
    """Fetch a single day by ID."""
    return db.query(models.Day).filter(models.Day.id == day_id).first()


def create_day(db: Session, day: schemas.DayCreate):
    """Create a single day row."""
    db_day = models.Day(
        trip_id=day.trip_id,
        date=day.date,
        name=day.name,
        notes=day.notes,
        day_start=day.day_start,
        day_end=day.day_end,
    )
    db.add(db_day)
    db.commit()
    db.refresh(db_day)
    return db_day


def update_day(db: Session, day_id: int, update: schemas.DayUpdate):
    """Partially update a day. `reset_start`/`reset_end` sentinels clear per-day
    overrides back to inheriting the user's preferences window."""
    db_day = db.query(models.Day).filter(models.Day.id == day_id).first()
    if not db_day:
        return None

    provided = update.model_fields_set

    if update.reset_start:
        db_day.day_start = None
    elif "day_start" in provided:
        db_day.day_start = update.day_start

    if update.reset_end:
        db_day.day_end = None
    elif "day_end" in provided:
        db_day.day_end = update.day_end

    if "name" in provided:
        db_day.name = update.name
    if "notes" in provided:
        db_day.notes = update.notes

    db.commit()
    db.refresh(db_day)
    return db_day


def generate_days_for_trip(db: Session, trip: models.Trip):
    """Create one Day per date between trip.start_date and trip.end_date (inclusive),
    skipping any dates that already have a Day row."""
    existing_days = db.query(models.Day).filter(models.Day.trip_id == trip.id).all()
    existing_dates = {d.date for d in existing_days}

    current = trip.start_date
    created_days: list[models.Day] = []

    while current <= trip.end_date:
        if current not in existing_dates:
            db_day = models.Day(trip_id=trip.id, date=current, name=None, notes=None)
            db.add(db_day)
            created_days.append(db_day)
        current += timedelta(days=1)

    db.commit()
    for d in created_days:
        db.refresh(d)
    return created_days

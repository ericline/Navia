# backend/crud.py
from datetime import timedelta
from sqlalchemy.orm import Session

import models
import schemas


# ---------- Trip CRUD ----------

def get_trips(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Trip).offset(skip).limit(limit).all()


def get_trip(db: Session, trip_id: int):
    return db.query(models.Trip).filter(models.Trip.id == trip_id).first()


def create_trip(db: Session, trip: schemas.TripCreate):
    db_trip = models.Trip(
        name=trip.name,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        timezone=trip.timezone,
    )
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip


# ---------- Day CRUD ----------

def get_days_for_trip(db: Session, trip_id: int):
    return db.query(models.Day).filter(models.Day.trip_id == trip_id).all()


def get_day(db: Session, day_id: int):
    return db.query(models.Day).filter(models.Day.id == day_id).first()


def create_day(db: Session, day: schemas.DayCreate):
    db_day = models.Day(
        trip_id=day.trip_id,
        date=day.date,
        name=day.name,
        notes=day.notes,
    )
    db.add(db_day)
    db.commit()
    db.refresh(db_day)
    return db_day


def generate_days_for_trip(db: Session, trip: models.Trip):
    """
    Create one Day per date between trip.start_date and trip.end_date (inclusive),
    skipping any dates that already have a Day row.
    """
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


# ---------- Activity CRUD ----------

def get_activities_for_trip(db: Session, trip_id: int):
    return db.query(models.Activity).filter(models.Activity.trip_id == trip_id).all()


def get_activities_for_day(db: Session, day_id: int):
    return db.query(models.Activity).filter(models.Activity.day_id == day_id).all()


def get_activity(db: Session, activity_id: int):
    return db.query(models.Activity).filter(models.Activity.id == activity_id).first()


def create_activity(db: Session, activity: schemas.ActivityCreate):
    # Default: None for time length, 0 for cost if not provided
    cost = activity.cost_estimate if activity.cost_estimate is not None else 0.0

    db_activity = models.Activity(
        trip_id=activity.trip_id,
        day_id=activity.day_id,
        name=activity.name,
        category=activity.category,
        address=activity.address,
        lat=activity.lat,
        lng=activity.lng,
        est_duration_minutes=activity.est_duration_minutes,
        cost_estimate=cost,
        energy_level=activity.energy_level,
        must_do=activity.must_do,
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

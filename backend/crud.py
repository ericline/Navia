# backend/crud.py
from datetime import timedelta
from sqlalchemy.orm import Session

import models
import schemas
from auth import hash_password


# ---------- User CRUD ----------

def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    db_user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        birthday=user_in.birthday,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# ---------- Trip CRUD ----------

def get_trips_for_user(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Return trips owned by the user, plus trips where they are a collaborator."""
    owned = (
        db.query(models.Trip)
        .filter(models.Trip.owner_id == user_id)
        .all()
    )
    collab_ids = {
        row.trip_id
        for row in db.query(models.TripCollaborator)
        .filter(models.TripCollaborator.user_id == user_id)
        .all()
    }
    collab_trips = (
        db.query(models.Trip)
        .filter(models.Trip.id.in_(collab_ids))
        .all()
        if collab_ids
        else []
    )
    all_trips = {t.id: t for t in owned + collab_trips}
    trips = list(all_trips.values())
    trips.sort(key=lambda t: t.id)
    return trips[skip : skip + limit]


def get_trip(db: Session, trip_id: int):
    return db.query(models.Trip).filter(models.Trip.id == trip_id).first()


def create_trip(db: Session, trip: schemas.TripCreate, owner_id: int):
    db_trip = models.Trip(
        name=trip.name,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        timezone=trip.timezone,
        owner_id=owner_id,
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


def update_activity(db: Session, activity_id: int, update: schemas.ActivityUpdate):
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not db_activity:
        return None

    if update.unschedule:
        db_activity.day_id = None
    elif update.day_id is not None:
        db_activity.day_id = update.day_id

    if update.name is not None:
        db_activity.name = update.name
    if update.category is not None:
        db_activity.category = update.category
    if update.address is not None:
        db_activity.address = update.address
    if update.lat is not None:
        db_activity.lat = update.lat
    if update.lng is not None:
        db_activity.lng = update.lng
    if update.est_duration_minutes is not None:
        db_activity.est_duration_minutes = update.est_duration_minutes
    if update.cost_estimate is not None:
        db_activity.cost_estimate = update.cost_estimate
    if update.energy_level is not None:
        db_activity.energy_level = update.energy_level
    if update.must_do is not None:
        db_activity.must_do = update.must_do

    db.commit()
    db.refresh(db_activity)
    return db_activity


def delete_activity(db: Session, activity_id: int):
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not db_activity:
        return False
    db.delete(db_activity)
    db.commit()
    return True

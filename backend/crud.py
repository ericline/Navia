# backend/crud.py
import json
from datetime import timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

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


def update_user(db: Session, user_id: int, update: schemas.UserUpdate) -> models.User | None:
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    provided = update.model_fields_set
    if "name" in provided:
        db_user.name = update.name
    if "email" in provided:
        db_user.email = update.email
    if "birthday" in provided:
        db_user.birthday = update.birthday
    if "preferences" in provided and update.preferences is not None:
        p = update.preferences
        db_user.pref_max_walking_km = p.max_walking_km
        db_user.pref_max_activity_budget = p.max_activity_budget
        db_user.pref_likes = json.dumps(p.likes)
        db_user.pref_dislikes = json.dumps(p.dislikes)
        db_user.pref_pace = p.pace
        db_user.pref_day_start = p.day_start
        db_user.pref_day_end = p.day_end
        db_user.pref_dietary = json.dumps(p.dietary)
    db.commit()
    db.refresh(db_user)
    return db_user


def user_preferences_from_db(user: models.User) -> schemas.UserPreferences:
    """Build a UserPreferences schema from the stored columns, applying defaults."""
    defaults = schemas.UserPreferences()

    def _decode_list(raw):
        if not raw:
            return []
        try:
            v = json.loads(raw)
            return v if isinstance(v, list) else []
        except (ValueError, TypeError):
            return []

    return schemas.UserPreferences(
        max_walking_km=user.pref_max_walking_km if user.pref_max_walking_km is not None else defaults.max_walking_km,
        max_activity_budget=user.pref_max_activity_budget if user.pref_max_activity_budget is not None else defaults.max_activity_budget,
        likes=_decode_list(user.pref_likes),
        dislikes=_decode_list(user.pref_dislikes),
        pace=user.pref_pace or defaults.pace,
        day_start=user.pref_day_start or defaults.day_start,
        day_end=user.pref_day_end or defaults.day_end,
        dietary=_decode_list(user.pref_dietary),
    )


def user_to_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        birthday=user.birthday,
        preferences=user_preferences_from_db(user),
    )


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


def get_trips_detailed_for_user(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Return trips with eager-loaded days and activities in a single query."""
    owned = (
        db.query(models.Trip)
        .options(joinedload(models.Trip.days), joinedload(models.Trip.activities))
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
        .options(joinedload(models.Trip.days), joinedload(models.Trip.activities))
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
    return (
        db.query(models.Activity)
        .filter(models.Activity.trip_id == trip_id)
        .order_by(models.Activity.position)
        .all()
    )


def get_activities_for_day(db: Session, day_id: int):
    return (
        db.query(models.Activity)
        .filter(models.Activity.day_id == day_id)
        .order_by(models.Activity.position)
        .all()
    )


def get_activity(db: Session, activity_id: int):
    return db.query(models.Activity).filter(models.Activity.id == activity_id).first()


def create_activity(db: Session, activity: schemas.ActivityCreate):
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
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


def update_activity(db: Session, activity_id: int, update: schemas.ActivityUpdate):
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not db_activity:
        return None

    # Use model_fields_set to distinguish "not sent" from "explicitly set to null/zero"
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
    db_activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not db_activity:
        return False
    db.delete(db_activity)
    db.commit()
    return True


# ---------- Collaborator CRUD ----------

def get_collaborators(db: Session, trip_id: int):
    rows = (
        db.query(models.TripCollaborator)
        .filter(models.TripCollaborator.trip_id == trip_id)
        .all()
    )
    result = []
    for c in rows:
        user = db.query(models.User).filter(models.User.id == c.user_id).first()
        if user:
            result.append({
                "id": c.id,
                "user_id": c.user_id,
                "user_name": user.name,
                "user_email": user.email,
                "role": c.role,
            })
    return result


def add_collaborator(db: Session, trip_id: int, user_id: int, role: str = "editor"):
    collab = models.TripCollaborator(trip_id=trip_id, user_id=user_id, role=role)
    db.add(collab)
    db.commit()
    db.refresh(collab)
    return collab


def remove_collaborator(db: Session, trip_id: int, user_id: int):
    collab = (
        db.query(models.TripCollaborator)
        .filter(
            models.TripCollaborator.trip_id == trip_id,
            models.TripCollaborator.user_id == user_id,
        )
        .first()
    )
    if not collab:
        return False
    db.delete(collab)
    db.commit()
    return True

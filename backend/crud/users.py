"""User CRUD operations: lookup, creation, update, and preference serialization."""
import json

from sqlalchemy.orm import Session

import models
import schemas
from auth import hash_password


def get_user_by_email(db: Session, email: str) -> models.User | None:
    """Find a user by email address, or None if not found."""
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    """Register a new user with a bcrypt-hashed password."""
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
    """Partially update a user's profile and/or preferences."""
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
    """Convert a User ORM object to the public-facing UserOut schema."""
    return schemas.UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        birthday=user.birthday,
        preferences=user_preferences_from_db(user),
    )

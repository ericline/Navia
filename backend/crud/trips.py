"""Trip CRUD operations and response serialization."""
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, subqueryload

import models
import schemas


def get_trips_for_user(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Return trips owned by or shared with the user in a single query."""
    collab_trip_ids = select(models.TripCollaborator.trip_id).where(
        models.TripCollaborator.user_id == user_id
    )
    return (
        db.query(models.Trip)
        .options(joinedload(models.Trip.owner))
        .filter(
            or_(
                models.Trip.owner_id == user_id,
                models.Trip.id.in_(collab_trip_ids),
            )
        )
        .order_by(models.Trip.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_trips_detailed_for_user(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """Return trips with eager-loaded days and activities in a single query.

    Uses subqueryload (not joinedload) for days and activities to avoid
    a Cartesian product from two one-to-many JOINs.
    """
    collab_trip_ids = select(models.TripCollaborator.trip_id).where(
        models.TripCollaborator.user_id == user_id
    )
    return (
        db.query(models.Trip)
        .options(
            joinedload(models.Trip.owner),
            subqueryload(models.Trip.days),
            subqueryload(models.Trip.activities),
        )
        .filter(
            or_(
                models.Trip.owner_id == user_id,
                models.Trip.id.in_(collab_trip_ids),
            )
        )
        .order_by(models.Trip.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_trip(db: Session, trip_id: int):
    """Fetch a single trip by ID."""
    return db.query(models.Trip).filter(models.Trip.id == trip_id).first()


def create_trip(db: Session, trip: schemas.TripCreate, owner_id: int):
    """Create a new trip owned by the given user."""
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


def trip_to_response(trip: models.Trip) -> dict:
    """Convert a Trip ORM object to a dict matching the Trip schema, including owner info."""
    d = {c.name: getattr(trip, c.name) for c in trip.__table__.columns}
    d["owner_name"] = trip.owner.name if trip.owner else None
    d["owner_email"] = trip.owner.email if trip.owner else None
    return d

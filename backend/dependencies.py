"""Shared FastAPI dependencies for authorization and access control.

Separated from auth.py to keep JWT/password concerns distinct from
resource-level authorization logic.
"""
from sqlalchemy import exists
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

import models


def verify_trip_access(db: Session, trip_id: int, user: models.User) -> models.Trip:
    """Return the Trip if the user owns it or is a collaborator.

    Raises 404 if trip doesn't exist, 403 if user has no access.
    Uses an EXISTS subquery instead of lazy-loading all collaborators,
    and eagerly loads the owner relationship for downstream use.
    """
    trip = (
        db.query(models.Trip)
        .options(joinedload(models.Trip.owner))
        .filter(models.Trip.id == trip_id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.owner_id == user.id:
        return trip
    is_collab = db.query(
        exists().where(
            models.TripCollaborator.trip_id == trip_id,
            models.TripCollaborator.user_id == user.id,
        )
    ).scalar()
    if not is_collab:
        raise HTTPException(status_code=403, detail="Not authorized to access this trip")
    return trip

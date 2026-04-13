"""Collaborator CRUD operations: lookup, existence check, add, and remove."""
from sqlalchemy import exists
from sqlalchemy.orm import Session, joinedload

import models


def get_collaborators(db: Session, trip_id: int):
    """Return all collaborators for a trip with user details (single JOIN query)."""
    rows = (
        db.query(models.TripCollaborator)
        .options(joinedload(models.TripCollaborator.user))
        .filter(models.TripCollaborator.trip_id == trip_id)
        .all()
    )
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "user_name": c.user.name,
            "user_email": c.user.email,
            "role": c.role,
        }
        for c in rows
        if c.user is not None
    ]


def is_collaborator(db: Session, trip_id: int, user_id: int) -> bool:
    """Check if a user is already a collaborator on a trip using EXISTS (no full load)."""
    return db.query(
        exists().where(
            models.TripCollaborator.trip_id == trip_id,
            models.TripCollaborator.user_id == user_id,
        )
    ).scalar()


def add_collaborator(db: Session, trip_id: int, user_id: int, role: str = "editor"):
    """Add a user as a collaborator on a trip."""
    collab = models.TripCollaborator(trip_id=trip_id, user_id=user_id, role=role)
    db.add(collab)
    db.commit()
    db.refresh(collab)
    return collab


def remove_collaborator(db: Session, trip_id: int, user_id: int):
    """Remove a collaborator. Returns True if found and removed, False otherwise."""
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

"""Trip endpoints: CRUD, day generation, constellation (public), and collaborator management."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import crud
import schemas
import models
from auth import get_db, get_current_user, verify_trip_access

router = APIRouter(
    prefix="/trips",
    tags=["trips"],
)


@router.get("/", response_model=List[schemas.Trip])
def read_trips(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all trips owned by or shared with the authenticated user."""
    trips = crud.get_trips_for_user(db, current_user.id, skip=skip, limit=limit)
    return [crud.trip_to_response(t) for t in trips]


@router.get("/detailed", response_model=List[schemas.TripDetailed])
def read_trips_detailed(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all trips with nested days and activities in a single response."""
    trips = crud.get_trips_detailed_for_user(db, current_user.id, skip=skip, limit=limit)
    result = []
    for t in trips:
        d = crud.trip_to_response(t)
        d["days"] = t.days
        d["activities"] = t.activities
        result.append(d)
    return result


@router.get("/{trip_id}", response_model=schemas.Trip)
def read_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Fetch a single trip by ID (requires ownership or collaborator access)."""
    trip = verify_trip_access(db, trip_id, current_user)
    return crud.trip_to_response(trip)


@router.get("/{trip_id}/constellation", response_model=schemas.TripPublic)
def get_trip_constellation(
    trip_id: int,
    db: Session = Depends(get_db),
):
    """Public endpoint — no auth required. Returns basic trip info + day count."""
    trip = crud.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    day_count = len(crud.get_days_for_trip(db, trip_id))
    return {
        "id": trip.id,
        "name": trip.name,
        "destination": trip.destination,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "day_count": day_count,
    }


@router.post("/", response_model=schemas.Trip)
def create_trip(
    trip: schemas.TripCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new trip owned by the authenticated user."""
    new_trip = crud.create_trip(db=db, trip=trip, owner_id=current_user.id)
    return crud.trip_to_response(new_trip)


@router.post("/{trip_id}/generate-days", response_model=List[schemas.Day])
def generate_days_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Auto-generate one Day row per date in the trip's date range."""
    trip = verify_trip_access(db, trip_id, current_user)
    return crud.generate_days_for_trip(db, trip)


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a trip and all associated days/activities (cascading)."""
    trip = verify_trip_access(db, trip_id, current_user)
    db.delete(trip)
    db.commit()


# ---------- Collaborators ----------

@router.get("/{trip_id}/collaborators", response_model=List[schemas.CollaboratorOut])
def list_collaborators(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all collaborators on a trip with their user details."""
    verify_trip_access(db, trip_id, current_user)
    return crud.get_collaborators(db, trip_id)


@router.post("/{trip_id}/collaborators", response_model=schemas.CollaboratorOut)
def invite_collaborator(
    trip_id: int,
    invite: schemas.CollaboratorInvite,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Invite a registered user as a collaborator (owner only)."""
    trip = verify_trip_access(db, trip_id, current_user)
    if trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the trip owner can invite collaborators")
    target_user = crud.get_user_by_email(db, invite.email)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found — they must register first")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You are already the owner")
    if crud.is_collaborator(db, trip_id, target_user.id):
        raise HTTPException(status_code=400, detail="User is already a collaborator")
    collab = crud.add_collaborator(db, trip_id, target_user.id, invite.role)
    return {
        "id": collab.id,
        "user_id": target_user.id,
        "user_name": target_user.name,
        "user_email": target_user.email,
        "role": collab.role,
    }


@router.delete("/{trip_id}/collaborators/{user_id}", status_code=204)
def remove_collaborator(
    trip_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove a collaborator from a trip (owner only)."""
    trip = verify_trip_access(db, trip_id, current_user)
    if trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the trip owner can remove collaborators")
    if not crud.remove_collaborator(db, trip_id, user_id):
        raise HTTPException(status_code=404, detail="Collaborator not found")

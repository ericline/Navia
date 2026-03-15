# backend/routers/trips.py
from typing import List
from fastapi import APIRouter, Depends
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
    return crud.get_trips_for_user(db, current_user.id, skip=skip, limit=limit)


@router.get("/{trip_id}", response_model=schemas.Trip)
def read_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return verify_trip_access(db, trip_id, current_user)


@router.post("/", response_model=schemas.Trip)
def create_trip(
    trip: schemas.TripCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.create_trip(db=db, trip=trip, owner_id=current_user.id)


@router.post("/{trip_id}/generate-days", response_model=List[schemas.Day])
def generate_days_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = verify_trip_access(db, trip_id, current_user)
    return crud.generate_days_for_trip(db, trip)


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = verify_trip_access(db, trip_id, current_user)
    db.delete(trip)
    db.commit()

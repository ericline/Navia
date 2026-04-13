"""Day endpoints: list by trip, fetch by ID, and manual creation."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import models
import schemas
from auth import get_db, get_current_user, verify_trip_access

router = APIRouter(
    prefix="/days",
    tags=["days"],
)


@router.get("/trip/{trip_id}", response_model=List[schemas.Day])
def read_days_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all days for a trip."""
    verify_trip_access(db, trip_id, current_user)
    return crud.get_days_for_trip(db, trip_id=trip_id)


@router.get("/{day_id}", response_model=schemas.Day)
def read_day(
    day_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Fetch a single day by ID."""
    day = crud.get_day(db, day_id=day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    verify_trip_access(db, day.trip_id, current_user)
    return day


@router.post("/", response_model=schemas.Day)
def create_day(
    day: schemas.DayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a single day row within a trip."""
    verify_trip_access(db, day.trip_id, current_user)
    return crud.create_day(db=db, day=day)

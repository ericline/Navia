# backend/routers/activities.py
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
import crud
import schemas

router = APIRouter(
    prefix="/activities",
    tags=["activities"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/trip/{trip_id}", response_model=List[schemas.Activity])
def read_activities_for_trip(trip_id: int, db: Session = Depends(get_db)):
    activities = crud.get_activities_for_trip(db, trip_id=trip_id)
    return activities


@router.get("/day/{day_id}", response_model=List[schemas.Activity])
def read_activities_for_day(day_id: int, db: Session = Depends(get_db)):
    activities = crud.get_activities_for_day(db, day_id=day_id)
    return activities


@router.get("/{activity_id}", response_model=schemas.Activity)
def read_activity(activity_id: int, db: Session = Depends(get_db)):
    activity = crud.get_activity(db, activity_id=activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.post("/", response_model=schemas.Activity)
def create_activity(activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    # Optional: verify trip exists
    trip = crud.get_trip(db, trip_id=activity.trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # If a day_id is provided, you could also verify that the day belongs to the same trip
    if activity.day_id is not None:
        day = crud.get_day(db, day_id=activity.day_id)
        if not day:
            raise HTTPException(status_code=404, detail="Day not found")
        if day.trip_id != activity.trip_id:
            raise HTTPException(
                status_code=400,
                detail="Day does not belong to the given trip",
            )

    return crud.create_activity(db=db, activity=activity)

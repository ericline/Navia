# backend/routers/days.py
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
import crud
import schemas

router = APIRouter(
    prefix="/days",
    tags=["days"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/trip/{trip_id}", response_model=List[schemas.Day])
def read_days_for_trip(trip_id: int, db: Session = Depends(get_db)):
    days = crud.get_days_for_trip(db, trip_id=trip_id)
    return days


@router.get("/{day_id}", response_model=schemas.Day)
def read_day(day_id: int, db: Session = Depends(get_db)):
    day = crud.get_day(db, day_id=day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    return day


@router.post("/", response_model=schemas.Day)
def create_day(day: schemas.DayCreate, db: Session = Depends(get_db)):
    # Optional: check that trip exists first
    trip = crud.get_trip(db, trip_id=day.trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return crud.create_day(db=db, day=day)

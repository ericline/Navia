# backend/routers/trips.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from database import SessionLocal

router = APIRouter(
    prefix="/trips",
    tags=["trips"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=List[schemas.Trip])
def read_trips(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    trips = crud.get_trips(db, skip=skip, limit=limit)
    return trips

@router.get("/{trip_id}", response_model=schemas.Trip)
def read_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = crud.get_trip(db, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@router.post("/", response_model=schemas.Trip)
def create_trip(trip: schemas.TripCreate, db: Session = Depends(get_db)):
    return crud.create_trip(db=db, trip=trip)

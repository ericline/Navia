# backend/crud.py
from sqlalchemy.orm import Session
import models
import schemas

def get_trips(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Trip).offset(skip).limit(limit).all()

def get_trip(db: Session, trip_id: int):
    return db.query(models.Trip).filter(models.Trip.id == trip_id).first()

def create_trip(db: Session, trip: schemas.TripCreate):
    db_trip = models.Trip(
        name=trip.name,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        timezone=trip.timezone,
    )
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip

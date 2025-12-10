# backend/schemas.py
from datetime import date
from pydantic import BaseModel

class TripBase(BaseModel):
    name: str
    destination: str
    start_date: date
    end_date: date
    timezone: str = "America/New_York"

class TripCreate(TripBase):
    pass

class Trip(TripBase):
    id: int

    class Config:
        orm_mode = True  # allows returning SQLAlchemy objects

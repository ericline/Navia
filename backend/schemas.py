# backend/schemas.py
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------- Trip Schemas ----------

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

    # Pydantic v2 way to allow reading from ORM objects
    model_config = ConfigDict(from_attributes=True)


# ---------- Day Schemas ----------

class DayBase(BaseModel):
    trip_id: int
    date: date
    name: Optional[str] = None      # e.g., "Day 1", "Arrival Day"
    notes: Optional[str] = None


class DayCreate(DayBase):
    pass


class Day(DayBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Activity Schemas ----------

class ActivityBase(BaseModel):
    trip_id: int
    day_id: Optional[int] = None

    name: str
    category: Optional[str] = None      # "food", "museum", etc.
    address: Optional[str] = None

    lat: Optional[float] = None
    lng: Optional[float] = None

    est_duration_minutes: Optional[int] = None
    cost_estimate: Optional[float] = None
    energy_level: Optional[str] = None   # "low", "medium", "high"
    must_do: bool = False


class ActivityCreate(ActivityBase):
    pass


class Activity(ActivityBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

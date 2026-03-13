# backend/schemas.py
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------- User / Auth Schemas ----------

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    birthday: Optional[date] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    birthday: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


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

    model_config = ConfigDict(from_attributes=True)


# ---------- Day Schemas ----------

class DayBase(BaseModel):
    trip_id: int
    date: date
    name: Optional[str] = None
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
    category: Optional[str] = None
    address: Optional[str] = None

    lat: Optional[float] = None
    lng: Optional[float] = None

    est_duration_minutes: Optional[int] = None
    cost_estimate: Optional[float] = None
    energy_level: Optional[str] = None
    must_do: bool = False


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    day_id: Optional[int] = None
    name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    est_duration_minutes: Optional[int] = None
    cost_estimate: Optional[float] = None
    energy_level: Optional[str] = None
    must_do: Optional[bool] = None
    # sentinel to allow explicitly setting day_id to null (unschedule)
    unschedule: bool = False


class Activity(ActivityBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# backend/schemas.py
from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


# ---------- User / Auth Schemas ----------

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=200)
    birthday: Optional[date] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    birthday: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    birthday: Optional[date] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ---------- Trip Schemas ----------

class TripBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    destination: str = Field(..., min_length=1, max_length=500)
    start_date: date
    end_date: date
    timezone: str = "America/New_York"

    @model_validator(mode="after")
    def end_not_before_start(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class TripCreate(TripBase):
    pass


class Trip(TripBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Day Schemas ----------

class DayBase(BaseModel):
    trip_id: int
    date: date
    name: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=2000)


class DayCreate(DayBase):
    pass


class Day(DayBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Activity Schemas ----------

class ActivityBase(BaseModel):
    trip_id: int
    day_id: Optional[int] = None

    name: str = Field(..., min_length=1, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)

    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)

    est_duration_minutes: Optional[int] = Field(None, ge=0, le=1440)
    cost_estimate: Optional[float] = Field(None, ge=0)
    energy_level: Optional[str] = Field(None, max_length=50)
    must_do: bool = False
    start_time: Optional[time] = None


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    day_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    est_duration_minutes: Optional[int] = Field(None, ge=0, le=1440)
    cost_estimate: Optional[float] = Field(None, ge=0)
    energy_level: Optional[str] = Field(None, max_length=50)
    must_do: Optional[bool] = None
    start_time: Optional[time] = None
    # sentinel to allow explicitly setting day_id to null (unschedule)
    unschedule: bool = False


class Activity(ActivityBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Collaborator Schemas ----------

# ---------- Public Trip Schema ----------

class TripPublic(BaseModel):
    id: int
    name: str
    destination: str
    start_date: date
    end_date: date
    day_count: int


# ---------- Aggregated Trip Schema (home page) ----------

class TripDetailed(BaseModel):
    id: int
    name: str
    destination: str
    start_date: date
    end_date: date
    timezone: str
    days: list[Day]
    activities: list[Activity]

    model_config = ConfigDict(from_attributes=True)


class CollaboratorInvite(BaseModel):
    email: EmailStr
    role: str = "editor"


class CollaboratorOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    role: str

"""Pydantic schemas for request/response validation across all API endpoints."""
from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


# ---------- User Preferences ----------

TravelStyle = Literal["adventurous", "cultural", "culinary", "relaxed", "nightlife"]
GroupType = Literal["solo", "couple", "family", "friends"]
SourcePlatform = Literal["tiktok", "instagram", "google_maps", "manual"]


class UserPreferences(BaseModel):
    max_walking_km: float = 2.0
    max_activity_budget: float = 100.0
    likes: list[str] = []
    dislikes: list[str] = []
    pace: Literal["relaxed", "balanced", "packed"] = "balanced"
    day_start: time = time(9, 0)
    day_end: time = time(21, 0)
    dietary: list[str] = []
    travel_style: Optional[TravelStyle] = None
    group_type: Optional[GroupType] = None
    interests: list[str] = []


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
    preferences: UserPreferences = UserPreferences()

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    birthday: Optional[date] = None
    preferences: Optional[UserPreferences] = None


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
    owner_id: int | None = None
    owner_name: str | None = None
    owner_email: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Day Schemas ----------

class DayBase(BaseModel):
    trip_id: int
    date: date
    name: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=2000)
    day_start: Optional[time] = None
    day_end: Optional[time] = None


class DayCreate(DayBase):
    pass


class DayUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=2000)
    day_start: Optional[time] = None
    day_end: Optional[time] = None
    # Sentinels for explicit null so the client can clear a per-day override.
    reset_start: bool = False
    reset_end: bool = False


class Day(DayBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Activity Schemas ----------

class ActivityBase(BaseModel):
    # trip_id is nullable: bucket-list activities have trip_id=None.
    trip_id: Optional[int] = None
    day_id: Optional[int] = None
    user_id: Optional[int] = None

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
    notes: Optional[str] = Field(None, max_length=5000)
    position: int = 0
    google_place_id: Optional[str] = Field(None, max_length=200)
    # Provenance (share sheet / imports)
    source_url: Optional[str] = Field(None, max_length=2000)
    source_platform: Optional[SourcePlatform] = None
    external_id: Optional[str] = Field(None, max_length=200)


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    trip_id: Optional[int] = None
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
    notes: Optional[str] = Field(None, max_length=5000)
    position: Optional[int] = None
    # sentinel to allow explicitly setting day_id to null (unschedule)
    unschedule: bool = False
    # sentinel to push an activity back to the user's bucket list (trip_id=null)
    to_bucket: bool = False
    source_url: Optional[str] = Field(None, max_length=2000)
    source_platform: Optional[SourcePlatform] = None
    external_id: Optional[str] = Field(None, max_length=200)


class Activity(ActivityBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Reorder Schema ----------

class ActivityReorder(BaseModel):
    activity_id: int
    position: int


class ActivityReorderRequest(BaseModel):
    orders: list[ActivityReorder]


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
    owner_id: int | None = None
    owner_name: str | None = None
    owner_email: str | None = None
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


# ---------- Batch Create (imports, multi-save) ----------

class BatchTarget(BaseModel):
    """Exactly one of: bucket=True | trip_id (+ optional day_id) | new_trip."""
    bucket: bool = False
    trip_id: Optional[int] = None
    day_id: Optional[int] = None
    new_trip: Optional[TripCreate] = None

    @model_validator(mode="after")
    def exactly_one_target(self):
        chosen = sum([bool(self.bucket), self.trip_id is not None, self.new_trip is not None])
        if chosen != 1:
            raise ValueError("Provide exactly one of bucket, trip_id, or new_trip")
        if self.day_id is not None and self.trip_id is None:
            raise ValueError("day_id requires trip_id")
        return self


class ActivityBatchCreate(BaseModel):
    target: BatchTarget
    items: list[ActivityCreate] = Field(..., min_length=1, max_length=500)


class ActivityBatchResult(BaseModel):
    trip: Optional[Trip] = None
    created: list[Activity]
    skipped_duplicates: int = 0


# ---------- Link Resolve (TikTok / Instagram / Google Maps place links) ----------

class PlaceCandidateOut(BaseModel):
    google_place_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    price_level: Optional[int] = None
    photo_reference: Optional[str] = None
    google_maps_uri: Optional[str] = None
    confidence: Literal["high", "medium", "low"] = "medium"
    matched_text: Optional[str] = None  # the caption mention / POI name this came from


class LinkResolveRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2000)


class LinkResolveResponse(BaseModel):
    platform: Literal["tiktok", "instagram", "google_maps", "unknown"]
    link_kind: Literal["video", "place", "list", "unknown"]
    source_url: str
    external_id: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    thumbnail_url: Optional[str] = None
    hint_city: Optional[str] = None
    mentions: list[str] = []          # place names we think the caption refers to
    candidates: list[PlaceCandidateOut] = []
    warnings: list[str] = []          # human-readable notes (e.g. "Instagram page not readable")


# ---------- Google Maps Import ----------

class ImportItemOut(BaseModel):
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    google_place_id: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    source_url: Optional[str] = None
    external_id: Optional[str] = None
    resolved: bool = False
    photo_reference: Optional[str] = None


class ImportPreviewResponse(BaseModel):
    list_name: Optional[str] = None
    source: Literal["takeout_csv", "takeout_json", "kml", "zip", "shared_link"]
    items: list[ImportItemOut]
    warnings: list[str] = []


class ImportLinkRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2000)

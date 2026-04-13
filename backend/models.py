"""SQLAlchemy ORM models for users, trips, days, activities, and collaborators."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Time,
    ForeignKey,
    Boolean,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    """Registered user with optional travel preferences stored as individual columns."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    birthday = Column(Date, nullable=True)

    # Preferences (all nullable — defaults applied on read)
    pref_max_walking_km = Column(Float, nullable=True)
    pref_max_activity_budget = Column(Float, nullable=True)
    pref_likes = Column(String, nullable=True)         # JSON-encoded list
    pref_dislikes = Column(String, nullable=True)      # JSON-encoded list
    pref_pace = Column(String, nullable=True)          # "relaxed"|"balanced"|"packed"
    pref_day_start = Column(Time, nullable=True)
    pref_day_end = Column(Time, nullable=True)
    pref_dietary = Column(String, nullable=True)       # JSON-encoded list

    owned_trips = relationship(
        "Trip",
        back_populates="owner",
        foreign_keys="[Trip.owner_id]",
    )
    collaborations = relationship("TripCollaborator", back_populates="user")


class Trip(Base):
    """A travel trip with date range, destination, and owner relationship."""
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    destination = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    timezone = Column(String, default="America/New_York")

    # Auth: nullable so existing rows don't break before migration
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    owner = relationship("User", back_populates="owned_trips", foreign_keys=[owner_id])
    collaborators = relationship(
        "TripCollaborator",
        back_populates="trip",
        cascade="all, delete-orphan",
    )
    days = relationship(
        "Day",
        back_populates="trip",
        cascade="all, delete-orphan",
    )
    activities = relationship(
        "Activity",
        back_populates="trip",
        cascade="all, delete-orphan",
    )


class TripCollaborator(Base):
    """Junction table for trip sharing — maps users to trips with a role (editor/viewer)."""
    __tablename__ = "trip_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="editor")  # "editor" | "viewer"

    __table_args__ = (UniqueConstraint("trip_id", "user_id", name="uq_trip_collaborator"),)

    trip = relationship("Trip", back_populates="collaborators")
    user = relationship("User", back_populates="collaborations")


class Day(Base):
    """A single day within a trip, auto-generated from the trip's date range."""
    __tablename__ = "days"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    date = Column(Date, nullable=False)
    name = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    # Relationships
    trip = relationship("Trip", back_populates="days")
    activities = relationship(
        "Activity",
        back_populates="day",
        passive_deletes=True,
    )


class Activity(Base):
    """A planned activity within a trip, optionally scheduled to a specific day."""
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    day_id = Column(Integer, ForeignKey("days.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String, index=True, nullable=False)
    category = Column(String, nullable=True)
    address = Column(String, nullable=True)

    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    est_duration_minutes = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    energy_level = Column(String, nullable=True)
    must_do = Column(Boolean, default=False)
    start_time = Column(Time, nullable=True)
    notes = Column(String, nullable=True)
    position = Column(Integer, nullable=True, default=0)

    # Relationships
    trip = relationship("Trip", back_populates="activities")
    day = relationship("Day", back_populates="activities")

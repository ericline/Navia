# backend/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    ForeignKey,
    Boolean,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    birthday = Column(Date, nullable=True)

    owned_trips = relationship(
        "Trip",
        back_populates="owner",
        foreign_keys="[Trip.owner_id]",
    )
    collaborations = relationship("TripCollaborator", back_populates="user")


class Trip(Base):
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
    """Future: allows sharing trips between users."""
    __tablename__ = "trip_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="editor")  # "editor" | "viewer"

    __table_args__ = (UniqueConstraint("trip_id", "user_id", name="uq_trip_collaborator"),)

    trip = relationship("Trip", back_populates="collaborators")
    user = relationship("User", back_populates="collaborations")


class Day(Base):
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

    # Relationships
    trip = relationship("Trip", back_populates="activities")
    day = relationship("Day", back_populates="activities")

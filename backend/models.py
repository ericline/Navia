# backend/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    ForeignKey,
    Boolean,
    Float,
)
from sqlalchemy.orm import relationship

from database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    destination = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    timezone = Column(String, default="America/New_York")

    # Relationships
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


class Day(Base):
    __tablename__ = "days"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    date = Column(Date, nullable=False)
    name = Column(String, nullable=True)   # e.g., "Arrival Day", "Day 1"
    notes = Column(String, nullable=True)

    # Relationships
    trip = relationship("Trip", back_populates="days")
    activities = relationship(
        "Activity",
        back_populates="day",
        cascade="all, delete-orphan",
    )


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    day_id = Column(Integer, ForeignKey("days.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String, index=True, nullable=False)
    category = Column(String, nullable=True)   # e.g., "food", "museum", "hike"
    address = Column(String, nullable=True)

    # For later when we add maps & routing
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    est_duration_minutes = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)  # simple number for now
    energy_level = Column(String, nullable=True)   # e.g., "low", "medium", "high"
    must_do = Column(Boolean, default=False)

    # Relationships
    trip = relationship("Trip", back_populates="activities")
    day = relationship("Day", back_populates="activities")

"""SQLAlchemy ORM models for users, trips, days, activities, collaborators, places, and feedback."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Time,
    DateTime,
    ForeignKey,
    Boolean,
    Float,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

try:
    from pgvector.sqlalchemy import Vector
    # On Postgres: real vector(384) column with pgvector ops.
    # On SQLite: store as TEXT (unused — the in-memory path reads `embedding`).
    _VECTOR_COL = Vector(384).with_variant(Text(), "sqlite")
except ImportError:  # pgvector not installed — fall back to Text everywhere
    _VECTOR_COL = Text()

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
    pref_travel_style = Column(String, nullable=True)  # "adventurous"|"cultural"|"culinary"|"relaxed"|"nightlife"
    pref_group_type = Column(String, nullable=True)    # "solo"|"couple"|"family"|"friends"
    pref_interests = Column(String, nullable=True)     # JSON-encoded list (freeform chips)

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
    day_start = Column(Time, nullable=True)  # per-day override; null = inherit from user prefs
    day_end = Column(Time, nullable=True)

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

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=True, index=True)
    day_id = Column(Integer, ForeignKey("days.id", ondelete="SET NULL"), nullable=True, index=True)
    # Owner of the activity. Always populated; for bucket-list items (trip_id IS NULL)
    # this is the sole authorization anchor. For trip activities it's a denormalized
    # cache of the trip owner so ownership checks can stay uniform.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

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
    google_place_id = Column(String, nullable=True, index=True)  # links activity back to Places row for dedupe

    # Relationships
    trip = relationship("Trip", back_populates="activities")
    day = relationship("Day", back_populates="activities")


class Place(Base):
    """A real-world place from Google Places API, used by the custom recommendation model.

    Embeddings are stored as JSON-serialized float arrays (Text column) so the
    schema works on both SQLite (dev) and PostgreSQL (prod).  On PostgreSQL the
    retrieval layer can optionally use pgvector for ANN search; on SQLite we fall
    back to in-memory cosine similarity via numpy.
    """
    __tablename__ = "places"

    id = Column(Integer, primary_key=True, index=True)
    google_place_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    destination = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    address = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    rating = Column(Float, nullable=True)
    rating_count = Column(Integer, nullable=True)
    price_level = Column(Integer, nullable=True)          # 0-4
    description = Column(Text, nullable=True)
    photo_reference = Column(String, nullable=True)       # Google photo reference
    types_raw = Column(Text, nullable=True)               # JSON array of raw Google types
    embedding = Column(Text, nullable=True)               # JSON-serialized 384-d float array (source of truth)
    embedding_vec = Column(_VECTOR_COL, nullable=True)    # Postgres-only pgvector cache column
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RecommendationFeedback(Base):
    """Tracks implicit user signals on recommended places for model retraining.

    Signals: 'added' (user added rec), 'skipped' (shown but not added),
    'scheduled' (assigned to a day), 'deleted' (removed after adding),
    'must_do' (marked as must-do).
    """
    __tablename__ = "recommendation_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_id = Column(Integer, ForeignKey("places.id", ondelete="CASCADE"), nullable=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    signal = Column(String, nullable=False)               # added|skipped|scheduled|deleted|must_do
    created_at = Column(DateTime, server_default=func.now())

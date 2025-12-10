# backend/models.py
from sqlalchemy import Column, Integer, String, Date
from database import Base

class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    destination = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    timezone = Column(String, default="America/New_York")

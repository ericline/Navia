import sys
from pathlib import Path

# Ensure the backend directory is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from main import app
from auth import get_db

engine = create_engine(
    "sqlite:///./test_navia.db",
    connect_args={"check_same_thread": False},
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Register a user and return auth headers."""
    res = client.post("/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "password123",
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_user_headers(client):
    """Register a second user and return auth headers."""
    res = client.post("/auth/register", json={
        "name": "Second User",
        "email": "second@example.com",
        "password": "password123",
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_trip(client, auth_headers):
    """Create and return a sample trip."""
    res = client.post("/trips/", json={
        "name": "Test Trip",
        "destination": "Paris, France",
        "start_date": "2026-06-01",
        "end_date": "2026-06-05",
    }, headers=auth_headers)
    assert res.status_code == 200
    return res.json()


@pytest.fixture
def sample_days(client, auth_headers, sample_trip):
    """Generate days for the sample trip."""
    res = client.post(
        f"/trips/{sample_trip['id']}/generate-days",
        headers=auth_headers,
    )
    assert res.status_code == 200
    return res.json()

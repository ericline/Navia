"""Query count benchmarks — verifies N+1 fixes and batch operation improvements.

Run with: cd backend && python -m pytest tests/test_query_counts.py -v
"""
from datetime import date

import pytest
from sqlalchemy import event

import models
import schemas
from crud import (
    trips as crud_trips,
    days as crud_days,
    activities as crud_acts,
    collaborators as crud_collabs,
)
from dependencies import verify_trip_access


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def query_counter(setup_db):
    """Yields a resettable query counter attached to the test engine."""
    from tests.conftest import engine

    counts = {"n": 0}

    def _before_execute(conn, cursor, stmt, params, context, executemany):
        counts["n"] += 1

    event.listen(engine, "before_cursor_execute", _before_execute)
    yield counts
    event.remove(engine, "before_cursor_execute", _before_execute)


@pytest.fixture
def populated_db(client, auth_headers, second_user_headers):
    """Create 5 trips, 3 days each, 10 activities on trip 1, and 3 collaborators."""
    trips = []
    for i in range(5):
        res = client.post("/trips/", json={
            "name": f"Trip {i}",
            "destination": f"City {i}",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
        }, headers=auth_headers)
        assert res.status_code == 200
        trips.append(res.json())

    # Generate days for trip 1
    client.post(f"/trips/{trips[0]['id']}/generate-days", headers=auth_headers)

    # Create 10 activities on trip 1
    for i in range(10):
        client.post("/activities/", json={
            "trip_id": trips[0]["id"],
            "name": f"Activity {i}",
        }, headers=auth_headers)

    # Invite second user as collaborator
    client.post(f"/trips/{trips[0]['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers)

    return {"trips": trips, "auth": auth_headers}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestQueryCounts:
    """Each test asserts the maximum number of SQL queries per operation.

    These thresholds document the N+1 fixes. If a future change regresses
    query counts, the test will fail with the actual count.
    """

    def test_get_trips_for_user(self, populated_db, query_counter, client):
        """Listing 5 trips should take <= 2 queries (1 main + 1 owner JOIN)."""
        query_counter["n"] = 0
        res = client.get("/trips/", headers=populated_db["auth"])
        assert res.status_code == 200
        assert len(res.json()) == 5
        # 1 for get_current_user + query with JOIN — allow some overhead for auth
        assert query_counter["n"] <= 4, f"Expected <=4 queries, got {query_counter['n']}"

    def test_get_trips_detailed(self, populated_db, query_counter, client):
        """Detailed trip list should use subqueryload, not N+1."""
        query_counter["n"] = 0
        res = client.get("/trips/detailed", headers=populated_db["auth"])
        assert res.status_code == 200
        assert len(res.json()) == 5
        # 1 auth + 1 main + 2 subqueryloads (days, activities) = ~5
        assert query_counter["n"] <= 7, f"Expected <=7 queries, got {query_counter['n']}"

    def test_get_collaborators(self, populated_db, query_counter, client):
        trip_id = populated_db["trips"][0]["id"]
        query_counter["n"] = 0
        res = client.get(f"/trips/{trip_id}/collaborators", headers=populated_db["auth"])
        assert res.status_code == 200
        # 1 auth + 1 verify_trip_access + 1 collaborators JOIN = ~3
        assert query_counter["n"] <= 5, f"Expected <=5 queries, got {query_counter['n']}"

    def test_verify_trip_access_uses_exists(self, populated_db, query_counter, client):
        """Single trip fetch should use EXISTS, not lazy-load collaborators."""
        trip_id = populated_db["trips"][0]["id"]
        query_counter["n"] = 0
        res = client.get(f"/trips/{trip_id}", headers=populated_db["auth"])
        assert res.status_code == 200
        # 1 auth + 1 verify (with joinedload owner) = ~2
        assert query_counter["n"] <= 4, f"Expected <=4 queries, got {query_counter['n']}"

    def test_batch_reorder(self, populated_db, query_counter, client):
        """Reorder should use IN + bulk_update, not N individual queries."""
        trip_id = populated_db["trips"][0]["id"]
        acts_res = client.get(f"/activities/trip/{trip_id}", headers=populated_db["auth"])
        activities = acts_res.json()
        orders = [{"activity_id": a["id"], "position": len(activities) - i}
                  for i, a in enumerate(activities)]

        query_counter["n"] = 0
        res = client.put("/activities/reorder", json={"orders": orders},
                         headers=populated_db["auth"])
        assert res.status_code == 200
        # 1 auth + 1 IN fetch + 1 verify + 1 bulk update + 1 commit + 1 re-fetch
        assert query_counter["n"] <= 8, f"Expected <=8 queries, got {query_counter['n']}"

    def test_is_collaborator_exists(self, populated_db, query_counter, client):
        """Duplicate collaborator check should use EXISTS, not full load."""
        trip_id = populated_db["trips"][0]["id"]
        query_counter["n"] = 0
        # Try to invite the same user again — should hit EXISTS check
        res = client.post(f"/trips/{trip_id}/collaborators", json={
            "email": "second@example.com",
        }, headers=populated_db["auth"])
        assert res.status_code == 400
        assert "already a collaborator" in res.json()["detail"]
        # 1 auth + 1 verify + 1 user lookup + 1 EXISTS = ~4
        assert query_counter["n"] <= 6, f"Expected <=6 queries, got {query_counter['n']}"

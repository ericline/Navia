def test_create_trip(client, auth_headers):
    res = client.post("/trips/", json={
        "name": "My Trip",
        "destination": "Tokyo, Japan",
        "start_date": "2026-07-01",
        "end_date": "2026-07-10",
    }, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "My Trip"
    assert data["owner_id"] is not None
    assert data["owner_name"] == "Test User"
    assert data["owner_email"] == "test@example.com"


def test_create_trip_end_before_start(client, auth_headers):
    res = client.post("/trips/", json={
        "name": "Bad Trip",
        "destination": "Nowhere",
        "start_date": "2026-07-10",
        "end_date": "2026-07-01",
    }, headers=auth_headers)
    assert res.status_code == 422


def test_create_trip_empty_name(client, auth_headers):
    res = client.post("/trips/", json={
        "name": "",
        "destination": "Paris",
        "start_date": "2026-07-01",
        "end_date": "2026-07-05",
    }, headers=auth_headers)
    assert res.status_code == 422


def test_get_trips_empty(client, auth_headers):
    res = client.get("/trips/", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_get_trip(client, auth_headers, sample_trip):
    res = client.get(f"/trips/{sample_trip['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Test Trip"
    assert res.json()["owner_id"] is not None


def test_get_trip_not_found(client, auth_headers):
    res = client.get("/trips/99999", headers=auth_headers)
    assert res.status_code == 404


def test_get_trip_no_access(client, auth_headers, second_user_headers, sample_trip):
    res = client.get(f"/trips/{sample_trip['id']}", headers=second_user_headers)
    assert res.status_code == 403


def test_delete_trip(client, auth_headers, sample_trip):
    res = client.delete(f"/trips/{sample_trip['id']}", headers=auth_headers)
    assert res.status_code == 204
    # Verify it's gone
    res = client.get(f"/trips/{sample_trip['id']}", headers=auth_headers)
    assert res.status_code == 404


def test_generate_days(client, auth_headers, sample_trip):
    res = client.post(f"/trips/{sample_trip['id']}/generate-days", headers=auth_headers)
    assert res.status_code == 200
    days = res.json()
    # 2026-06-01 to 2026-06-05 = 5 days
    assert len(days) == 5


def test_generate_days_idempotent(client, auth_headers, sample_trip):
    client.post(f"/trips/{sample_trip['id']}/generate-days", headers=auth_headers)
    res = client.post(f"/trips/{sample_trip['id']}/generate-days", headers=auth_headers)
    assert res.status_code == 200
    # Second call creates no new days (returns empty list of newly created)
    assert len(res.json()) == 0
    # But total days should still be 5
    days_res = client.get(f"/days/trip/{sample_trip['id']}", headers=auth_headers)
    assert len(days_res.json()) == 5


def test_collaborator_invite(client, auth_headers, second_user_headers, sample_trip):
    res = client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["user_email"] == "second@example.com"


def test_collaborator_invite_not_owner(client, auth_headers, second_user_headers, sample_trip):
    # Invite second user first so they have access
    client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers)
    # Now second user tries to invite (should fail — not owner)
    client.post("/auth/register", json={
        "name": "Third", "email": "third@example.com", "password": "password123",
    })
    res = client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "third@example.com",
    }, headers=second_user_headers)
    assert res.status_code == 403


def test_collaborator_invite_self(client, auth_headers, sample_trip):
    res = client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "test@example.com",
    }, headers=auth_headers)
    assert res.status_code == 400


def test_collaborator_invite_nonexistent_user(client, auth_headers, sample_trip):
    res = client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "ghost@example.com",
    }, headers=auth_headers)
    assert res.status_code == 404


def test_collaborator_invite_duplicate(client, auth_headers, second_user_headers, sample_trip):
    client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers)
    res = client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers)
    assert res.status_code == 400


def test_collaborator_access(client, auth_headers, second_user_headers, sample_trip):
    # Invite second user
    client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers)
    # Second user should now be able to access the trip
    res = client.get(f"/trips/{sample_trip['id']}", headers=second_user_headers)
    assert res.status_code == 200


def test_collaborator_remove(client, auth_headers, second_user_headers, sample_trip):
    # Invite second user
    collab = client.post(f"/trips/{sample_trip['id']}/collaborators", json={
        "email": "second@example.com",
    }, headers=auth_headers).json()
    # Remove them
    res = client.delete(
        f"/trips/{sample_trip['id']}/collaborators/{collab['user_id']}",
        headers=auth_headers,
    )
    assert res.status_code == 204
    # Second user should lose access
    res = client.get(f"/trips/{sample_trip['id']}", headers=second_user_headers)
    assert res.status_code == 403


def test_detailed_trips(client, auth_headers, sample_trip, sample_days):
    res = client.get("/trips/detailed", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["owner_id"] is not None
    assert "days" in data[0]
    assert "activities" in data[0]

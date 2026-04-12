def test_create_activity(client, auth_headers, sample_trip, sample_days):
    day_id = sample_days[0]["id"]
    res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "day_id": day_id,
        "name": "Visit Eiffel Tower",
        "category": "landmark",
        "address": "Champ de Mars, Paris",
        "est_duration_minutes": 120,
        "cost_estimate": 25.0,
        "energy_level": "medium",
        "must_do": True,
        "start_time": "10:00:00",
        "notes": "Book tickets in advance",
    }, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Visit Eiffel Tower"
    assert data["notes"] == "Book tickets in advance"
    assert data["position"] > 0


def test_create_activity_minimal(client, auth_headers, sample_trip):
    res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "name": "Free time",
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Free time"
    assert res.json()["day_id"] is None


def test_create_activity_empty_name(client, auth_headers, sample_trip):
    res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "name": "",
    }, headers=auth_headers)
    assert res.status_code == 422


def test_create_activity_invalid_day(client, auth_headers, sample_trip):
    res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "day_id": 99999,
        "name": "Ghost Day",
    }, headers=auth_headers)
    assert res.status_code == 404


def test_update_activity(client, auth_headers, sample_trip):
    # Create
    create_res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "name": "Original",
    }, headers=auth_headers)
    activity_id = create_res.json()["id"]

    # Update
    res = client.patch(f"/activities/{activity_id}", json={
        "name": "Updated",
        "notes": "Added notes",
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Updated"
    assert res.json()["notes"] == "Added notes"


def test_update_activity_unschedule(client, auth_headers, sample_trip, sample_days):
    day_id = sample_days[0]["id"]
    create_res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "day_id": day_id,
        "name": "Scheduled",
    }, headers=auth_headers)
    activity_id = create_res.json()["id"]

    res = client.patch(f"/activities/{activity_id}", json={
        "unschedule": True,
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["day_id"] is None


def test_delete_activity(client, auth_headers, sample_trip):
    create_res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "name": "To Delete",
    }, headers=auth_headers)
    activity_id = create_res.json()["id"]

    res = client.delete(f"/activities/{activity_id}", headers=auth_headers)
    assert res.status_code == 200

    # Verify it's gone
    res = client.get(f"/activities/{activity_id}", headers=auth_headers)
    assert res.status_code == 404


def test_get_activity_no_access(client, auth_headers, second_user_headers, sample_trip):
    create_res = client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "name": "Private",
    }, headers=auth_headers)
    activity_id = create_res.json()["id"]

    res = client.get(f"/activities/{activity_id}", headers=second_user_headers)
    assert res.status_code == 403


def test_reorder_activities(client, auth_headers, sample_trip, sample_days):
    day_id = sample_days[0]["id"]
    ids = []
    for name in ["First", "Second", "Third"]:
        res = client.post("/activities/", json={
            "trip_id": sample_trip["id"],
            "day_id": day_id,
            "name": name,
        }, headers=auth_headers)
        ids.append(res.json()["id"])

    # Reverse the order
    res = client.put("/activities/reorder", json={
        "orders": [
            {"activity_id": ids[2], "position": 0},
            {"activity_id": ids[1], "position": 1},
            {"activity_id": ids[0], "position": 2},
        ],
    }, headers=auth_headers)
    assert res.status_code == 200

    # Verify order
    activities = client.get(
        f"/activities/day/{day_id}", headers=auth_headers,
    ).json()
    assert activities[0]["name"] == "Third"
    assert activities[1]["name"] == "Second"
    assert activities[2]["name"] == "First"


def test_get_activities_for_trip(client, auth_headers, sample_trip):
    for name in ["A", "B"]:
        client.post("/activities/", json={
            "trip_id": sample_trip["id"],
            "name": name,
        }, headers=auth_headers)

    res = client.get(f"/activities/trip/{sample_trip['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_get_activities_for_day(client, auth_headers, sample_trip, sample_days):
    day_id = sample_days[0]["id"]
    client.post("/activities/", json={
        "trip_id": sample_trip["id"],
        "day_id": day_id,
        "name": "Day Activity",
    }, headers=auth_headers)

    res = client.get(f"/activities/day/{day_id}", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1

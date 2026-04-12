def test_get_days_for_trip(client, auth_headers, sample_trip, sample_days):
    res = client.get(f"/days/trip/{sample_trip['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 5


def test_get_day(client, auth_headers, sample_days):
    day_id = sample_days[0]["id"]
    res = client.get(f"/days/{day_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == day_id


def test_get_day_not_found(client, auth_headers):
    res = client.get("/days/99999", headers=auth_headers)
    assert res.status_code == 404


def test_get_day_no_access(client, auth_headers, second_user_headers, sample_days):
    day_id = sample_days[0]["id"]
    res = client.get(f"/days/{day_id}", headers=second_user_headers)
    assert res.status_code == 403

"""KML/CSV export tests, including a KML → importer round trip."""
from services import google_maps_import


def _seed(client, auth_headers, sample_trip, sample_days):
    a = client.post("/activities/", json={
        "trip_id": sample_trip["id"], "day_id": sample_days[0]["id"], "name": "Louvre & Co",
        "address": "Rue de Rivoli", "lat": 48.8606, "lng": 2.3376, "category": "museum",
        "notes": "Book <tickets>", "google_place_id": "ChIJlouvre",
    }, headers=auth_headers).json()
    b = client.post("/activities/", json={
        "trip_id": sample_trip["id"], "name": "Unscheduled cafe", "category": "cafe",
    }, headers=auth_headers).json()
    return a, b


def test_export_trip_kml_round_trip(client, auth_headers, sample_trip, sample_days):
    _seed(client, auth_headers, sample_trip, sample_days)
    res = client.get(f"/exports/google-maps?scope=trip&trip_id={sample_trip['id']}&format=kml", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"].startswith("application/vnd.google-earth.kml+xml")
    assert 'filename="navia-Test-Trip.kml"' in res.headers["content-disposition"]
    kml = res.text
    assert "<Folder><name>Day 1 — 2026-06-01</name>" in kml
    assert "<Folder><name>Unscheduled</name>" in kml
    assert "Louvre &amp; Co" in kml and "&lt;tickets&gt;" in kml
    assert "query_place_id=ChIJlouvre" in kml

    parsed = google_maps_import.parse_kml(kml)
    assert parsed.list_name == "Test Trip (Paris, France)"
    names = {i.name for i in parsed.items}
    assert names == {"Louvre & Co", "Unscheduled cafe"}
    louvre = next(i for i in parsed.items if i.name == "Louvre & Co")
    assert louvre.lat == 48.8606 and louvre.lng == 2.3376
    assert louvre.google_place_id == "ChIJlouvre" and louvre.category == "museum"
    assert louvre.address == "Rue de Rivoli" and louvre.notes == "Book <tickets>"


def test_export_bucket_csv(client, auth_headers):
    client.post("/activities/", json={"trip_id": None, "name": "Bucket spot", "lat": 1.5, "lng": 2.5, "category": "bar"}, headers=auth_headers)
    res = client.get("/exports/google-maps?scope=bucket&format=csv", headers=auth_headers)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    lines = res.text.strip().splitlines()
    assert lines[0].startswith("Title,Note,URL,Address,Latitude,Longitude,Category")
    assert "Bucket spot" in lines[1] and "query=1.5,2.5" in lines[1] and lines[1].endswith(",bar")


def test_export_trip_requires_trip_id_and_access(client, auth_headers, second_user_headers, sample_trip):
    assert client.get("/exports/google-maps?scope=trip", headers=auth_headers).status_code == 400
    assert client.get(f"/exports/google-maps?scope=trip&trip_id={sample_trip['id']}", headers=second_user_headers).status_code == 403
    assert client.get("/exports/google-maps").status_code == 401

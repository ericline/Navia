"""Google Maps import (preview + batch commit) tests. Google Places is stubbed."""
import io
import json
import zipfile

import pytest

from services import google_places, google_maps_import


def _place(gid, name, lat=40.7, lng=-73.9, category="food"):
    return google_places.PlaceCandidate(
        google_place_id=gid, name=name, address=f"{name} St", lat=lat, lng=lng, category=category,
        photo_reference=f"places/{gid}/photos/1",
    )


@pytest.fixture(autouse=True)
def _places(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    monkeypatch.setattr(
        google_places, "search_text",
        lambda q, **kw: [_place("ChIJ_" + q.split()[0].lower().strip("'s,"), q.split(",")[0].strip())],
    )
    monkeypatch.setattr(google_places, "place_details", lambda pid: _place(pid, "Detail " + pid))


TAKEOUT_CSV = (
    "﻿Title,Note,URL,Tags\n"
    "Katz's Delicatessen,pastrami,https://www.google.com/maps/place/Katz's+Delicatessen/data=!4m2!3m1!1s0x89c2598a6e1c5c93:0x6e6b7b8c,\n"
    "Joe's Pizza,,\"https://www.google.com/maps/search/?api=1&query=40.73,-74.0&query_place_id=ChIJjoes\",late night\n"
    ",,,\n"
)

TAKEOUT_JSON = json.dumps({
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-73.9874, 40.7223]},
         "properties": {"Google Maps URL": "https://www.google.com/maps/place/?q=place_id:ChIJk",
                        "Location": {"Address": "205 E Houston St", "Business Name": "Katz's Delicatessen",
                                     "Geo Coordinates": {"Latitude": "40.7223", "Longitude": "-73.9874"}},
                        "Title": "Katz's Delicatessen"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [139.73, 35.66]},
         "properties": {"google_maps_url": "https://maps.google.com/?cid=123456", "location": {"name": "Sushi Saito", "address": "Tokyo"}, "date": "2026"}},
    ],
})

KML = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Tokyo Faves</name>
<Placemark><name>Sushi Saito</name><description>omakase</description><Point><coordinates>139.73,35.66,0</coordinates></Point></Placemark>
<Placemark><name>Blue Bottle Shinjuku</name><ExtendedData><Data name="category"><value>cafe</value></Data></ExtendedData><Point><coordinates>139.70,35.69,0</coordinates></Point></Placemark>
</Document></kml>"""


def test_parse_takeout_csv():
    parsed = google_maps_import.parse_takeout_csv(TAKEOUT_CSV, "NYC Eats")
    assert parsed.source == "takeout_csv" and parsed.list_name == "NYC Eats"
    assert [i.name for i in parsed.items] == ["Katz's Delicatessen", "Joe's Pizza"]
    assert parsed.items[0].notes == "pastrami"
    assert parsed.items[0].external_id == "gmaps:0x89c2598a6e1c5c93:0x6e6b7b8c"
    assert parsed.items[1].google_place_id == "ChIJjoes"
    assert parsed.items[1].lat == 40.73 and parsed.items[1].notes == "Tags: late night"


def test_parse_takeout_json_both_key_styles():
    parsed = google_maps_import.parse_takeout_json(TAKEOUT_JSON, "Saved Places")
    assert [i.name for i in parsed.items] == ["Katz's Delicatessen", "Sushi Saito"]
    assert parsed.items[0].address == "205 E Houston St"
    assert parsed.items[0].lat == 40.7223
    assert parsed.items[1].external_id == "gmaps:123456"
    assert parsed.items[1].lng == 139.73


def test_parse_kml():
    parsed = google_maps_import.parse_kml(KML)
    assert parsed.list_name == "Tokyo Faves"
    assert parsed.items[0].name == "Sushi Saito" and parsed.items[0].notes == "omakase"
    assert parsed.items[0].lat == 35.66
    assert parsed.items[1].category == "cafe"


def test_parse_zip_mixes_lists():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Takeout/Maps (your places)/NYC Eats.csv", TAKEOUT_CSV)
        zf.writestr("Takeout/Maps (your places)/Saved Places.json", TAKEOUT_JSON)
    parsed = google_maps_import.parse_bytes(buf.getvalue(), "takeout.zip")
    assert parsed.source == "zip"
    assert len(parsed.items) == 4
    assert parsed.items[0].notes.startswith("[NYC Eats]")


def test_parse_bytes_sniffs_type():
    assert google_maps_import.parse_bytes(KML.encode(), "whatever.txt").source == "kml"
    assert google_maps_import.parse_bytes(TAKEOUT_JSON.encode(), "x").source == "takeout_json"
    assert google_maps_import.parse_bytes(TAKEOUT_CSV.encode(), "x.csv").source == "takeout_csv"


def test_resolve_items_uses_bias_and_details(monkeypatch):
    calls = []
    def fake_search(q, *, location_bias=None, radius_m=5000.0, max_results=5):
        calls.append((q, location_bias, radius_m))
        return [_place("ChIJ_x", q)]
    monkeypatch.setattr(google_places, "search_text", fake_search)
    items = [
        google_maps_import.ImportItem(name="Joe's Pizza", lat=40.73, lng=-74.0),
        google_maps_import.ImportItem(name="Detail me", google_place_id="ChIJdetail"),
        google_maps_import.ImportItem(name="No coords"),
    ]
    out = google_maps_import.resolve_items(items, hint="New York")
    assert calls[0] == ("Joe's Pizza", (40.73, -74.0), 1500.0)   # biased, no hint appended
    assert calls[1] == ("No coords New York", None, 5000.0)        # hint appended
    assert out[1].name == "Detail me" and out[1].google_place_id == "ChIJdetail" and out[1].resolved
    assert all(i.resolved for i in out)


def test_resolve_items_without_api_key(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY")
    items = [google_maps_import.ImportItem(name="A", lat=1.0, lng=2.0), google_maps_import.ImportItem(name="B")]
    out = google_maps_import.resolve_items(items)
    assert out[0].resolved is True and out[1].resolved is False


# ---------------- endpoints ----------------

def test_preview_file_endpoint(client, auth_headers):
    res = client.post(
        "/imports/google-maps/preview/file?filename=NYC%20Eats.csv&hint=New%20York",
        content=TAKEOUT_CSV.encode(), headers={**auth_headers, "Content-Type": "application/octet-stream"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source"] == "takeout_csv" and body["list_name"] == "NYC Eats"
    assert len(body["items"]) == 2
    assert body["items"][0]["resolved"] is True
    assert body["items"][0]["google_place_id"]


def test_preview_file_rejects_empty(client, auth_headers):
    res = client.post("/imports/google-maps/preview/file?filename=x.csv", content=b"", headers=auth_headers)
    assert res.status_code == 400


def test_preview_link_endpoint(client, auth_headers, monkeypatch):
    from services.link_resolver import http as lr_http
    html = (
        '<html><head><meta property="og:title" content="Tokyo Faves - Google Maps"/></head><body>'
        '<script>"https://www.google.com/maps/place/Sushi+Saito/@35.66,139.73,17z/data=!4m2!3m1!1s0xabc:0xdef"'
        '"https://www.google.com/maps/place/Blue+Bottle+Shinjuku/@35.69,139.70,17z/data=!4m2!3m1!1s0x111:0x222"</script></body></html>'
    )
    monkeypatch.setattr(lr_http, "expand_url", lambda url: "https://www.google.com/maps/@/data=!4m3!11m2!2sLIST!3e3")
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, html))
    res = client.post("/imports/google-maps/preview", json={"url": "https://maps.app.goo.gl/abc"}, headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source"] == "shared_link" and body["list_name"] == "Tokyo Faves"
    assert [i["name"] for i in body["items"]] == ["Sushi Saito", "Blue Bottle Shinjuku"]
    assert body["items"][0]["lat"] == 35.66


def test_preview_link_rejects_non_maps(client, auth_headers):
    res = client.post("/imports/google-maps/preview", json={"url": "https://tiktok.com/@a/video/1"}, headers=auth_headers)
    assert res.status_code == 400


def _items():
    return [
        {"name": "Katz's Delicatessen", "lat": 40.72, "lng": -73.98, "google_place_id": "ChIJkatz", "category": "food",
         "source_platform": "google_maps", "source_url": "https://maps.google.com/?cid=1", "external_id": "gmaps:1"},
        {"name": "Joe's Pizza", "lat": 40.73, "lng": -74.0, "google_place_id": "ChIJjoes", "category": "food",
         "source_platform": "google_maps"},
        {"name": "Joe's Pizza dup", "google_place_id": "ChIJjoes"},  # dup inside the batch
    ]


def test_batch_into_bucket(client, auth_headers):
    res = client.post("/activities/batch", json={"target": {"bucket": True}, "items": _items()}, headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["trip"] is None
    assert len(body["created"]) == 2 and body["skipped_duplicates"] == 1
    assert all(a["trip_id"] is None for a in body["created"])
    assert body["created"][0]["source_platform"] == "google_maps"
    # positions continue sequentially
    assert [a["position"] for a in body["created"]] == [1, 2]

    bucket = client.get("/activities/bucket", headers=auth_headers).json()
    assert len(bucket) == 2

    # Re-importing the same list skips everything already there.
    res2 = client.post("/activities/batch", json={"target": {"bucket": True}, "items": _items()[:2]}, headers=auth_headers)
    assert res2.json()["skipped_duplicates"] == 2 and res2.json()["created"] == []


def test_batch_into_new_trip_generates_days(client, auth_headers):
    res = client.post("/activities/batch", json={
        "target": {"new_trip": {"name": "NYC", "destination": "New York, NY", "start_date": "2026-10-01", "end_date": "2026-10-03"}},
        "items": _items()[:2],
    }, headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    trip_id = body["trip"]["id"]
    assert body["trip"]["name"] == "NYC"
    assert all(a["trip_id"] == trip_id and a["day_id"] is None for a in body["created"])
    days = client.get(f"/days/trip/{trip_id}", headers=auth_headers).json()
    assert len(days) == 3


def test_batch_into_existing_trip_day(client, auth_headers, sample_trip, sample_days):
    res = client.post("/activities/batch", json={
        "target": {"trip_id": sample_trip["id"], "day_id": sample_days[1]["id"]},
        "items": _items()[:2],
    }, headers=auth_headers)
    assert res.status_code == 200, res.text
    assert all(a["day_id"] == sample_days[1]["id"] for a in res.json()["created"])


def test_batch_target_validation(client, auth_headers, sample_trip):
    bad = client.post("/activities/batch", json={"target": {"bucket": True, "trip_id": sample_trip["id"]}, "items": _items()[:1]}, headers=auth_headers)
    assert bad.status_code == 422
    none = client.post("/activities/batch", json={"target": {}, "items": _items()[:1]}, headers=auth_headers)
    assert none.status_code == 422
    wrong_day = client.post("/activities/batch", json={"target": {"trip_id": sample_trip["id"], "day_id": 99999}, "items": _items()[:1]}, headers=auth_headers)
    assert wrong_day.status_code == 400


def test_batch_other_users_trip_forbidden(client, auth_headers, second_user_headers, sample_trip):
    res = client.post("/activities/batch", json={"target": {"trip_id": sample_trip["id"]}, "items": _items()[:1]}, headers=second_user_headers)
    assert res.status_code == 403


def test_auth_refresh(client, auth_headers):
    res = client.post("/auth/refresh", headers=auth_headers)
    assert res.status_code == 200
    tok = res.json()["access_token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
    assert client.post("/auth/refresh").status_code == 401

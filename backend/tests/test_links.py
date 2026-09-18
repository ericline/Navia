"""Link resolver tests. All network is stubbed at services.link_resolver.http and
services.google_places so nothing touches TikTok / Instagram / Google / Anthropic."""
import json

import pytest

from services import google_places, link_resolver
from services.link_resolver import http as lr_http
from services.link_resolver import caption_extract


def _tiktok_html(desc, poi=None, video_id="7301234567890123456"):
    item = {
        "id": video_id,
        "desc": desc,
        "video": {"cover": "https://p16.tiktokcdn.com/cover.jpg"},
        "author": {"nickname": "foodie"},
    }
    if poi:
        item["poi"] = poi
    data = {"__DEFAULT_SCOPE__": {"webapp.video-detail": {"itemInfo": {"itemStruct": item}}}}
    return (
        "<html><head><title>x</title></head><body>"
        f'<script id="__UNIVERSAL_DATA_FOR_REBUILD__" type="application/json">{json.dumps(data)}</script>'
        "</body></html>"
    )


def _place(gid, name, lat=40.7, lng=-73.9, category="food"):
    return google_places.PlaceCandidate(
        google_place_id=gid, name=name, address=f"{name} St", lat=lat, lng=lng, category=category,
        rating=4.5, rating_count=100, photo_reference=f"places/{gid}/photos/1",
        google_maps_uri=f"https://maps.google.com/?cid={gid}",
    )


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    link_resolver.clear_cache()
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(lr_http, "expand_url", lambda url: url)
    yield
    link_resolver.clear_cache()


def test_detect_platform():
    assert link_resolver.detect_platform("https://www.tiktok.com/@a/video/1") == "tiktok"
    assert link_resolver.detect_platform("https://vm.tiktok.com/ZMabc/") == "tiktok"
    assert link_resolver.detect_platform("https://www.instagram.com/reel/Cabc123/") == "instagram"
    assert link_resolver.detect_platform("https://maps.app.goo.gl/abc") == "google_maps"
    assert link_resolver.detect_platform("https://example.com") == "unknown"


def test_tiktok_with_tagged_poi_gives_high_confidence(monkeypatch):
    html = _tiktok_html(
        "best ramen in the city 🍜 #nyceats",
        poi={"name": "Ichiran Times Square", "address": "152 W 49th St", "city": "New York", "lat": "40.7595", "lng": "-73.9840"},
    )
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, html))
    calls = []

    def fake_search(query, *, location_bias=None, radius_m=5000.0, max_results=5):
        calls.append((query, location_bias))
        return [_place("ChIJ_ichiran", "Ichiran Times Square", 40.7595, -73.984)]

    monkeypatch.setattr(google_places, "search_text", fake_search)
    r = link_resolver.resolve("https://www.tiktok.com/@foodie/video/7301234567890123456")
    m = r.metadata
    assert m.platform == "tiktok" and m.link_kind == "video"
    assert m.external_id == "7301234567890123456"
    assert m.caption.startswith("best ramen")
    assert m.thumbnail_url.endswith("cover.jpg")
    assert m.hint_city == "New York"
    assert r.candidates[0]["confidence"] == "high"
    assert r.candidates[0]["google_place_id"] == "ChIJ_ichiran"
    # POI search is biased to the tagged coordinates
    assert calls[0][1] == (40.7595, -73.984)


def test_tiktok_caption_only_uses_mentions(monkeypatch):
    html = _tiktok_html("📍 Joe's Pizza\nthe slice that changed my life #nycfood")
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, html))
    monkeypatch.setattr(
        google_places, "search_text",
        lambda query, **kw: [_place("ChIJ_joes", "Joe's Pizza")] if "Joe" in query else [],
    )
    r = link_resolver.resolve("https://www.tiktok.com/@foodie/video/7301234567890123456")
    assert r.metadata.poi is None
    assert "Joe's Pizza" in r.mentions
    assert r.metadata.hint_city == "New York"  # from #nycfood heuristic
    assert r.candidates[0]["confidence"] == "medium"
    assert r.candidates[0]["matched_text"] == "Joe's Pizza"


def test_haiku_path_is_used_when_available(monkeypatch):
    html = _tiktok_html("hidden gem omakase you NEED to try 🍣 (link in bio) #tokyo")
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, html))
    monkeypatch.setattr(
        caption_extract, "_haiku",
        lambda caption, title: ([caption_extract.PlaceMention("Sushi Saito", "Tokyo", "restaurant")], "Tokyo"),
    )
    seen = []

    def fake_search(query, **kw):
        seen.append(query)
        return [_place("ChIJ_saito", "Sushi Saito", 35.66, 139.73)]

    monkeypatch.setattr(google_places, "search_text", fake_search)
    r = link_resolver.resolve("https://www.tiktok.com/@a/video/1")
    assert seen == ["Sushi Saito restaurant Tokyo"]
    assert r.mentions == ["Sushi Saito"]
    assert r.candidates[0]["google_place_id"] == "ChIJ_saito"


def test_tiktok_fetch_failure_degrades(monkeypatch):
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, None))
    r = link_resolver.resolve("https://www.tiktok.com/@a/video/7300000000000000999")
    assert r.metadata.external_id == "7300000000000000999"
    assert r.candidates == []
    assert any("could not be fetched" in w for w in r.metadata.warnings)


def test_instagram_og_caption(monkeypatch):
    html = (
        '<html><head><meta property="og:title" content="foodie on Instagram" />'
        '<meta property="og:description" content="1,234 likes, 5 comments - foodie on March 1, 2026: &quot;📍 Blue Bottle Coffee in Williamsburg&quot;" />'
        '<meta property="og:image" content="https://scontent.cdninstagram.com/x.jpg" /></head></html>'
    )
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, html))
    monkeypatch.setattr(google_places, "search_text", lambda q, **kw: [_place("ChIJ_bb", "Blue Bottle Coffee", category="cafe")])
    r = link_resolver.resolve("https://www.instagram.com/reel/Cxyz12345/")
    assert r.metadata.platform == "instagram"
    assert r.metadata.external_id == "Cxyz12345"
    assert r.metadata.caption.startswith("📍 Blue Bottle")
    assert r.candidates[0]["category"] == "cafe"


def test_instagram_login_wall(monkeypatch):
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: ("https://www.instagram.com/accounts/login/", None))
    r = link_resolver.resolve("https://www.instagram.com/p/Cxyz12345/")
    assert r.candidates == []
    assert any("login" in w.lower() for w in r.metadata.warnings)


def test_google_maps_place_link(monkeypatch):
    url = "https://www.google.com/maps/place/Katz's+Delicatessen/@40.7223,-73.9874,17z/data=!3m1!4b1!4m6!3m5!1s0x89c2598a6e1c5c93:0x6e6b7b8c!8m2!3d40.7223!4d-73.9874!16s"
    monkeypatch.setattr(google_places, "search_text", lambda q, **kw: [_place("ChIJ_katz", "Katz's Delicatessen", 40.7223, -73.9874)])
    r = link_resolver.resolve(url)
    assert r.metadata.platform == "google_maps" and r.metadata.link_kind == "place"
    assert r.metadata.poi.name == "Katz's Delicatessen"
    assert r.metadata.poi.lat == 40.7223
    assert r.candidates[0]["confidence"] == "high"


def test_google_maps_place_with_query_place_id(monkeypatch):
    url = "https://www.google.com/maps/search/?api=1&query=40.7,-73.9&query_place_id=ChIJabcdefghijk"
    monkeypatch.setattr(google_places, "place_details", lambda pid: _place(pid, "Somewhere"))
    r = link_resolver.resolve(url)
    assert r.candidates[0]["google_place_id"] == "ChIJabcdefghijk"


def test_google_maps_list_link_routes_to_import():
    url = "https://www.google.com/maps/@/data=!4m3!11m2!2sAbCdEfGhIjKl!3e3"
    r = link_resolver.resolve(url)
    assert r.metadata.link_kind == "list"
    assert r.metadata.external_id == "AbCdEfGhIjKl"
    assert r.candidates == []


def test_resolve_endpoint(client, auth_headers, monkeypatch):
    html = _tiktok_html("📍 Joe's Pizza")
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, html))
    monkeypatch.setattr(google_places, "search_text", lambda q, **kw: [_place("ChIJ_joes", "Joe's Pizza")])
    res = client.post("/links/resolve", json={"url": "https://www.tiktok.com/@a/video/7301234567890123456"}, headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["platform"] == "tiktok"
    assert body["candidates"][0]["name"] == "Joe's Pizza"
    assert body["candidates"][0]["photo_reference"].startswith("places/")

    # Saving the candidate as a bucket item keeps provenance.
    c = body["candidates"][0]
    save = client.post("/activities/", json={
        "trip_id": None, "name": c["name"], "address": c["address"], "lat": c["lat"], "lng": c["lng"],
        "category": c["category"], "google_place_id": c["google_place_id"],
        "source_url": body["source_url"], "source_platform": body["platform"], "external_id": body["external_id"],
    }, headers=auth_headers)
    assert save.status_code == 200, save.text
    assert save.json()["source_platform"] == "tiktok"
    assert save.json()["external_id"] == "7301234567890123456"


def test_resolve_endpoint_rejects_non_http(client, auth_headers):
    res = client.post("/links/resolve", json={"url": "ftp://nope.example/x"}, headers=auth_headers)
    assert res.status_code == 400


def test_resolve_endpoint_requires_auth(client):
    res = client.post("/links/resolve", json={"url": "https://www.tiktok.com/@a/video/1"})
    assert res.status_code == 401


def test_resolve_endpoint_rate_limit(client, auth_headers, monkeypatch):
    from routers import links as links_router
    monkeypatch.setattr(links_router, "_RATE_LIMIT", 2)
    links_router._hits.clear()
    monkeypatch.setattr(lr_http, "fetch_html", lambda url: (url, None))
    for i in range(2):
        assert client.post("/links/resolve", json={"url": f"https://www.tiktok.com/@a/video/{i}"}, headers=auth_headers).status_code == 200
    assert client.post("/links/resolve", json={"url": "https://www.tiktok.com/@a/video/9"}, headers=auth_headers).status_code == 429
    links_router._hits.clear()

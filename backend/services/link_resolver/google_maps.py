"""Google Maps link parsing.

Handles three link shapes:
- Short links      https://maps.app.goo.gl/XXXX, https://goo.gl/maps/XXXX  (expanded first)
- Place links      /maps/place/<Name>/@lat,lng,17z/data=...!3d<lat>!4d<lng>...!1s<id>
                   /maps/search/?api=1&query=...&query_place_id=ChIJ...
                   /maps?q=<lat>,<lng>  or  ?cid=<decimal>
- List links       /maps/@/data=!4m3!11m2!2s<listid>!3e3  (shared "Saved" lists)

`classify(url)` tells the caller whether this is a single place (resolve now)
or a list (route to the importer). List scraping lives in
services/google_maps_import.py.
"""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

from . import http
from .common import LinkMetadata, PoiHint

_SHORT_HOSTS = ("maps.app.goo.gl", "goo.gl/maps", "g.co/kgs", "maps.google.com/?q=")
_AT_COORDS_RE = re.compile(r"/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)")
_D3D4_RE = re.compile(r"!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)")
_PLACE_NAME_RE = re.compile(r"/maps/place/([^/@?]+)")
_PLACE_ID_RE = re.compile(r"!1s(ChIJ[A-Za-z0-9_-]{10,}|E[A-Za-z0-9_-]{20,})")
_LIST_RE = re.compile(r"!11m2!2s([A-Za-z0-9_-]{6,})")
_Q_COORDS_RE = re.compile(r"^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$")


def is_google_maps(url: str) -> bool:
    u = url.lower()
    return any(h in u for h in _SHORT_HOSTS) or "google.com/maps" in u or "google.com/maps" in u or "maps.google." in u


def expand(url: str) -> str:
    if any(h in url.lower() for h in _SHORT_HOSTS):
        return http.expand_url(url)
    return url


def classify(url: str) -> str:
    """'list' | 'place' | 'unknown' for an already-expanded URL."""
    if _LIST_RE.search(url) or "/maps/placelists/" in url:
        return "list"
    if "/maps/place/" in url or "query_place_id=" in url or "cid=" in url or "/maps/search/" in url or "?q=" in url or "&q=" in url:
        return "place"
    if "/maps/@" in url:
        return "place"  # bare coordinates
    return "unknown"


def parse_place(url: str) -> Optional[PoiHint]:
    """Pull name / coords / place id out of a place URL. Never raises."""
    name = None
    m = _PLACE_NAME_RE.search(url)
    if m:
        name = unquote(m.group(1)).replace("+", " ").strip()

    lat = lng = None
    m = _D3D4_RE.search(url) or _AT_COORDS_RE.search(url)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))

    qs = parse_qs(urlparse(url).query)
    gpid = (qs.get("query_place_id") or [None])[0]
    if not gpid:
        m = _PLACE_ID_RE.search(url)
        gpid = m.group(1) if m else None

    q = (qs.get("query") or qs.get("q") or [None])[0]
    if q:
        cm = _Q_COORDS_RE.match(q)
        if cm and lat is None:
            lat, lng = float(cm.group(1)), float(cm.group(2))
        elif not name and not cm:
            name = unquote(q).replace("+", " ").strip()

    if not name and lat is None and not gpid:
        return None
    return PoiHint(name=name or "Pinned location", lat=lat, lng=lng, google_place_id=gpid)


def list_id(url: str) -> Optional[str]:
    m = _LIST_RE.search(url)
    return m.group(1) if m else None


def resolve(url: str) -> LinkMetadata:
    final = expand(url)
    kind = classify(final)
    meta = LinkMetadata(platform="google_maps", link_kind=kind if kind != "unknown" else "unknown", source_url=final)
    if kind == "list":
        meta.external_id = list_id(final)
        meta.title = "Google Maps list"
        return meta
    if kind == "place":
        poi = parse_place(final)
        if poi:
            meta.poi = poi
            meta.title = poi.name
            meta.external_id = poi.google_place_id
        else:
            meta.warnings.append("Couldn't read a place from this Google Maps link.")
    else:
        meta.warnings.append("Unrecognized Google Maps link.")
    return meta

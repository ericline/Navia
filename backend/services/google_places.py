"""Reusable Google Places API (New) client for user-facing place resolution.

Unlike data/ingest_places.py (which feeds the recommendation model and skips
hotels/transport), this module never filters categories: when a user saves a
place from a TikTok or a Google Maps list, we keep whatever they chose.

All functions degrade to empty results when GOOGLE_PLACES_API_KEY is unset or
the API errors, so callers can always fall back to name/coords-only saves.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, asdict
from typing import Optional

import httpx

from data.category_mapping import map_google_types_to_category

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

_FIELDS = [
    "id", "displayName", "formattedAddress", "location", "rating", "userRatingCount",
    "priceLevel", "types", "editorialSummary", "photos", "googleMapsUri",
]
_SEARCH_FIELD_MASK = ",".join(f"places.{f}" for f in _FIELDS)
_DETAILS_FIELD_MASK = ",".join(_FIELDS)

_PRICE_MAP = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


def _api_key() -> str:
    # Read lazily so tests / late dotenv loads can set it after import.
    return os.getenv("GOOGLE_PLACES_API_KEY", "")


def is_configured() -> bool:
    return bool(_api_key())


@dataclass
class PlaceCandidate:
    google_place_id: str
    name: str
    address: Optional[str]
    lat: float
    lng: float
    category: str
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    price_level: Optional[int] = None
    photo_reference: Optional[str] = None
    google_maps_uri: Optional[str] = None
    types: Optional[list[str]] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _parse(raw: dict) -> Optional[PlaceCandidate]:
    loc = raw.get("location") or {}
    lat, lng = loc.get("latitude"), loc.get("longitude")
    gid = raw.get("id")
    name = (raw.get("displayName") or {}).get("text")
    if lat is None or lng is None or not gid or not name:
        return None
    types = raw.get("types") or []
    photos = raw.get("photos") or []
    return PlaceCandidate(
        google_place_id=gid,
        name=name,
        address=raw.get("formattedAddress"),
        lat=float(lat),
        lng=float(lng),
        category=map_google_types_to_category(types),
        rating=raw.get("rating"),
        rating_count=raw.get("userRatingCount"),
        price_level=_PRICE_MAP.get(raw.get("priceLevel", "")),
        photo_reference=(photos[0].get("name") if photos else None),
        google_maps_uri=raw.get("googleMapsUri"),
        types=types,
    )


def search_text(
    query: str,
    *,
    location_bias: Optional[tuple[float, float]] = None,
    radius_m: float = 5000.0,
    max_results: int = 5,
) -> list[PlaceCandidate]:
    """Text Search. `location_bias` is (lat, lng); when given, results are biased
    (not restricted) to a circle around it."""
    query = (query or "").strip()
    if not query or not is_configured():
        if query:
            logger.warning("GOOGLE_PLACES_API_KEY not set — search_text(%r) skipped", query)
        return []
    body: dict = {"textQuery": query, "maxResultCount": max(1, min(max_results, 20))}
    if location_bias:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": location_bias[0], "longitude": location_bias[1]},
                "radius": float(radius_m),
            }
        }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _api_key(),
        "X-Goog-FieldMask": _SEARCH_FIELD_MASK,
    }
    try:
        resp = httpx.post(_SEARCH_URL, json=body, headers=headers, timeout=10.0)
        resp.raise_for_status()
        raws = resp.json().get("places", [])
    except Exception as e:  # noqa: BLE001
        logger.error("Places searchText failed for %r: %s", query, e)
        return []
    out = []
    for raw in raws:
        c = _parse(raw)
        if c:
            out.append(c)
    return out


def place_details(place_id: str) -> Optional[PlaceCandidate]:
    """Fetch one place by its Places (New) id, e.g. 'ChIJ...'."""
    if not place_id or not is_configured():
        return None
    headers = {"X-Goog-Api-Key": _api_key(), "X-Goog-FieldMask": _DETAILS_FIELD_MASK}
    try:
        resp = httpx.get(_DETAILS_URL.format(place_id=place_id), headers=headers, timeout=10.0)
        resp.raise_for_status()
        return _parse(resp.json())
    except Exception as e:  # noqa: BLE001
        logger.error("Places details failed for %r: %s", place_id, e)
        return None


def maps_link(lat: float | None, lng: float | None, google_place_id: str | None = None) -> str | None:
    """Universal 'open in Google Maps' URL for a place (works on web, iOS, Android)."""
    if lat is None or lng is None:
        return None
    url = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
    if google_place_id:
        url += f"&query_place_id={google_place_id}"
    return url

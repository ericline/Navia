"""Turn a shared link (TikTok / Instagram / Google Maps) into place candidates.

    result = resolve("https://www.tiktok.com/@x/video/123")
    result.metadata   -> LinkMetadata (platform, caption, poi, ...)
    result.candidates -> list[dict] matching schemas.PlaceCandidateOut

Resolution order:
1. Tagged POI (TikTok `poi`, or a Google Maps place link)   -> confidence "high"
2. Caption mentions (Haiku / heuristics) x Google Places     -> confidence "medium"
3. POI coords with no Places match                            -> confidence "low" (coords-only)
Every failure degrades gracefully; the response always includes whatever we know
so the client can pre-fill a manual search.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field

from services import google_places
from . import caption_extract, google_maps, instagram, tiktok
from .common import LinkMetadata, PoiHint

logger = logging.getLogger(__name__)

_MAX_PER_MENTION = 3
_MAX_CANDIDATES = 8


@dataclass
class ResolveResult:
    metadata: LinkMetadata
    mentions: list[str] = field(default_factory=list)
    candidates: list[dict] = field(default_factory=list)


def detect_platform(url: str) -> str:
    if tiktok.is_tiktok(url):
        return "tiktok"
    if instagram.is_instagram(url):
        return "instagram"
    if google_maps.is_google_maps(url):
        return "google_maps"
    return "unknown"


def _candidate(c: google_places.PlaceCandidate, confidence: str, matched: str | None) -> dict:
    d = c.to_dict()
    d.pop("types", None)
    d["confidence"] = confidence
    d["matched_text"] = matched
    return d


def _from_poi(poi: PoiHint) -> list[dict]:
    """Resolve an explicitly tagged place to a Google Place."""
    if poi.google_place_id:
        c = google_places.place_details(poi.google_place_id)
        if c:
            return [_candidate(c, "high", poi.name)]
    bias = (poi.lat, poi.lng) if poi.lat is not None and poi.lng is not None else None
    query = " ".join(b for b in [poi.name, poi.address] if b) if poi.name != "Pinned location" else ""
    results = google_places.search_text(query, location_bias=bias, max_results=2) if query else []
    if results:
        return [_candidate(c, "high" if i == 0 else "medium", poi.name) for i, c in enumerate(results)]
    if bias:
        # No Places hit (or no key) — still give the client the raw pin.
        return [{
            "google_place_id": None, "name": poi.name, "address": poi.address,
            "lat": poi.lat, "lng": poi.lng, "category": None, "rating": None, "rating_count": None,
            "price_level": None, "photo_reference": None, "google_maps_uri": None,
            "confidence": "low", "matched_text": poi.name,
        }]
    return []


def _from_mentions(meta: LinkMetadata) -> tuple[list[str], list[dict]]:
    mentions, city = caption_extract.extract_place_mentions(
        meta.caption, title=meta.title, hint_city=meta.hint_city
    )
    if city and not meta.hint_city:
        meta.hint_city = city
    bias = None
    if meta.poi and meta.poi.lat is not None:
        bias = (meta.poi.lat, meta.poi.lng)
    out: list[dict] = []
    for m in mentions:
        for i, c in enumerate(google_places.search_text(m.query(meta.hint_city), location_bias=bias, max_results=_MAX_PER_MENTION)):
            out.append(_candidate(c, "medium" if i == 0 else "low", m.name))
    return [m.name for m in mentions], out


def _dedupe(cands: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out = []
    for c in cands:
        key = c.get("google_place_id") or f"{c.get('name')}|{c.get('lat')}|{c.get('lng')}"
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out[:_MAX_CANDIDATES]


def resolve(url: str) -> ResolveResult:
    url = url.strip()
    platform = detect_platform(url)
    if platform == "tiktok":
        meta = tiktok.resolve(url)
    elif platform == "instagram":
        meta = instagram.resolve(url)
    elif platform == "google_maps":
        meta = google_maps.resolve(url)
    else:
        meta = LinkMetadata(platform="unknown", link_kind="unknown", source_url=url,
                            warnings=["Unsupported link. Paste a TikTok, Instagram, or Google Maps link."])
        return ResolveResult(metadata=meta)

    if meta.link_kind == "list":
        return ResolveResult(metadata=meta)  # client routes to /imports

    candidates: list[dict] = []
    mentions: list[str] = []
    if meta.poi:
        candidates.extend(_from_poi(meta.poi))
    if meta.caption and (not candidates or platform != "google_maps"):
        mentions, more = _from_mentions(meta)
        candidates.extend(more)
    if not candidates and not mentions and not meta.warnings:
        meta.warnings.append("No place found in this post. Search for it by name below.")
    if not google_places.is_configured():
        meta.warnings.append("Place lookup is not configured on the server (GOOGLE_PLACES_API_KEY).")
    return ResolveResult(metadata=meta, mentions=mentions, candidates=_dedupe(candidates))


# ---------------------------------------------------------------------------
# Tiny TTL cache: re-resolving the same link (retry, web + phone) shouldn't
# re-hit TikTok, Haiku and Places. Process-local; fine for Railway's replicas.
# ---------------------------------------------------------------------------
_CACHE_TTL = 3600.0
_CACHE_MAX = 500
_cache: dict[str, tuple[float, ResolveResult]] = {}
_cache_lock = threading.Lock()


def resolve_cached(url: str) -> ResolveResult:
    key = url.strip()
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < _CACHE_TTL:
            return hit[1]
    result = resolve(key)
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX:
            oldest = sorted(_cache.items(), key=lambda kv: kv[1][0])[: _CACHE_MAX // 5]
            for k, _ in oldest:
                _cache.pop(k, None)
        _cache[key] = (now, result)
    return result


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()

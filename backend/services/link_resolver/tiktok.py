"""TikTok video link → metadata (caption, tagged POI, cover, video id).

Strategy (best-effort, never raises):
1. Expand short links (vm.tiktok.com / vt.tiktok.com / t.tiktok.com).
2. GET the video page and parse the embedded JSON:
   - `__UNIVERSAL_DATA_FOR_REBUILD__` (current)  → __DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct
   - `SIGI_STATE` (older)                        → ItemModule[<id>]
   Fields used: desc, id, video.cover, poi{name,address,city,province,country,lat,lng}, textExtra.
3. Fall back to OpenGraph meta tags (og:title / og:description / og:image).
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional

from . import http
from .common import LinkMetadata, PoiHint, clean_text, parse_meta

_SHORT_HOSTS = ("vm.tiktok.com", "vt.tiktok.com", "t.tiktok.com", "m.tiktok.com", "tiktok.com/t/")
_VIDEO_ID_RE = re.compile(r"/video/(\d{6,})")
_PHOTO_ID_RE = re.compile(r"/photo/(\d{6,})")
_UNIVERSAL_RE = re.compile(
    r'<script[^>]+id="__UNIVERSAL_DATA_FOR_REBUILD__"[^>]*>(.*?)</script>', re.DOTALL
)
_SIGI_RE = re.compile(r'<script[^>]+id="SIGI_STATE"[^>]*>(.*?)</script>', re.DOTALL)


def is_tiktok(url: str) -> bool:
    return "tiktok.com" in url.lower()


def _video_id(url: str) -> Optional[str]:
    m = _VIDEO_ID_RE.search(url) or _PHOTO_ID_RE.search(url)
    return m.group(1) if m else None


def _extract_item(html: str) -> Optional[dict[str, Any]]:
    m = _UNIVERSAL_RE.search(html)
    if m:
        try:
            data = json.loads(m.group(1))
            scope = data.get("__DEFAULT_SCOPE__", {})
            item = (scope.get("webapp.video-detail") or {}).get("itemInfo", {}).get("itemStruct")
            if item:
                return item
        except Exception:  # noqa: BLE001
            pass
    m = _SIGI_RE.search(html)
    if m:
        try:
            data = json.loads(m.group(1))
            items = data.get("ItemModule") or {}
            if items:
                return next(iter(items.values()))
        except Exception:  # noqa: BLE001
            pass
    return None


def _poi_from_item(item: dict[str, Any]) -> Optional[PoiHint]:
    poi = item.get("poi") or {}
    name = poi.get("name")
    if not name:
        return None
    city = poi.get("city") or poi.get("cityCode") or None
    lat = poi.get("lat") or poi.get("latitude")
    lng = poi.get("lng") or poi.get("longitude")
    try:
        lat = float(lat) if lat not in (None, "") else None
        lng = float(lng) if lng not in (None, "") else None
    except (TypeError, ValueError):
        lat = lng = None
    addr_bits = [poi.get("address"), city, poi.get("province"), poi.get("country")]
    address = ", ".join(b for b in addr_bits if b) or None
    return PoiHint(name=name, address=address, city=city, lat=lat, lng=lng)


def resolve(url: str) -> LinkMetadata:
    meta = LinkMetadata(platform="tiktok", link_kind="video", source_url=url)

    final_url = url
    if any(h in url.lower() for h in _SHORT_HOSTS) and not _video_id(url):
        final_url = http.expand_url(url)
    meta.source_url = final_url
    meta.external_id = _video_id(final_url)

    fetched_url, html = http.fetch_html(final_url)
    if fetched_url:
        meta.source_url = fetched_url
        meta.external_id = meta.external_id or _video_id(fetched_url)
    if not html:
        meta.warnings.append("TikTok page could not be fetched; paste the place name manually.")
        return meta

    item = _extract_item(html)
    if item:
        meta.caption = clean_text(item.get("desc"))
        meta.external_id = meta.external_id or item.get("id")
        video = item.get("video") or {}
        meta.thumbnail_url = video.get("cover") or video.get("originCover") or None
        author = item.get("author") or {}
        nick = author.get("nickname") if isinstance(author, dict) else None
        meta.title = f"TikTok by {nick}" if nick else "TikTok"
        meta.poi = _poi_from_item(item)
        if meta.poi and meta.poi.city:
            meta.hint_city = meta.poi.city
        return meta

    og = parse_meta(html)
    meta.caption = clean_text(og.get("og:description") or og.get("description"))
    meta.title = clean_text(og.get("og:title")) or "TikTok"
    meta.thumbnail_url = og.get("og:image")
    if not meta.caption:
        meta.warnings.append("TikTok returned no caption (bot check); paste the place name manually.")
    return meta

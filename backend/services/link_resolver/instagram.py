"""Instagram post/reel link → metadata (caption, thumbnail, shortcode).

Instagram is login-walled for most server-side fetches and its official oEmbed
endpoint requires a Meta app token and returns no caption or location. So this
is strictly best-effort: OpenGraph tags when the page is served, otherwise the
caller gets an empty caption plus a warning and the user types the place name.
"""
from __future__ import annotations

import re
from typing import Optional

from . import http
from .common import LinkMetadata, clean_text, parse_meta

_SHORTCODE_RE = re.compile(r"instagram\.com/(?:[^/]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]{5,})")
# og:description looks like: `1,234 likes, 56 comments - handle on March 1, 2026: "caption text"`
_OG_CAPTION_RE = re.compile(r':\s*["“](?P<cap>.+)["”]\s*$', re.DOTALL)


def is_instagram(url: str) -> bool:
    return "instagram.com" in url.lower() or "instagr.am" in url.lower()


def _shortcode(url: str) -> Optional[str]:
    m = _SHORTCODE_RE.search(url)
    return m.group(1) if m else None


def resolve(url: str) -> LinkMetadata:
    meta = LinkMetadata(platform="instagram", link_kind="video", source_url=url)
    meta.external_id = _shortcode(url)

    fetched_url, html = http.fetch_html(url)
    if fetched_url:
        meta.source_url = fetched_url
        meta.external_id = meta.external_id or _shortcode(fetched_url)
    if not html or "login" in fetched_url.lower():
        meta.warnings.append(
            "Instagram didn't share the caption (login wall). Type the place name to search."
        )
        return meta

    og = parse_meta(html)
    desc = og.get("og:description") or og.get("description") or ""
    m = _OG_CAPTION_RE.search(desc)
    meta.caption = clean_text(m.group("cap") if m else desc)
    meta.title = clean_text(og.get("og:title")) or "Instagram"
    meta.thumbnail_url = og.get("og:image")
    if not meta.caption:
        meta.warnings.append(
            "Instagram didn't share the caption (login wall). Type the place name to search."
        )
    return meta

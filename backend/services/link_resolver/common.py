"""Small shared helpers: dataclasses + HTML meta parsing."""
from __future__ import annotations

import html as _html
import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PoiHint:
    """A place the creator explicitly tagged (TikTok 'poi') or a Maps place link."""
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    google_place_id: Optional[str] = None


@dataclass
class LinkMetadata:
    platform: str                       # tiktok|instagram|google_maps|unknown
    link_kind: str                      # video|place|list|unknown
    source_url: str
    external_id: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    thumbnail_url: Optional[str] = None
    hint_city: Optional[str] = None
    poi: Optional[PoiHint] = None
    warnings: list[str] = field(default_factory=list)


_META_RE = re.compile(
    r"<meta\s+(?:[^>]*?\s)?(?:property|name)=[\"'](?P<key>[^\"']+)[\"'][^>]*?content=[\"'](?P<val>[^\"']*)[\"']",
    re.IGNORECASE,
)
_META_RE_REV = re.compile(
    r"<meta\s+(?:[^>]*?\s)?content=[\"'](?P<val>[^\"']*)[\"'][^>]*?(?:property|name)=[\"'](?P<key>[^\"']+)[\"']",
    re.IGNORECASE,
)


def parse_meta(html: str) -> dict[str, str]:
    """Return {property/name: content} for <meta> tags (og:*, twitter:*, description)."""
    out: dict[str, str] = {}
    for rx in (_META_RE, _META_RE_REV):
        for m in rx.finditer(html or ""):
            key = m.group("key").strip().lower()
            if key not in out:
                out[key] = _html.unescape(m.group("val")).strip()
    return out


def clean_text(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    s = _html.unescape(s).replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    return s or None

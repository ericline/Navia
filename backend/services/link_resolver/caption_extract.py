"""Caption → place mentions.

Primary: Claude Haiku 4.5 with a strict JSON contract (gated by ANTHROPIC_API_KEY).
Fallback: cheap heuristics (📍 lines, "at <Name>", @handles, capitalized hashtags).

Output is a list of PlaceMention(name, city, kind). `kind` is a coarse hint used
only to pick a better Places query ("restaurant", "cafe", "bar", "attraction",
"hotel", "shop", "other").
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

HAIKU_MODEL = os.getenv("NAVIA_EXTRACT_MODEL", "claude-haiku-4-5-20251001")
_MAX_MENTIONS = 5


@dataclass
class PlaceMention:
    name: str
    city: Optional[str] = None
    kind: Optional[str] = None

    def query(self, hint_city: Optional[str] = None) -> str:
        bits = [self.name]
        if self.kind and self.kind not in ("other", None):
            bits.append(self.kind)
        city = self.city or hint_city
        if city:
            bits.append(city)
        return " ".join(bits)


_SYSTEM = (
    "You extract real-world places from social media captions for a travel app. "
    "Return ONLY a JSON object: {\"places\": [{\"name\": str, \"city\": str|null, \"kind\": str}], "
    "\"city\": str|null}. `kind` is one of restaurant, cafe, bar, attraction, hotel, shop, park, other. "
    "`city` at the top level is the city/area the video is about, if stated or strongly implied "
    "(e.g. from hashtags like #nyceats or #tokyo). Only include specific named venues, not generic "
    f"phrases. At most {_MAX_MENTIONS} places, most prominent first. Empty list if none."
)


def _haiku(caption: str, title: Optional[str]) -> Optional[tuple[list[PlaceMention], Optional[str]]]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic  # local import keeps startup light when unused
    except ImportError:
        logger.warning("anthropic SDK not installed; using heuristic caption parsing")
        return None
    user = f"Title: {title or ''}\nCaption:\n{caption[:4000]}"
    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=400,
            temperature=0,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(getattr(b, "text", "") for b in msg.content).strip()
        # Tolerate ```json fences
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
        data = json.loads(text)
    except Exception as e:  # noqa: BLE001
        logger.warning("Haiku caption extraction failed: %s", e)
        return None
    mentions: list[PlaceMention] = []
    for p in (data.get("places") or [])[:_MAX_MENTIONS]:
        name = (p.get("name") or "").strip()
        if name:
            mentions.append(PlaceMention(name=name, city=p.get("city") or None, kind=p.get("kind") or None))
    return mentions, (data.get("city") or None)


_PIN_LINE_RE = re.compile(r"📍\s*([^\n#@]{2,80})")
_AT_RE = re.compile(r"\bat\s+((?:[A-Z][\w'&.-]*\s?){1,5})")
_HANDLE_RE = re.compile(r"@([A-Za-z0-9_.]{3,30})")
_HASHTAG_RE = re.compile(r"#([A-Za-z][A-Za-z0-9_]{2,40})")
_CITY_TAGS = {
    "nyc": "New York", "newyork": "New York", "la": "Los Angeles", "losangeles": "Los Angeles",
    "sf": "San Francisco", "sanfrancisco": "San Francisco", "chicago": "Chicago", "boston": "Boston",
    "seattle": "Seattle", "miami": "Miami", "austin": "Austin", "london": "London", "paris": "Paris",
    "tokyo": "Tokyo", "kyoto": "Kyoto", "osaka": "Osaka", "seoul": "Seoul", "taipei": "Taipei",
    "bangkok": "Bangkok", "singapore": "Singapore", "hongkong": "Hong Kong", "rome": "Rome",
    "barcelona": "Barcelona", "lisbon": "Lisbon", "mexicocity": "Mexico City", "toronto": "Toronto",
    "vancouver": "Vancouver", "sydney": "Sydney", "melbourne": "Melbourne", "dubai": "Dubai",
}


def _heuristics(caption: str) -> tuple[list[PlaceMention], Optional[str]]:
    mentions: list[PlaceMention] = []
    seen: set[str] = set()

    def add(name: str, kind: Optional[str] = None):
        n = re.sub(r"\s+", " ", name).strip(" .,!-")
        if len(n) >= 3 and n.lower() not in seen:
            seen.add(n.lower())
            mentions.append(PlaceMention(name=n, kind=kind))

    for m in _PIN_LINE_RE.finditer(caption):
        add(m.group(1))
    for m in _AT_RE.finditer(caption):
        add(m.group(1))
    for m in _HANDLE_RE.finditer(caption):
        h = m.group(1)
        if any(k in h.lower() for k in ("eat", "food", "cafe", "bar", "kitchen", "pizza", "sushi", "ramen", "bakery", "grill", "taco")):
            add(h.replace("_", " ").replace(".", " "))

    city = None
    for m in _HASHTAG_RE.finditer(caption):
        tag = m.group(1).lower()
        for key, val in _CITY_TAGS.items():
            if tag == key or tag.startswith(key) and tag[len(key):] in ("eats", "food", "foodie", "travel", "trip", "guide", "restaurants"):
                city = city or val
    return mentions[:_MAX_MENTIONS], city


def extract_place_mentions(
    caption: Optional[str], *, title: Optional[str] = None, hint_city: Optional[str] = None
) -> tuple[list[PlaceMention], Optional[str]]:
    """Returns (mentions, inferred_city). Never raises."""
    caption = (caption or "").strip()
    if not caption:
        return [], hint_city
    result = _haiku(caption, title)
    if result is None:
        result = _heuristics(caption)
    mentions, city = result
    return mentions, (city or hint_city)

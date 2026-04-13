# backend/ai_client.py
"""Thin wrapper around the Anthropic SDK for activity recommendations.

If ANTHROPIC_API_KEY is not set or out of credits, 
the client gracefully degrades: 
is_enabled() returns False and recommend_activities() returns an empty list.

Includes an in-memory TTL cache to avoid redundant API calls when users
reopen the recommendation modal within a planning session.
"""
import hashlib
import json
import os
from time import time as _now
from typing import Any

from dotenv import load_dotenv

load_dotenv()

_client = None

# In-memory recommendation cache: key -> (timestamp, results)
_rec_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 600  # 10 minutes — covers a typical planning session


def _get_client():
    """Lazily initialize the Anthropic client (singleton). Returns None if no API key."""
    global _client
    if _client is None and os.getenv("ANTHROPIC_API_KEY"):
        try:
            from anthropic import Anthropic
            _client = Anthropic()
        except Exception:
            _client = None
    return _client


def is_enabled() -> bool:
    """Return True if the Anthropic API key is configured and client can be initialized."""
    return _get_client() is not None


def _extract_json_array(text: str) -> list[Any]:
    """Extract a JSON array from LLM output, stripping markdown fences if present."""
    text = text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        # remove first fence line
        parts = text.split("```")
        if len(parts) >= 2:
            inner = parts[1]
            if inner.lstrip().startswith("json"):
                inner = inner.lstrip()[4:]
            text = inner.strip()
    # Try to locate the first `[` and last `]`
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


def _cache_key(destination: str, trip_days: int, prefs: dict) -> str:
    """Build a stable hash key from recommendation parameters."""
    prefs_str = json.dumps(prefs, sort_keys=True)
    return hashlib.sha256(f"{destination}:{trip_days}:{prefs_str}".encode()).hexdigest()


def recommend_activities(
    destination: str,
    trip_days: int,
    prefs: dict,
) -> list[dict]:
    """Ask Claude Haiku to recommend ~10 activities matching prefs.

    Results are cached in memory for 10 minutes to avoid redundant API
    calls when users reopen the recommendation modal.
    """
    # Check cache first
    key = _cache_key(destination, trip_days, prefs)
    now = _now()
    if key in _rec_cache:
        cached_at, data = _rec_cache[key]
        if now - cached_at < _CACHE_TTL:
            return data

    client = _get_client()
    if not client:
        return []

    prompt = f"""Recommend 10 diverse activities for a {trip_days}-day trip to {destination}.

Preferences: likes={prefs.get('likes', [])}, dislikes={prefs.get('dislikes', [])}, budget/activity=${prefs.get('max_activity_budget', 100)}, walking={prefs.get('max_walking_km', 2)}km, pace={prefs.get('pace', 'balanced')}, dietary={prefs.get('dietary', [])}

Return ONLY a JSON array. Each item: name (string), category (food|cafe|bar|museum|park|beach|shopping|nightlife|worship|wellness|transport|hotel|entertainment|landmark|other), address (real address or neighborhood), est_duration_minutes (int), cost_estimate (float, USD), energy_level (low|medium|high), must_do (bool), notes (one sentence tied to preferences)."""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        data = _extract_json_array(text)
        result = [item for item in data if isinstance(item, dict) and item.get("name")]
        _rec_cache[key] = (now, result)
        return result
    except Exception as exc:
        print(f"[ai_client] recommendation failed: {exc}")
        return []

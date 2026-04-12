# backend/ai_client.py
"""Thin wrapper around the Anthropic SDK for activity recommendations.

If ANTHROPIC_API_KEY is not set, the client gracefully degrades: is_enabled()
returns False and recommend_activities() returns an empty list.
"""
import json
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client():
    global _client
    if _client is None and os.getenv("ANTHROPIC_API_KEY"):
        try:
            from anthropic import Anthropic
            _client = Anthropic()
        except Exception:
            _client = None
    return _client


def is_enabled() -> bool:
    return _get_client() is not None


def _extract_json_array(text: str) -> list[Any]:
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


def recommend_activities(
    destination: str,
    trip_days: int,
    prefs: dict,
) -> list[dict]:
    """Ask Claude Haiku to recommend ~10 activities matching prefs."""
    client = _get_client()
    if not client:
        return []

    prompt = f"""You are a travel planner. Recommend 10 diverse activities for a {trip_days}-day trip to {destination}.

User preferences:
- Likes: {prefs.get('likes', [])}
- Dislikes (avoid): {prefs.get('dislikes', [])}
- Max budget per activity: ${prefs.get('max_activity_budget', 100)}
- Max walking distance per stop: {prefs.get('max_walking_km', 2)} km
- Pace: {prefs.get('pace', 'balanced')}
- Dietary: {prefs.get('dietary', [])}

Return ONLY a JSON array (no prose) where each item has these fields:
- name (string)
- category (one of: food, cafe, bar, museum, park, beach, shopping, nightlife, worship, wellness, transport, hotel, entertainment, landmark, other)
- address (specific real address if known, else neighborhood)
- est_duration_minutes (int)
- cost_estimate (float, in USD)
- energy_level (low|medium|high)
- must_do (boolean; true for iconic, not-to-be-missed spots)
- notes (one-sentence rationale tied to their preferences)
"""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        data = _extract_json_array(text)
        # Sanity filter: only keep dicts with a name
        return [item for item in data if isinstance(item, dict) and item.get("name")]
    except Exception as exc:
        print(f"[ai_client] recommendation failed: {exc}")
        return []

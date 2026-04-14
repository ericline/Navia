"""Canonicalize destination strings to match the frontend's "City, ST" format.

Mirrors `formatDestination()` in `frontend/lib/utils.ts` so that any destination
written by the backend (trip creation, place ingest) or queried by the backend
(place count, vector search) uses the same canonical key the frontend produces.
Keep this in sync with the frontend map.
"""
from __future__ import annotations

US_STATE_ABBREVIATIONS: dict[str, str] = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
}

US_COUNTRY_SUFFIXES: list[str] = [
    ", United States of America",
    ", United States",
    ", USA",
    ", US",
]


def normalize_destination(destination: str | None) -> str:
    if not destination:
        return ""
    result = destination.strip()
    for suffix in US_COUNTRY_SUFFIXES:
        if result.endswith(suffix):
            result = result[: -len(suffix)].strip()
            break
    parts = [p.strip() for p in result.split(",")]
    if len(parts) >= 2:
        last = parts[-1]
        abbr = US_STATE_ABBREVIATIONS.get(last)
        if abbr:
            parts[-1] = abbr
            return ", ".join(parts)
    return result

"""Google Places API (New) ingestion pipeline.

Pulls real places for a destination, maps categories, computes embeddings,
and upserts into the places table.  Can be run as a CLI script or called
from the recommendation endpoint for on-demand ingestion.

Usage:
    python -m data.ingest_places "Tokyo, Japan"
    python -m data.ingest_places "Paris, France" --categories food,museum,landmark
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time

from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlalchemy.orm import Session

import models
from data.category_mapping import (
    CATEGORY_SEARCH_TERMS,
    CUISINE_HINTS,
    SKIP_CATEGORIES,
    get_neighborhoods,
    map_google_types_to_category,
)

logger = logging.getLogger(__name__)

_GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.location,places.rating,places.userRatingCount,"
    "places.priceLevel,places.types,places.editorialSummary,"
    "places.photos,places.googleMapsUri"
)

# Google priceLevel enum → integer
_PRICE_MAP = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


def _get_encoder():
    """Lazy-load the sentence-transformer encoder (avoids import at module level)."""
    from ml.encoder import get_encoder
    return get_encoder()


def _search_places(query: str, max_results: int = 20) -> list[dict]:
    """Call Google Places Text Search API (New) and return raw results."""
    if not _GOOGLE_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not set — skipping Places API call")
        return []

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _GOOGLE_API_KEY,
        "X-Goog-FieldMask": _FIELD_MASK,
    }
    body = {"textQuery": query, "maxResultCount": min(max_results, 20)}

    try:
        resp = httpx.post(_PLACES_SEARCH_URL, json=body, headers=headers, timeout=10.0)
        resp.raise_for_status()
        return resp.json().get("places", [])
    except Exception as e:
        logger.error("Places API search failed for %r: %s", query, e)
        return []


def _parse_place(raw: dict, destination: str) -> dict | None:
    """Parse a raw Google Places response into a dict ready for DB insertion."""
    location = raw.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")
    if lat is None or lng is None:
        return None

    google_id = raw.get("id", "")
    if not google_id:
        return None

    name = raw.get("displayName", {}).get("text", "")
    if not name:
        return None

    types = raw.get("types", [])
    category = map_google_types_to_category(types)

    # Skip categories we don't recommend
    if category in SKIP_CATEGORIES:
        return None

    price_level_str = raw.get("priceLevel", "")
    price_level = _PRICE_MAP.get(price_level_str)

    description = raw.get("editorialSummary", {}).get("text", "")

    # Extract first photo reference
    photos = raw.get("photos", [])
    photo_reference = photos[0].get("name", "") if photos else None

    return {
        "google_place_id": google_id,
        "name": name,
        "destination": destination,
        "category": category,
        "address": raw.get("formattedAddress", ""),
        "lat": lat,
        "lng": lng,
        "rating": raw.get("rating"),
        "rating_count": raw.get("userRatingCount"),
        "price_level": price_level,
        "description": description,
        "photo_reference": photo_reference,
        "types_raw": json.dumps(types),
    }


def _build_embedding_text(place: dict) -> str:
    """Build text for embedding from place attributes."""
    parts = [place["name"]]
    if place.get("category"):
        parts.append(place["category"])
    if place.get("description"):
        parts.append(place["description"])
    if place.get("address"):
        parts.append(place["address"])
    price_labels = {0: "free", 1: "cheap", 2: "moderate", 3: "expensive", 4: "very expensive"}
    if place.get("price_level") is not None:
        parts.append(f"price: {price_labels.get(place['price_level'], 'unknown')}")
    return ". ".join(parts)


def _build_queries(destination: str, cats: list[str], depth: str) -> list[tuple[str, str]]:
    """Build (category, query) tuples for an ingestion run."""
    queries: list[tuple[str, str]] = []
    for cat in cats:
        term = CATEGORY_SEARCH_TERMS.get(cat, cat)
        queries.append((cat, f"{term} in {destination}"))

    if depth == "deep":
        neighborhoods = get_neighborhoods(destination)
        for hood in neighborhoods:
            for cat in cats:
                if cat == "food":
                    continue  # food gets cuisine-specific sub-queries below
                term = CATEGORY_SEARCH_TERMS.get(cat, cat)
                queries.append((cat, f"{term} in {hood}, {destination}"))
            for cuisine in CUISINE_HINTS:
                queries.append(("food", f"{cuisine} in {hood}, {destination}"))
    return queries


def ingest_destination(
    destination: str,
    db: Session,
    categories: list[str] | None = None,
    depth: str = "shallow",
) -> int:
    """Ingest places for a destination from Google Places API.

    Args:
        destination: e.g. "Tokyo, Japan"
        db: SQLAlchemy session
        categories: subset of CATEGORY_SEARCH_TERMS keys to ingest (default: all)
        depth: "shallow" (one query per category) or "deep" (adds neighborhood
               and cuisine sub-queries for supported destinations).

    Returns:
        Number of places upserted.
    """
    if not _GOOGLE_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not set — cannot ingest places")
        return 0

    encoder = _get_encoder()
    cats = categories or [c for c in CATEGORY_SEARCH_TERMS if c not in SKIP_CATEGORIES]
    total = 0
    seen_ids: set[str] = set()  # track google_place_ids within this run to avoid duplicates

    queries = _build_queries(destination, cats, depth)
    logger.info("Ingesting %s (depth=%s, %d queries)", destination, depth, len(queries))

    for _cat, query in queries:
        logger.info("Searching: %s", query)

        raw_places = _search_places(query, max_results=20)

        for raw in raw_places:
            parsed = _parse_place(raw, destination)
            if not parsed:
                continue

            gid = parsed["google_place_id"]

            # Skip if already processed in this run
            if gid in seen_ids:
                continue
            seen_ids.add(gid)

            # Check for existing place in DB (upsert)
            existing = (
                db.query(models.Place)
                .filter(models.Place.google_place_id == gid)
                .first()
            )

            # Compute embedding
            emb_text = _build_embedding_text(parsed)
            embedding = encoder.encode(emb_text).tolist()
            parsed["embedding"] = json.dumps(embedding)

            if existing:
                for key, val in parsed.items():
                    setattr(existing, key, val)
            else:
                db.add(models.Place(**parsed))
                total += 1

        # Respect rate limits — brief pause between category searches
        time.sleep(0.2)

    db.commit()
    logger.info("Ingested %d new places for %s", total, destination)
    return total


def get_place_count(db: Session, destination: str) -> int:
    """Return the number of places in the DB for a destination."""
    return db.query(models.Place).filter(models.Place.destination == destination).count()


# CLI entry point
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        print("Usage: python -m data.ingest_places 'Destination'")
        sys.exit(1)

    dest = sys.argv[1]
    cats = None
    depth = "shallow"
    for arg in sys.argv[2:]:
        if arg.startswith("--categories="):
            cats = arg.split("=", 1)[1].split(",")
        elif arg.startswith("--depth="):
            depth = arg.split("=", 1)[1]
            if depth not in ("shallow", "deep"):
                print(f"Invalid --depth={depth}; must be 'shallow' or 'deep'")
                sys.exit(1)

    from database import SessionLocal
    session = SessionLocal()
    try:
        count = ingest_destination(dest, session, categories=cats, depth=depth)
        print(f"Done — ingested {count} places for {dest} (depth={depth})")
    finally:
        session.close()

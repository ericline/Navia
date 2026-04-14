"""Sentence-transformer encoder and vector search utilities.

Uses all-MiniLM-L6-v2 (384-dim, 80MB) for encoding place descriptions and
user preference queries into the same embedding space.  Vector search uses
in-memory cosine similarity on the places table — works on both SQLite and
PostgreSQL without requiring pgvector.  For production scale (>100K places),
migrate to pgvector with an ivfflat index.

Why all-MiniLM-L6-v2:
- Runs locally — no API dependency or per-request cost
- 384 dims — small index, fast cosine similarity
- 14K sentences/sec — encodes all places for a destination in <25ms
- 80MB — fits easily in server memory
"""
from __future__ import annotations

import json
import logging

import numpy as np
from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)

_encoder = None


def get_encoder():
    """Lazy-load the sentence-transformer model (singleton)."""
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformer model all-MiniLM-L6-v2...")
        _encoder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Encoder loaded.")
    return _encoder


def encode_text(text: str) -> np.ndarray:
    """Encode a single text string into a 384-d embedding vector."""
    encoder = get_encoder()
    return encoder.encode(text, normalize_embeddings=True)


def build_query_embedding(destination: str, prefs, context: dict | None = None) -> np.ndarray:
    """Encode user preferences into the same embedding space as places.

    Args:
        destination: trip destination string
        prefs: UserPreferences schema (has likes, dislikes, max_activity_budget,
               pace, dietary, and optionally travel_style/group_type/interests)
        context: optional dict `{"has": [...], "avoid": [...]}` with names of
                 already-planned and previously-skipped items for the trip.
                 Purely additive — nudges the retrieval toward complementary
                 items and away from things the user rejected.

    Returns:
        384-d normalized numpy array.
    """
    likes = ", ".join(prefs.likes) if prefs.likes else "anything"
    dislikes = ", ".join(prefs.dislikes) if prefs.dislikes else "nothing in particular"
    dietary = ", ".join(prefs.dietary) if prefs.dietary else "none"
    interests = ", ".join(getattr(prefs, "interests", []) or []) or "none"
    travel_style = getattr(prefs, "travel_style", None) or "any style"
    group_type = getattr(prefs, "group_type", None) or "any group"

    query = (
        f"Activities in {destination} for a {group_type} traveler with a {travel_style} style. "
        f"Likes: {likes}. Dislikes: {dislikes}. "
        f"Specific interests: {interests}. "
        f"Budget per activity: ${prefs.max_activity_budget}. "
        f"Pace: {prefs.pace}. "
        f"Dietary needs: {dietary}."
    )
    if context:
        has = context.get("has") or []
        avoid = context.get("avoid") or []
        if has:
            query += f" Already planned: {', '.join(has[:20])}."
        if avoid:
            query += f" Not interested in: {', '.join(avoid[:20])}."
    return encode_text(query)


def _deserialize_embedding(emb_json: str | None) -> np.ndarray | None:
    """Deserialize a JSON-encoded embedding string to numpy array."""
    if not emb_json:
        return None
    try:
        return np.array(json.loads(emb_json), dtype=np.float32)
    except (json.JSONDecodeError, ValueError):
        return None


def vector_search(
    db: Session,
    destination: str,
    query_embedding: np.ndarray,
    limit: int = 50,
) -> list[tuple[models.Place, float]]:
    """Retrieve the top-K most similar places for a destination.

    On Postgres, delegates to pgvector's ivfflat cosine-distance index for an
    O(log N) indexed lookup. On SQLite (and as a safety fallback), uses an
    in-memory cosine loop over JSON-serialized embeddings.

    Returns list of (Place, similarity_score) sorted by descending similarity.
    """
    if db.bind.dialect.name == "postgresql":
        return _vector_search_pg(db, destination, query_embedding, limit)
    return _vector_search_inmemory(db, destination, query_embedding, limit)


def _vector_search_pg(
    db: Session,
    destination: str,
    query_embedding: np.ndarray,
    limit: int,
) -> list[tuple[models.Place, float]]:
    """pgvector fast path: SQL-level cosine distance ordering via ivfflat index."""
    from sqlalchemy import select

    q = query_embedding.tolist()
    distance = models.Place.embedding_vec.cosine_distance(q).label("dist")
    stmt = (
        select(models.Place, distance)
        .where(models.Place.destination == destination)
        .where(models.Place.embedding_vec.isnot(None))
        .order_by(distance)
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    # cosine_distance = 1 - cosine_similarity; convert back to preserve contract.
    return [(place, 1.0 - float(dist)) for place, dist in rows]


def _vector_search_inmemory(
    db: Session,
    destination: str,
    query_embedding: np.ndarray,
    limit: int,
) -> list[tuple[models.Place, float]]:
    """SQLite / fallback path: load all rows, compute cosine in numpy."""
    places = (
        db.query(models.Place)
        .filter(models.Place.destination == destination)
        .filter(models.Place.embedding.isnot(None))
        .all()
    )

    if not places:
        return []

    scored: list[tuple[models.Place, float]] = []
    query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)

    for place in places:
        emb = _deserialize_embedding(place.embedding)
        if emb is None:
            continue
        emb_norm = emb / (np.linalg.norm(emb) + 1e-10)
        similarity = float(np.dot(query_norm, emb_norm))
        scored.append((place, similarity))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]

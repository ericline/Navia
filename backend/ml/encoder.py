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


def build_query_embedding(destination: str, prefs) -> np.ndarray:
    """Encode user preferences into the same embedding space as places.

    Args:
        destination: trip destination string
        prefs: UserPreferences schema (has likes, dislikes, max_activity_budget,
               pace, dietary attributes)

    Returns:
        384-d normalized numpy array.
    """
    likes = ", ".join(prefs.likes) if prefs.likes else "anything"
    dislikes = ", ".join(prefs.dislikes) if prefs.dislikes else "nothing in particular"
    dietary = ", ".join(prefs.dietary) if prefs.dietary else "none"

    query = (
        f"Activities in {destination} for someone who likes {likes}. "
        f"Dislikes: {dislikes}. "
        f"Budget per activity: ${prefs.max_activity_budget}. "
        f"Pace: {prefs.pace}. "
        f"Dietary needs: {dietary}."
    )
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

    Uses in-memory cosine similarity — works on any database backend.
    Returns list of (Place, similarity_score) tuples sorted by descending
    similarity.

    Args:
        db: SQLAlchemy session
        destination: filter places to this destination
        query_embedding: 384-d query vector (normalized)
        limit: max results to return

    Returns:
        List of (Place, cosine_similarity) tuples.
    """
    places = (
        db.query(models.Place)
        .filter(models.Place.destination == destination)
        .filter(models.Place.embedding.isnot(None))
        .all()
    )

    if not places:
        return []

    # Batch deserialize embeddings and compute cosine similarities
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

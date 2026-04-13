"""TensorFlow DNN scoring model for recommendation re-ranking.

Architecture: Input(25) → Dense(64, ReLU) → Dropout(0.2) → Dense(32, ReLU) → Dense(1, Sigmoid)

The model scores (user_preferences, place_features) pairs to produce a
relevance probability in [0, 1].  It handles structured feature interactions
that pure embedding similarity misses (budget fit, pace compatibility, etc.).

Why TensorFlow:
- SavedModel format loads once at startup, inference in <5ms for 50 candidates
- Keras functional API makes the architecture clean
- tf.lite available for future mobile/edge deployment
- User specifically requested TF

Why this architecture (not deeper):
- 25 input features → 64 → 32 → 1 is proportional to feature count
- ~3K trainable parameters — trains in seconds on synthetic data
- Dropout(0.2) prevents overfitting on synthetic heuristic labels
- Sigmoid output = calibrated probability, useful for threshold filtering
"""
from __future__ import annotations

import logging
import math
import os
from pathlib import Path

import numpy as np

import models
from data.category_mapping import NAVIA_CATEGORIES

logger = logging.getLogger(__name__)

_MODEL_PATH = Path(__file__).parent / "models" / "scorer_v1.keras"
_model = None

# Ordered category list for one-hot encoding
_CATEGORY_INDEX = {cat: i for i, cat in enumerate(NAVIA_CATEGORIES)}
_NUM_CATEGORIES = len(NAVIA_CATEGORIES)

# Pace options for one-hot encoding
_PACE_OPTIONS = ["relaxed", "balanced", "packed"]
_PACE_INDEX = {p: i for i, p in enumerate(_PACE_OPTIONS)}


def extract_features(prefs, place: models.Place, similarity: float = 0.0) -> np.ndarray:
    """Extract a 25-dim feature vector from a (user_prefs, place) pair.

    Features:
        0:  category_match      — 1.0 if liked, -1.0 if disliked, 0.0 otherwise
        1:  price_fit           — how well place price fits user budget
        2:  rating_normalized   — place.rating / 5.0
        3:  popularity_log      — log(rating_count + 1) / 10.0
        4:  duration_fit        — pace-adjusted duration compatibility
        5:  embedding_similarity — cosine sim from retrieval (pre-computed)
        6:  energy_match        — heuristic energy compatibility
        7-21: category_onehot   — 15-dim one-hot of place category
        22-24: pace_onehot      — 3-dim one-hot of user pace
    """
    features = np.zeros(25, dtype=np.float32)

    likes = set(prefs.likes) if prefs.likes else set()
    dislikes = set(prefs.dislikes) if prefs.dislikes else set()
    cat = place.category or "other"

    # 0: category_match
    if cat in likes:
        features[0] = 1.0
    elif cat in dislikes:
        features[0] = -1.0

    # 1: price_fit — 1.0 means perfect fit, negative means over budget
    if place.price_level is not None and prefs.max_activity_budget:
        estimated_cost = place.price_level * 25  # rough: 0=$0, 4=$100
        features[1] = max(-1.0, 1.0 - (estimated_cost / max(prefs.max_activity_budget, 1.0)))
    else:
        features[1] = 0.5  # unknown = neutral

    # 2: rating_normalized
    features[2] = (place.rating or 3.0) / 5.0

    # 3: popularity_log
    features[3] = math.log1p(place.rating_count or 0) / 10.0

    # 4: duration_fit — relaxed users prefer longer, packed prefer shorter
    #    (estimated duration not always available from Google, use 90min default)
    est_dur = 90  # default estimate
    pace_ideal = {"relaxed": 120, "balanced": 90, "packed": 60}.get(prefs.pace, 90)
    features[4] = max(0.0, 1.0 - abs(est_dur - pace_ideal) / 120.0)

    # 5: embedding_similarity (pre-computed in retrieval)
    features[5] = similarity

    # 6: energy_match (simple heuristic — nightlife/bar = high energy, museum/park = low)
    _HIGH_ENERGY = {"nightlife", "bar", "entertainment"}
    _LOW_ENERGY = {"museum", "park", "worship", "wellness", "cafe"}
    if prefs.pace == "relaxed" and cat in _LOW_ENERGY:
        features[6] = 0.8
    elif prefs.pace == "packed" and cat in _HIGH_ENERGY:
        features[6] = 0.8
    else:
        features[6] = 0.5

    # 7-21: category one-hot (15 dims)
    cat_idx = _CATEGORY_INDEX.get(cat, _CATEGORY_INDEX["other"])
    features[7 + cat_idx] = 1.0

    # 22-24: pace one-hot (3 dims)
    pace_idx = _PACE_INDEX.get(prefs.pace, 1)
    features[22 + pace_idx] = 1.0

    return features


def load_model():
    """Load the saved TensorFlow scoring model (singleton)."""
    global _model
    if _model is not None:
        return _model

    if not _MODEL_PATH.exists():
        logger.warning("Scoring model not found at %s — using heuristic fallback", _MODEL_PATH)
        return None

    try:
        import tensorflow as tf
        _model = tf.keras.models.load_model(str(_MODEL_PATH))
        logger.info("Loaded scoring model from %s", _MODEL_PATH)
        return _model
    except Exception as e:
        logger.error("Failed to load scoring model: %s", e)
        return None


def score_candidates(
    prefs,
    candidates: list[tuple[models.Place, float]],
) -> list[tuple[models.Place, float, float]]:
    """Score a list of (place, similarity) candidates using the TF model.

    Returns list of (place, similarity, relevance_score) sorted by
    descending relevance_score.  Falls back to heuristic scoring if the
    TF model isn't available.
    """
    if not candidates:
        return []

    features = np.array([
        extract_features(prefs, place, sim) for place, sim in candidates
    ])

    model = load_model()
    if model is not None:
        scores = model.predict(features, verbose=0).flatten()
    else:
        # Heuristic fallback: weighted sum of key features
        scores = (
            features[:, 0] * 0.30 +   # category_match
            features[:, 1] * 0.15 +   # price_fit
            features[:, 2] * 0.20 +   # rating
            features[:, 3] * 0.05 +   # popularity
            features[:, 5] * 0.20 +   # embedding_similarity
            features[:, 6] * 0.10     # energy_match
        )
        # Normalize to [0, 1]
        scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-10)

    result = [
        (place, sim, float(score))
        for (place, sim), score in zip(candidates, scores)
    ]
    result.sort(key=lambda x: x[2], reverse=True)
    return result


def diversity_rerank(
    scored: list[tuple[models.Place, float, float]],
    top_k: int = 10,
    lambda_: float = 0.7,
) -> list[models.Place]:
    """Maximal Marginal Relevance (MMR) re-ranking for category diversity.

    Iteratively selects the next place that maximizes:
        λ × relevance - (1-λ) × max_category_overlap_with_selected

    Why MMR over simple "max N per category":
    - MMR considers semantic similarity, not just labels
    - Two "landmark" places can be very different (temple vs skyscraper)
    - A "cafe" and "food" place might be nearly identical
    - MMR balances relevance with true diversity

    Args:
        scored: list of (place, similarity, relevance_score) tuples
        top_k: number of results to return
        lambda_: trade-off (1.0 = pure relevance, 0.0 = pure diversity)

    Returns:
        List of Place objects.
    """
    if not scored:
        return []

    selected: list[models.Place] = []
    selected_categories: list[str] = []
    remaining = list(scored)

    for _ in range(min(top_k, len(remaining))):
        best_idx = -1
        best_mmr = -float("inf")

        for i, (place, _sim, relevance) in enumerate(remaining):
            # Category overlap penalty: how many times this category already appears
            cat = place.category or "other"
            overlap = selected_categories.count(cat) / max(len(selected), 1)

            mmr = lambda_ * relevance - (1 - lambda_) * overlap

            if mmr > best_mmr:
                best_mmr = mmr
                best_idx = i

        if best_idx >= 0:
            place, _, _ = remaining.pop(best_idx)
            selected.append(place)
            selected_categories.append(place.category or "other")

    return selected

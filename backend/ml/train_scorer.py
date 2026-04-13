"""Training script for the recommendation scoring model.

Generates synthetic (user_profile, place, relevance_label) training pairs
using heuristic scoring, then trains a TensorFlow DNN.  Run from the
backend directory:

    python -m ml.train_scorer

The trained model is saved to ml/models/scorer_v1.keras in native Keras format.

Synthetic data strategy:
- Generate 2000 random user profiles with realistic preference distributions
- For each profile, score all places in the DB using hand-crafted heuristics
- The model learns to approximate (and generalize beyond) these heuristics
- Once real feedback data is available, retrain.py mixes real + synthetic data

Why synthetic data works:
1. Heuristics capture common-sense preferences (budget-conscious → cheap places)
2. The DNN discovers feature interactions the heuristic misses
3. 2000 profiles × 300 places = 600K pairs — plenty for a 3K-parameter model
"""
from __future__ import annotations

import json
import logging
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "models" / "scorer_v1.keras"

# Possible values for synthetic profile generation
_CATEGORY_POOL = [
    "food", "cafe", "bar", "museum", "park", "beach", "shopping",
    "nightlife", "worship", "wellness", "entertainment", "landmark",
]
_PACE_OPTIONS = ["relaxed", "balanced", "packed"]
_DIETARY_OPTIONS = ["vegetarian", "vegan", "halal", "kosher", "gluten-free", "none"]


@dataclass
class SyntheticPrefs:
    """Mimics the real UserPreferences schema for training data generation."""
    likes: list[str] = field(default_factory=list)
    dislikes: list[str] = field(default_factory=list)
    max_activity_budget: float = 100.0
    pace: str = "balanced"
    dietary: list[str] = field(default_factory=list)
    max_walking_km: float = 2.0


@dataclass
class SyntheticPlace:
    """Minimal place representation for feature extraction during training."""
    category: str = "other"
    price_level: int | None = None
    rating: float | None = None
    rating_count: int | None = None


def random_user_profile() -> SyntheticPrefs:
    """Generate a random but realistic user preference profile."""
    n_likes = random.randint(1, 4)
    n_dislikes = random.randint(0, 2)

    all_cats = random.sample(_CATEGORY_POOL, min(n_likes + n_dislikes, len(_CATEGORY_POOL)))
    likes = all_cats[:n_likes]
    dislikes = all_cats[n_likes:n_likes + n_dislikes]

    return SyntheticPrefs(
        likes=likes,
        dislikes=dislikes,
        max_activity_budget=random.choice([20, 30, 50, 75, 100, 150, 200]),
        pace=random.choice(_PACE_OPTIONS),
        dietary=random.sample(_DIETARY_OPTIONS, random.randint(0, 2)),
        max_walking_km=random.choice([1, 2, 3, 5, 10]),
    )


def heuristic_relevance(user: SyntheticPrefs, place: SyntheticPlace) -> float:
    """Hand-crafted scoring function — the "teacher" for the neural network.

    This defines what "good" recommendations look like before we have real
    user data.  The DNN learns to approximate this, then generalizes to
    feature interactions we didn't explicitly code.
    """
    score = 0.5  # neutral baseline

    # Category alignment — strongest signal
    if place.category in user.likes:
        score += 0.25
    if place.category in user.dislikes:
        score -= 0.35

    # Budget fit
    if place.price_level is not None:
        place_cost = place.price_level * 25
        if place_cost <= user.max_activity_budget:
            score += 0.1
        else:
            score -= 0.2

    # Quality signal
    if place.rating is not None:
        if place.rating >= 4.0:
            score += 0.1
        elif place.rating < 3.0:
            score -= 0.15

    # Popularity bonus for well-reviewed places
    if place.rating_count is not None and place.rating_count > 100:
        score += 0.05

    # Pace fit
    if user.pace == "relaxed" and place.category in ("park", "museum", "cafe", "wellness"):
        score += 0.05
    if user.pace == "packed" and place.category in ("landmark", "entertainment", "shopping"):
        score += 0.05

    # Dietary — penalty for food-related categories when user has restrictions
    if place.category in ("food", "cafe", "bar") and user.dietary and "none" not in user.dietary:
        score -= 0.05  # small penalty — we can't verify dietary accommodation

    return max(0.0, min(1.0, score))


def generate_synthetic_dataset(
    n_profiles: int = 2000,
    places_per_profile: int = 300,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate synthetic training data.

    Creates random user profiles and random places, computes heuristic
    relevance labels, and extracts feature vectors.

    Returns:
        (X, y) where X is (N, 24) features and y is (N,) labels in [0, 1].
    """
    # Import here to avoid circular imports
    from ml.scorer import extract_features, _CATEGORY_INDEX, _PACE_INDEX

    logger.info("Generating synthetic training data: %d profiles × %d places", n_profiles, places_per_profile)

    X_list = []
    y_list = []

    for i in range(n_profiles):
        if i % 500 == 0:
            logger.info("  Profile %d / %d", i, n_profiles)

        user = random_user_profile()

        for _ in range(places_per_profile):
            # Random synthetic place
            place_obj = type("P", (), {
                "category": random.choice(_CATEGORY_POOL + ["other"]),
                "price_level": random.choice([None, 0, 1, 2, 3, 4]),
                "rating": round(random.uniform(2.0, 5.0), 1),
                "rating_count": random.randint(0, 5000),
            })()

            synth_place = SyntheticPlace(
                category=place_obj.category,
                price_level=place_obj.price_level,
                rating=place_obj.rating,
                rating_count=place_obj.rating_count,
            )

            # Compute label
            label = heuristic_relevance(user, synth_place)

            # Compute features (reuse the same function used at inference)
            sim = random.uniform(0.3, 0.9)  # simulated similarity
            features = extract_features(user, place_obj, similarity=sim)

            X_list.append(features)
            y_list.append(label)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    logger.info("Generated %d training pairs, X shape: %s", len(y), X.shape)
    return X, y


def build_model() -> "tf.keras.Model":
    """Build the scoring DNN.

    Architecture: Input(24) → Dense(64, ReLU) → Dropout(0.2) → Dense(32, ReLU) → Dense(1, Sigmoid)

    3K trainable parameters — proportional to 24 input features.
    Dropout prevents memorizing synthetic heuristic labels.
    Sigmoid output = calibrated relevance probability.
    """
    import tensorflow as tf

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(25,)),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["mae"],
    )
    return model


def train(n_profiles: int = 2000, places_per_profile: int = 300, epochs: int = 20):
    """Full training pipeline: generate data → build model → train → save."""
    X, y = generate_synthetic_dataset(n_profiles, places_per_profile)

    logger.info("Building model...")
    model = build_model()
    model.summary()

    logger.info("Training for %d epochs...", epochs)
    history = model.fit(
        X, y,
        epochs=epochs,
        batch_size=256,
        validation_split=0.2,
        verbose=1,
    )

    # Save model
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(MODEL_PATH))
    logger.info("Model saved to %s", MODEL_PATH)

    # Report final metrics
    val_loss = history.history["val_loss"][-1]
    val_mae = history.history["val_mae"][-1]
    logger.info("Final validation loss: %.4f, MAE: %.4f", val_loss, val_mae)

    return model, history


if __name__ == "__main__":
    train()

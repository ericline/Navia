"""Retrain the recommendation scoring model using real feedback + synthetic data.

Pipeline:
1. Load RecommendationFeedback rows joined to users (for preferences) and places
2. Map signals to relevance labels (must_do=1.0 ... deleted=0.1)
3. Extract feature vectors using the same ml.scorer.extract_features used at inference
4. Mix 70% real + 30% synthetic to prevent catastrophic forgetting on sparse feedback
5. Train a fresh model and save as scorer_v2.keras (keeps v1 intact)
6. Write a sidecar metrics JSON and print side-by-side vs v1 metrics

Usage:
    python -m ml.retrain
    python -m ml.retrain --min-feedback 20 --epochs 20

To promote v2 to production: change _MODEL_PATH in ml/scorer.py to scorer_v2.keras.
"""
from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from sqlalchemy.orm import Session

import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"
V1_PATH = MODELS_DIR / "scorer_v1.keras"
V2_PATH = MODELS_DIR / "scorer_v2.keras"
V1_METRICS_PATH = MODELS_DIR / "scorer_v1.metrics.json"
V2_METRICS_PATH = MODELS_DIR / "scorer_v2.metrics.json"

# Signal → target relevance label. Aligned with how the model is used at inference
# (sigmoid output in [0, 1] where higher = more relevant to the user).
SIGNAL_TO_LABEL: dict[str, float] = {
    "must_do": 1.0,
    "scheduled": 0.9,
    "added": 0.7,
    "skipped": 0.3,
    "deleted": 0.1,
}


@dataclass
class _PrefsView:
    """Shape that matches what extract_features() expects (same fields as UserPreferences)."""
    likes: list[str] = field(default_factory=list)
    dislikes: list[str] = field(default_factory=list)
    max_activity_budget: float = 100.0
    pace: str = "balanced"
    dietary: list[str] = field(default_factory=list)
    max_walking_km: float = 2.0


def _user_to_prefs(user: models.User) -> _PrefsView:
    """Build a preferences view from a User row, applying schema defaults for nulls."""
    def _json_list(raw: str | None) -> list[str]:
        if not raw:
            return []
        try:
            val = json.loads(raw)
            return val if isinstance(val, list) else []
        except (ValueError, TypeError):
            return []

    return _PrefsView(
        likes=_json_list(user.pref_likes),
        dislikes=_json_list(user.pref_dislikes),
        max_activity_budget=user.pref_max_activity_budget or 100.0,
        pace=user.pref_pace or "balanced",
        dietary=_json_list(user.pref_dietary),
        max_walking_km=user.pref_max_walking_km or 2.0,
    )


def load_real_dataset(db: Session) -> tuple[np.ndarray, np.ndarray]:
    """Load feedback rows and extract (X, y) for training.

    Feedback rows with no joined place (place_id NULL) are skipped — they
    exist for Claude-fallback recommendations which have no DB row and
    therefore no features we can reconstruct.
    """
    from ml.scorer import extract_features

    rows = (
        db.query(models.RecommendationFeedback, models.User, models.Place)
        .join(models.User, models.RecommendationFeedback.user_id == models.User.id)
        .join(models.Place, models.RecommendationFeedback.place_id == models.Place.id)
        .all()
    )

    X_list = []
    y_list = []
    for feedback, user, place in rows:
        label = SIGNAL_TO_LABEL.get(feedback.signal)
        if label is None:
            continue
        prefs = _user_to_prefs(user)
        # Similarity isn't recorded with the feedback; use a neutral prior.
        # Retraining primarily teaches the model the structured signals
        # (category/price/rating) from real labels.
        features = extract_features(prefs, place, similarity=0.5)
        X_list.append(features)
        y_list.append(label)

    if not X_list:
        return np.zeros((0, 25), dtype=np.float32), np.zeros((0,), dtype=np.float32)

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.float32)


def mix_datasets(
    X_real: np.ndarray,
    y_real: np.ndarray,
    X_synth: np.ndarray,
    y_synth: np.ndarray,
    real_fraction: float = 0.7,
) -> tuple[np.ndarray, np.ndarray]:
    """Combine real + synthetic into a single shuffled dataset.

    Target mix is real_fraction real, (1 - real_fraction) synthetic. If real
    data is smaller than that fraction would imply, we oversample it so the
    model still sees mostly real signal without being starved of data.
    """
    n_real = len(X_real)
    n_synth_target = max(1, int(n_real * (1 - real_fraction) / real_fraction))
    n_synth_target = min(n_synth_target, len(X_synth))

    if n_synth_target < len(X_synth):
        idx = np.random.choice(len(X_synth), size=n_synth_target, replace=False)
        X_synth = X_synth[idx]
        y_synth = y_synth[idx]

    X = np.concatenate([X_real, X_synth], axis=0)
    y = np.concatenate([y_real, y_synth], axis=0)

    perm = np.random.permutation(len(X))
    return X[perm], y[perm]


def _load_metrics(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (ValueError, OSError):
        return None


def _save_metrics(path: Path, metrics: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metrics, indent=2))


def retrain(min_feedback: int = 20, epochs: int = 20, real_fraction: float = 0.7):
    """Full retraining pipeline. Returns (model, metrics_dict) or (None, None) if skipped."""
    from database import SessionLocal
    from ml.train_scorer import build_model, generate_synthetic_dataset

    session = SessionLocal()
    try:
        X_real, y_real = load_real_dataset(session)
    finally:
        session.close()

    logger.info("Loaded %d real feedback rows", len(X_real))
    if len(X_real) < min_feedback:
        logger.warning(
            "Not enough feedback (%d < %d) — aborting. Generate more user activity first.",
            len(X_real), min_feedback,
        )
        return None, None

    # 30% synthetic by default — enough to retain generalization without drowning real signal
    X_synth, y_synth = generate_synthetic_dataset(n_profiles=500, places_per_profile=100)
    X, y = mix_datasets(X_real, y_real, X_synth, y_synth, real_fraction=real_fraction)
    logger.info("Training set: %d rows (%d real, %d synthetic)", len(X), len(X_real), len(X) - len(X_real))

    model = build_model()
    model.summary()
    history = model.fit(
        X, y,
        epochs=epochs,
        batch_size=256,
        validation_split=0.2,
        verbose=1,
    )

    V2_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(V2_PATH))
    logger.info("Saved %s", V2_PATH)

    metrics = {
        "val_loss": float(history.history["val_loss"][-1]),
        "val_mae": float(history.history["val_mae"][-1]),
        "n_real": int(len(X_real)),
        "n_synth": int(len(X) - len(X_real)),
        "epochs": epochs,
        "real_fraction": real_fraction,
    }
    _save_metrics(V2_METRICS_PATH, metrics)

    v1_metrics = _load_metrics(V1_METRICS_PATH)
    print("\n=== Training complete ===")
    print(f"v2: val_loss={metrics['val_loss']:.4f}  val_mae={metrics['val_mae']:.4f}  "
          f"(n_real={metrics['n_real']}, n_synth={metrics['n_synth']})")
    if v1_metrics:
        print(f"v1: val_loss={v1_metrics.get('val_loss', float('nan')):.4f}  "
              f"val_mae={v1_metrics.get('val_mae', float('nan')):.4f}")
        delta = metrics["val_loss"] - v1_metrics.get("val_loss", metrics["val_loss"])
        print(f"Δ val_loss: {delta:+.4f} (negative = v2 better)")
    else:
        print("No v1 metrics sidecar found — write ml/models/scorer_v1.metrics.json to enable comparison.")
    print(f"\nTo promote v2: change _MODEL_PATH in ml/scorer.py to scorer_v2.keras")

    return model, metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Retrain scoring model on real feedback")
    parser.add_argument("--min-feedback", type=int, default=20)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--real-fraction", type=float, default=0.7)
    args = parser.parse_args()

    retrain(
        min_feedback=args.min_feedback,
        epochs=args.epochs,
        real_fraction=args.real_fraction,
    )

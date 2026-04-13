"""AI endpoints: ML-powered recommendations and deterministic arrangement strategies.

Recommendation pipeline:
1. Check if places exist for the destination in the DB
2. If not, ingest from Google Places API (on-demand)
3. Retrieve top candidates via embedding similarity
4. Re-rank with TensorFlow scoring model (or heuristic fallback)
5. Apply MMR diversity re-ranking
6. Fall back to Claude Haiku for destinations with insufficient data
"""
import json
import logging
import os
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

import ai_client
import arrangement
import crud
import models
from auth import get_current_user, get_db, verify_trip_access
from data.ingest_places import ingest_destination, get_place_count

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

_MAPBOX_TOKEN = os.getenv("NEXT_PUBLIC_MAPBOX_TOKEN") or os.getenv("MAPBOX_TOKEN", "")
_GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")


@router.get("/places/photo")
def proxy_place_photo(ref: str, max_h: int = 200):
    """Proxy Google Places Photos API so the API key isn't exposed to the browser.

    `ref` is the stored photo_reference (e.g. "places/ABC/photos/XYZ").
    """
    if not _GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=503, detail="Places API not configured")
    if not ref or ".." in ref:
        raise HTTPException(status_code=400, detail="invalid ref")
    max_h = max(64, min(max_h, 800))
    url = f"https://places.googleapis.com/v1/{ref}/media"
    try:
        resp = httpx.get(
            url,
            params={"key": _GOOGLE_PLACES_API_KEY, "maxHeightPx": str(max_h)},
            timeout=8.0,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("place photo fetch failed: %s", e)
        raise HTTPException(status_code=502, detail="photo fetch failed")
    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=86400"},
    )


def _geocode_address(address: str, proximity: tuple[float, float] | None = None) -> tuple[float, float] | None:
    """Geocode a single address via Mapbox Geocoding v5. Returns (lng, lat) or None."""
    if not _MAPBOX_TOKEN or not address:
        return None
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{quote(address)}.json"
    params: dict[str, str] = {"access_token": _MAPBOX_TOKEN, "limit": "1"}
    if proximity:
        params["proximity"] = f"{proximity[0]},{proximity[1]}"
    try:
        resp = httpx.get(url, params=params, timeout=5.0)
        resp.raise_for_status()
        features = resp.json().get("features", [])
        if features:
            lng, lat = features[0]["geometry"]["coordinates"]
            return (lng, lat)
    except Exception:
        pass
    return None


def _batch_geocode_recommendations(recs: list[dict], destination: str) -> list[dict]:
    """Geocode all recommendation addresses, using destination as proximity bias."""
    # First geocode the destination itself for proximity bias
    dest_coords = _geocode_address(destination)

    for rec in recs:
        address = rec.get("address")
        if not address:
            continue
        # Append destination to address for better geocoding accuracy
        full_address = f"{address}, {destination}"
        coords = _geocode_address(full_address, proximity=dest_coords)
        if coords:
            rec["lng"] = coords[0]
            rec["lat"] = coords[1]

    return recs


class RecommendationResponse(BaseModel):
    enabled: bool
    recommendations: list[dict]


_MIN_PLACES_THRESHOLD = 20  # minimum places needed to use ML pipeline


def _place_to_rec_dict(place: models.Place) -> dict:
    """Convert a Place ORM object to the recommendation dict format expected by the frontend."""
    return {
        "place_id": place.id,
        "name": place.name,
        "category": place.category,
        "address": place.address,
        "lat": place.lat,
        "lng": place.lng,
        "est_duration_minutes": 90,  # default estimate
        "cost_estimate": (place.price_level or 2) * 25.0,  # rough mapping
        "energy_level": "medium",
        "must_do": (place.rating or 0) >= 4.5 and (place.rating_count or 0) > 500,
        "notes": place.description or "",
        "rating": place.rating,
        "rating_count": place.rating_count,
        "price_level": place.price_level,
        "photo_reference": place.photo_reference,
        "google_place_id": place.google_place_id,
        "verified": True,
    }


def _ml_recommend(trip: models.Trip, prefs, db: Session) -> list[dict]:
    """Run the custom ML recommendation pipeline: retrieve → score → diversify."""
    from ml.encoder import build_query_embedding, vector_search
    from ml.scorer import score_candidates, diversity_rerank

    # Step 1: Ensure enough places exist for this destination
    count = get_place_count(db, trip.destination)
    if count < _MIN_PLACES_THRESHOLD:
        logger.info("Only %d places for %s — ingesting from Google Places", count, trip.destination)
        ingest_destination(trip.destination, db)
        count = get_place_count(db, trip.destination)

    if count < 5:
        logger.warning("Insufficient places (%d) for %s after ingestion", count, trip.destination)
        return []

    # Step 2: Retrieve candidates via embedding similarity
    query_emb = build_query_embedding(trip.destination, prefs)
    candidates = vector_search(db, trip.destination, query_emb, limit=50)

    if not candidates:
        return []

    # Step 3: Score and rank with TF model (or heuristic fallback)
    scored = score_candidates(prefs, candidates)

    # Step 4: Diversity re-ranking via MMR
    top_places = diversity_rerank(scored, top_k=10, lambda_=0.7)

    return [_place_to_rec_dict(p) for p in top_places]


@router.post("/trips/{trip_id}/recommend", response_model=RecommendationResponse)
def recommend_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate activity recommendations using custom ML pipeline with Claude fallback."""
    trip = verify_trip_access(db, trip_id, current_user)
    prefs = crud.user_preferences_from_db(current_user)

    # Try custom ML pipeline first
    recs: list[dict] = []
    try:
        recs = _ml_recommend(trip, prefs, db)
    except Exception as e:
        logger.error("ML recommendation pipeline failed: %s", e, exc_info=True)

    # Fallback to Claude if ML pipeline returned insufficient results
    if len(recs) < 5:
        logger.info("ML pipeline returned %d results — falling back to Claude", len(recs))
        prefs_dict = {
            "likes": prefs.likes,
            "dislikes": prefs.dislikes,
            "max_activity_budget": prefs.max_activity_budget,
            "max_walking_km": prefs.max_walking_km,
            "pace": prefs.pace,
            "dietary": prefs.dietary,
        }
        days = (trip.end_date - trip.start_date).days + 1
        claude_recs = ai_client.recommend_activities(trip.destination, days, prefs_dict)
        if claude_recs and _MAPBOX_TOKEN:
            claude_recs = _batch_geocode_recommendations(claude_recs, trip.destination)
        # Mark Claude results as unverified
        for r in claude_recs:
            r["verified"] = False
        recs = recs + claude_recs

    return RecommendationResponse(
        enabled=True,
        recommendations=recs[:10],
    )


class ArrangementAssignment(BaseModel):
    activity_id: int
    day_id: int
    position: int
    start_time: str | None = None  # "HH:MM:SS"


class ArrangementOut(BaseModel):
    name: str
    description: str
    assignments: list[ArrangementAssignment]


@router.post("/trips/{trip_id}/arrange", response_model=list[ArrangementOut])
def arrange_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate up to 5 deterministic arrangement strategies for unscheduled activities."""
    trip = verify_trip_access(db, trip_id, current_user)
    prefs = crud.user_preferences_from_db(current_user)

    all_activities = crud.get_activities_for_trip(db, trip_id)
    unscheduled = [a for a in all_activities if a.day_id is None]
    scheduled = [a for a in all_activities if a.day_id is not None]
    days = (
        db.query(models.Day)
        .filter(models.Day.trip_id == trip_id)
        .order_by(models.Day.date)
        .all()
    )

    if not unscheduled:
        raise HTTPException(status_code=400, detail="No unscheduled activities to arrange")
    if not days:
        raise HTTPException(status_code=400, detail="Trip has no days to arrange into")

    # Group existing scheduled activities by day for capacity-aware arrangement
    existing_by_day: dict[int, list] = {}
    for a in scheduled:
        existing_by_day.setdefault(a.day_id, []).append(a)

    return arrangement.generate_arrangements(unscheduled, days, prefs, existing_by_day)


class ApplyArrangementRequest(BaseModel):
    assignments: list[ArrangementAssignment]


@router.post("/trips/{trip_id}/apply-arrangement")
def apply_arrangement(
    trip_id: int,
    req: ApplyArrangementRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Apply a chosen arrangement by batch-updating activity day/position/time assignments."""
    verify_trip_access(db, trip_id, current_user)

    # Single IN query instead of N individual fetches
    activity_ids = [a.activity_id for a in req.assignments]
    activities = (
        db.query(models.Activity)
        .filter(models.Activity.id.in_(activity_ids), models.Activity.trip_id == trip_id)
        .all()
    )
    valid_ids = {a.id for a in activities}

    # Build bulk update mappings
    from datetime import time as _time

    mappings = []
    for a in req.assignments:
        if a.activity_id not in valid_ids:
            continue
        update: dict = {"id": a.activity_id, "day_id": a.day_id, "position": a.position}
        if a.start_time:
            parts = a.start_time.split(":")
            try:
                update["start_time"] = _time(
                    int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
                )
            except (ValueError, IndexError):
                pass
        mappings.append(update)

    if mappings:
        db.bulk_update_mappings(models.Activity, mappings)
    db.commit()
    return {"status": "ok", "applied": len(mappings)}


class FeedbackRequest(BaseModel):
    place_id: int | None = None
    signal: str  # added|skipped|scheduled|deleted|must_do


@router.post("/trips/{trip_id}/feedback")
def record_feedback(
    trip_id: int,
    req: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Record implicit/explicit feedback on a recommendation for model retraining."""
    verify_trip_access(db, trip_id, current_user)

    valid_signals = {"added", "skipped", "scheduled", "deleted", "must_do"}
    if req.signal not in valid_signals:
        raise HTTPException(status_code=400, detail=f"Invalid signal: {req.signal}")

    feedback = models.RecommendationFeedback(
        user_id=current_user.id,
        place_id=req.place_id,
        trip_id=trip_id,
        signal=req.signal,
    )
    db.add(feedback)
    db.commit()
    return {"status": "ok"}

"""AI endpoints: ML-powered recommendations and deterministic arrangement strategies.

Recommendation pipeline:
1. Check if places exist for the destination in the DB
2. If not, ingest from Google Places API (on-demand)
3. Retrieve top candidates via embedding similarity
4. Re-rank with TensorFlow scoring model (or heuristic fallback)
5. Apply MMR diversity re-ranking
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

import arrangement
import crud
import models
from auth import get_current_user, get_db, verify_trip_access
from data.destination_normalizer import normalize_destination
from data.ingest_places import (
    ingest_destination,
    ingest_interest,
    get_place_count,
    count_places_matching,
)
from data.category_mapping import get_interest_hint

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
        "must_do": False,  # AI suggestions are never auto-marked Must-Do — user must opt in after scheduling
        "notes": place.description or "",
        "rating": place.rating,
        "rating_count": place.rating_count,
        "price_level": place.price_level,
        "photo_reference": place.photo_reference,
        "google_place_id": place.google_place_id,
        "verified": True,
    }


def _ml_recommend(
    trip: models.Trip, prefs, db: Session, user: models.User
) -> list[dict]:
    """Run the custom ML recommendation pipeline: retrieve → score → diversify.

    Context-aware: excludes places already on the trip and places the user has
    previously skipped/added (for this trip), and augments the query embedding
    with a short summary of what's already planned + what was rejected.
    """
    from ml.encoder import build_query_embedding, vector_search
    from ml.scorer import score_candidates, diversity_rerank, interest_match

    destination = normalize_destination(trip.destination)

    # Step 1: Ensure enough places exist for this destination
    count = get_place_count(db, destination)
    if count < _MIN_PLACES_THRESHOLD:
        logger.info("Only %d places for %s — ingesting from Google Places", count, destination)
        ingest_destination(destination, db)
        count = get_place_count(db, destination)

    if count < 5:
        logger.warning("Insufficient places (%d) for %s after ingestion", count, destination)
        return []

    # Step 1b: Interest-driven on-demand ingest. For any declared interest that
    # maps to a known search hint AND has <5 matching places already, pull a
    # targeted query from Google Places. Capped per call to bound API cost;
    # results are cached in the DB forever.
    interests = getattr(prefs, "interests", None) or []
    ingests_done = 0
    for interest in interests:
        if ingests_done >= 3:
            break
        hint = get_interest_hint(interest)
        if not hint:
            continue
        if count_places_matching(db, destination, interest) >= 5:
            continue
        try:
            ingest_interest(destination, interest, db)
            ingests_done += 1
        except Exception as e:
            logger.warning("Interest ingest failed for %s/%s: %s", destination, interest, e)

    # Step 2: Build context from existing trip activities + prior feedback.
    # Trip-scoped feedback drives the HARD filter (exclude_ids).
    # Profile-scoped feedback drives SOFT nudges (embedding + post-score multipliers).
    existing = crud.get_activities_for_trip(db, trip.id)
    existing_gpids = {a.google_place_id for a in existing if a.google_place_id}
    has_names = [a.name for a in existing if a.name][:20]

    trip_feedback = (
        db.query(models.RecommendationFeedback)
        .filter(
            models.RecommendationFeedback.user_id == user.id,
            models.RecommendationFeedback.trip_id == trip.id,
        )
        .all()
    )
    skipped_place_ids: set[int] = set()
    added_place_ids: set[int] = set()
    for fb in trip_feedback:
        if fb.place_id is None:
            continue
        if fb.signal == "skipped":
            skipped_place_ids.add(fb.place_id)
        elif fb.signal in ("added", "scheduled", "must_do"):
            added_place_ids.add(fb.place_id)

    # Profile-scoped feedback: every trip, all time. Used only as soft signal.
    profile_feedback = (
        db.query(models.RecommendationFeedback)
        .filter(models.RecommendationFeedback.user_id == user.id)
        .order_by(models.RecommendationFeedback.id.desc())
        .all()
    )
    profile_skipped_ids: set[int] = set()
    profile_added_ids: list[int] = []  # preserves recency order
    for fb in profile_feedback:
        if fb.place_id is None:
            continue
        if fb.signal == "skipped":
            profile_skipped_ids.add(fb.place_id)
        elif fb.signal in ("added", "scheduled", "must_do"):
            if fb.place_id not in profile_added_ids:
                profile_added_ids.append(fb.place_id)

    # Resolve names + categories for soft signals
    avoid_names: list[str] = []
    if profile_skipped_ids:
        rows = (
            db.query(models.Place.name)
            .filter(models.Place.id.in_(profile_skipped_ids))
            .all()
        )
        avoid_names = [r.name for r in rows][:20]

    liked_names: list[str] = []
    profile_added_categories: dict[str, int] = {}
    if profile_added_ids:
        # Preserve recency: fetch with IN, then reorder by profile_added_ids.
        added_rows = (
            db.query(models.Place.id, models.Place.name, models.Place.category)
            .filter(models.Place.id.in_(profile_added_ids))
            .all()
        )
        by_id = {r.id: r for r in added_rows}
        ordered = [by_id[pid] for pid in profile_added_ids if pid in by_id]
        liked_names = [r.name for r in ordered if r.name][:20]
        for r in ordered:
            if r.category:
                profile_added_categories[r.category] = profile_added_categories.get(r.category, 0) + 1

    context: dict | None = None
    if has_names or avoid_names or liked_names:
        context = {"has": has_names, "avoid": avoid_names, "liked": liked_names}

    # Step 3: Retrieve candidates via embedding similarity — fetch extra to survive filtering
    query_emb = build_query_embedding(destination, prefs, context=context)
    candidates = vector_search(db, destination, query_emb, limit=80)

    if not candidates:
        return []

    # Step 4: Filter out existing + trip-skipped + already-added places.
    # Note: profile-skipped IDs are NOT a hard filter — just a soft nudge.
    exclude_ids = skipped_place_ids | added_place_ids
    filtered = [
        (p, s) for (p, s) in candidates
        if p.id not in exclude_ids and (not p.google_place_id or p.google_place_id not in existing_gpids)
    ]
    if not filtered:
        return []

    # Step 5: Score and rank with TF model (or heuristic fallback)
    scored = score_candidates(prefs, filtered)

    # Step 5b: Post-score multipliers for interest match + category affinity.
    # Applied outside the 25-dim TF model so the saved model stays compatible.
    total_added = sum(profile_added_categories.values())
    boosted: list[tuple] = []
    for place, sim, score in scored:
        mult = 1.0
        if interest_match(prefs, place) > 0:
            mult *= 1.3
        if total_added > 0 and place.category:
            affinity = profile_added_categories.get(place.category, 0) / total_added
            mult *= 1.0 + 0.1 * affinity
        boosted.append((place, sim, score * mult))
    boosted.sort(key=lambda x: x[2], reverse=True)

    # Step 6: Diversity re-ranking via MMR
    top_places = diversity_rerank(boosted, top_k=10, lambda_=0.7)

    return [_place_to_rec_dict(p) for p in top_places]


@router.post("/trips/{trip_id}/recommend", response_model=RecommendationResponse)
def recommend_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate activity recommendations via the custom ML pipeline."""
    trip = verify_trip_access(db, trip_id, current_user)
    prefs = crud.user_preferences_from_db(current_user)

    recs: list[dict] = []
    try:
        recs = _ml_recommend(trip, prefs, db, current_user)
    except Exception as e:
        logger.error("ML recommendation pipeline failed: %s", e, exc_info=True)

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
    """Generate up to 5 deterministic arrangement strategies.

    Must-Do activities with a start_time are treated as immovable anchors — they stay
    on their day and time. Every other activity (unscheduled OR scheduled-but-not-must-do)
    is thrown into the movable pool and reassigned.
    """
    trip = verify_trip_access(db, trip_id, current_user)
    prefs = crud.user_preferences_from_db(current_user)

    all_activities = crud.get_activities_for_trip(db, trip_id)
    days = (
        db.query(models.Day)
        .filter(models.Day.trip_id == trip_id)
        .order_by(models.Day.date)
        .all()
    )

    if not days:
        raise HTTPException(status_code=400, detail="Trip has no days to arrange into")

    # Must-Do + scheduled + has start_time → locked anchor.
    locked = [
        a for a in all_activities
        if a.must_do and a.day_id is not None and a.start_time is not None
    ]
    movable = [a for a in all_activities if a not in locked]

    if not movable:
        raise HTTPException(status_code=400, detail="No activities available to arrange")

    locked_by_day: dict[int, list] = {}
    for a in locked:
        locked_by_day.setdefault(a.day_id, []).append(a)

    arrangements = arrangement.generate_arrangements(movable, days, prefs, locked_by_day)

    # Re-emit locked anchors in every arrangement's assignments list so the
    # client can apply a single batch update without losing them.
    for arr in arrangements:
        existing_ids = {asn["activity_id"] for asn in arr["assignments"]}
        for a in locked:
            if a.id in existing_ids:
                continue
            arr["assignments"].append({
                "activity_id": a.id,
                "day_id": a.day_id,
                "position": a.position or 0,
                "start_time": a.start_time.strftime("%H:%M:%S") if a.start_time else None,
            })

    return arrangements


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
    """Record implicit/explicit feedback on a recommendation for quality monitoring."""
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

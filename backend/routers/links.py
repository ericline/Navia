"""Link resolution: shared TikTok / Instagram / Google Maps URL → place candidates.

POST /links/resolve {url} — auth required, rate-limited per user (the resolver
fans out to TikTok, Claude Haiku and Google Places, all of which cost money or
get us bot-blocked when hammered).
"""
from __future__ import annotations

import threading
import time

from fastapi import APIRouter, Depends, HTTPException

import models
import schemas
from auth import get_current_user
from services import link_resolver

router = APIRouter(prefix="/links", tags=["links"])

# --- simple per-user sliding-window limiter (process-local) -----------------
_RATE_LIMIT = 30          # requests
_RATE_WINDOW = 60.0       # seconds
_hits: dict[int, list[float]] = {}
_hits_lock = threading.Lock()


def _check_rate(user_id: int) -> None:
    now = time.time()
    with _hits_lock:
        window = [t for t in _hits.get(user_id, []) if now - t < _RATE_WINDOW]
        if len(window) >= _RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Too many link lookups; try again in a minute.")
        window.append(now)
        _hits[user_id] = window


@router.post("/resolve", response_model=schemas.LinkResolveResponse)
def resolve_link(
    payload: schemas.LinkResolveRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Resolve a shared link into place candidates the client can save as an activity."""
    url = payload.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    _check_rate(current_user.id)

    result = link_resolver.resolve_cached(url)
    m = result.metadata
    return schemas.LinkResolveResponse(
        platform=m.platform,
        link_kind=m.link_kind,
        source_url=m.source_url,
        external_id=m.external_id,
        title=m.title,
        caption=m.caption,
        thumbnail_url=m.thumbnail_url,
        hint_city=m.hint_city,
        mentions=result.mentions,
        candidates=result.candidates,
        warnings=m.warnings,
    )

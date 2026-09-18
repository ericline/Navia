"""Google Maps list import (preview) and export.

POST /imports/google-maps/preview            JSON {url}  — shared list link
POST /imports/google-maps/preview/file?filename=…  raw body bytes (CSV/JSON/KML/KMZ/ZIP)
    Both return an ImportPreviewResponse. Nothing is written; the client reviews
    the rows, then commits via POST /activities/batch.

GET  /exports/google-maps?scope=bucket|trip&trip_id=…&format=kml|csv
    Downloads the user's bucket list or one trip as KML (for Google My Maps) or CSV.

The file endpoint takes the raw body (not multipart) so no extra dependency is
needed; browsers send it with `fetch(url, {method:"POST", body: file})`.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

import crud
import models
import schemas
from auth import get_current_user, get_db, verify_trip_access
from services import google_maps_export, google_maps_import
from services.link_resolver import google_maps as gm_links

router = APIRouter(tags=["imports"])

_MAX_UPLOAD = 30 * 1024 * 1024  # 30 MB (Takeout zips can be large)


def _to_response(parsed: google_maps_import.ParsedList) -> schemas.ImportPreviewResponse:
    return schemas.ImportPreviewResponse(
        list_name=parsed.list_name,
        source=parsed.source,  # type: ignore[arg-type]
        items=[schemas.ImportItemOut(**it.to_dict()) for it in parsed.items],
        warnings=parsed.warnings,
    )


@router.post("/imports/google-maps/preview", response_model=schemas.ImportPreviewResponse)
def preview_from_link(
    payload: schemas.ImportLinkRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Preview a shared Google Maps list link (best-effort scrape)."""
    url = payload.url.strip()
    if not gm_links.is_google_maps(url):
        raise HTTPException(status_code=400, detail="Not a Google Maps link")
    parsed = google_maps_import.parse_shared_list(url)
    parsed.items = google_maps_import.resolve_items(parsed.items)
    return _to_response(parsed)


@router.post("/imports/google-maps/preview/file", response_model=schemas.ImportPreviewResponse)
async def preview_from_file(
    request: Request,
    filename: str = Query(..., min_length=1, max_length=255),
    hint: Optional[str] = Query(None, max_length=200, description="City/region to bias place lookup"),
    current_user: models.User = Depends(get_current_user),
):
    """Preview a Takeout CSV / Saved Places.json / KML / KMZ / ZIP sent as the raw request body."""
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="File too large (max 30 MB)")
    parsed = google_maps_import.parse_bytes(data, filename)
    parsed.items = google_maps_import.resolve_items(parsed.items, hint=hint)
    return _to_response(parsed)


@router.get("/exports/google-maps")
def export_google_maps(
    scope: Literal["bucket", "trip"] = Query("bucket"),
    trip_id: Optional[int] = Query(None),
    format: Literal["kml", "csv"] = Query("kml"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Download the bucket list or a trip as KML (Google My Maps) or CSV."""
    if scope == "trip":
        if trip_id is None:
            raise HTTPException(status_code=400, detail="trip_id is required for scope=trip")
        trip = verify_trip_access(db, trip_id, current_user)
        activities = crud.get_activities_for_trip(db, trip_id)
        days = crud.get_days_for_trip(db, trip_id)
        by_day: dict[int, list[models.Activity]] = {d.id: [] for d in days}
        unscheduled: list[models.Activity] = []
        for a in activities:
            (by_day.get(a.day_id) if a.day_id in by_day else unscheduled).append(a)
        folders = [
            (f"Day {i + 1} — {d.date.isoformat()}" + (f" · {d.name}" if d.name else ""), by_day[d.id])
            for i, d in enumerate(days) if by_day[d.id]
        ]
        if unscheduled:
            folders.append(("Unscheduled", unscheduled))
        doc_name = f"{trip.name} ({trip.destination})"
        base = f"navia-{trip.name}".replace(" ", "-")
    else:
        activities = crud.get_bucket_activities(db, user_id=current_user.id)
        folders = [("", activities)]
        doc_name = "Navia Bucket List"
        base = "navia-bucket-list"

    if format == "csv":
        body = google_maps_export.build_csv(activities)
        return Response(content=body, media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{base}.csv"'})
    body = google_maps_export.build_kml(doc_name, folders)
    return Response(content=body, media_type="application/vnd.google-earth.kml+xml",
                    headers={"Content-Disposition": f'attachment; filename="{base}.kml"'})

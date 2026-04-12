# backend/routers/activities.py
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import models
import schemas
from auth import get_db, get_current_user, verify_trip_access

router = APIRouter(
    prefix="/activities",
    tags=["activities"],
)


@router.put("/reorder", response_model=List[schemas.Activity])
def reorder_activities(
    payload: schemas.ActivityReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not payload.orders:
        return []
    trip_id = None
    for item in payload.orders:
        activity = crud.get_activity(db, item.activity_id)
        if not activity:
            raise HTTPException(status_code=404, detail=f"Activity {item.activity_id} not found")
        if trip_id is None:
            trip_id = activity.trip_id
            verify_trip_access(db, trip_id, current_user)
        activity.position = item.position
    db.commit()
    return crud.get_activities_for_trip(db, trip_id)


@router.get("/trip/{trip_id}", response_model=List[schemas.Activity])
def read_activities_for_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    verify_trip_access(db, trip_id, current_user)
    return crud.get_activities_for_trip(db, trip_id=trip_id)


@router.get("/day/{day_id}", response_model=List[schemas.Activity])
def read_activities_for_day(
    day_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    day = crud.get_day(db, day_id=day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    verify_trip_access(db, day.trip_id, current_user)
    return crud.get_activities_for_day(db, day_id=day_id)


@router.get("/{activity_id}", response_model=schemas.Activity)
def read_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = crud.get_activity(db, activity_id=activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    verify_trip_access(db, activity.trip_id, current_user)
    return activity


@router.post("/", response_model=schemas.Activity)
def create_activity(
    activity: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    verify_trip_access(db, activity.trip_id, current_user)

    if activity.day_id is not None:
        day = crud.get_day(db, day_id=activity.day_id)
        if not day:
            raise HTTPException(status_code=404, detail="Day not found")
        if day.trip_id != activity.trip_id:
            raise HTTPException(
                status_code=400,
                detail="Day does not belong to the given trip",
            )

    return crud.create_activity(db=db, activity=activity)


@router.patch("/{activity_id}", response_model=schemas.Activity)
def update_activity(
    activity_id: int,
    update: schemas.ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = crud.get_activity(db, activity_id=activity_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Activity not found")
    verify_trip_access(db, existing.trip_id, current_user)
    activity = crud.update_activity(db, activity_id=activity_id, update=update)
    return activity


@router.delete("/{activity_id}")
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = crud.get_activity(db, activity_id=activity_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Activity not found")
    verify_trip_access(db, existing.trip_id, current_user)
    crud.delete_activity(db, activity_id=activity_id)
    return {"ok": True}

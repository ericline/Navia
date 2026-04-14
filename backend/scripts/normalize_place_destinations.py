"""One-time migration: rewrite Place.destination and Trip.destination to the
canonical "City, ST" form produced by the frontend's formatDestination().

Run once after adding backend/data/destination_normalizer.py:

    cd backend && source .venv/bin/activate
    python -m scripts.normalize_place_destinations
"""
from __future__ import annotations

from collections import Counter

from database import SessionLocal
import models
from data.destination_normalizer import normalize_destination


def _summarize(db) -> Counter:
    return Counter(
        d for (d,) in db.query(models.Place.destination).all()
    )


def main() -> None:
    db = SessionLocal()
    try:
        before = _summarize(db)
        print(f"Before: {len(before)} distinct Place destinations, {sum(before.values())} rows")

        place_changes = 0
        for p in db.query(models.Place).all():
            canon = normalize_destination(p.destination)
            if canon and canon != p.destination:
                p.destination = canon
                place_changes += 1

        trip_changes = 0
        for t in db.query(models.Trip).all():
            canon = normalize_destination(t.destination)
            if canon and canon != t.destination:
                t.destination = canon
                trip_changes += 1

        db.commit()

        after = _summarize(db)
        print(f"After: {len(after)} distinct Place destinations, {sum(after.values())} rows")
        print(f"Updated {place_changes} Place rows, {trip_changes} Trip rows")
        print("\nPer-destination counts:")
        for dest, n in sorted(after.items()):
            print(f"  {dest}: {n}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

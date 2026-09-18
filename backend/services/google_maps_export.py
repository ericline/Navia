"""Export activities as KML (Google My Maps import) or CSV.

Google has no API for writing to a user's saved lists, so the supported path is:
Navia → KML → Google My Maps ("Create a new map" → Import) → visible in the
Google Maps app under Saved → Maps. KML carries Navia's ids in ExtendedData so
re-importing a Navia export round-trips cleanly.
"""
from __future__ import annotations

import csv
import io
from typing import Iterable
from xml.sax.saxutils import escape

import models
from services.google_places import maps_link


def _placemark(a: models.Activity) -> str:
    link = maps_link(a.lat, a.lng, a.google_place_id)
    desc_bits = [a.address, a.notes, f"Open in Google Maps: {link}" if link else None]
    desc = "\n".join(b for b in desc_bits if b)
    ext = {
        "navia_activity_id": str(a.id),
        "category": a.category or "",
        "address": a.address or "",
        "notes": a.notes or "",
        "google_place_id": a.google_place_id or "",
        "google_maps_url": link or "",
        "source_url": a.source_url or "",
        "external_id": a.external_id or "",
    }
    ext_xml = "".join(
        f'<Data name="{escape(k)}"><value>{escape(v)}</value></Data>' for k, v in ext.items() if v
    )
    point = (
        f"<Point><coordinates>{a.lng},{a.lat},0</coordinates></Point>"
        if a.lat is not None and a.lng is not None
        else ""
    )
    addr = f"<address>{escape(a.address)}</address>" if a.address else ""
    return (
        "<Placemark>"
        f"<name>{escape(a.name)}</name>"
        f"<description>{escape(desc)}</description>"
        f"{addr}"
        f"<ExtendedData>{ext_xml}</ExtendedData>"
        f"{point}"
        "</Placemark>"
    )


def build_kml(document_name: str, folders: Iterable[tuple[str, list[models.Activity]]]) -> str:
    """`folders` is an ordered list of (folder_name, activities). A single folder
    named "" renders placemarks at the document root."""
    body = []
    for fname, acts in folders:
        marks = "".join(_placemark(a) for a in acts)
        if fname:
            body.append(f"<Folder><name>{escape(fname)}</name>{marks}</Folder>")
        else:
            body.append(marks)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
        f"<name>{escape(document_name)}</name>"
        + "".join(body)
        + "</Document></kml>"
    )


def build_csv(activities: Iterable[models.Activity]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Title", "Note", "URL", "Address", "Latitude", "Longitude", "Category"])
    for a in activities:
        w.writerow([
            a.name, a.notes or "", maps_link(a.lat, a.lng, a.google_place_id) or a.source_url or "",
            a.address or "", "" if a.lat is None else a.lat, "" if a.lng is None else a.lng, a.category or "",
        ])
    return buf.getvalue()

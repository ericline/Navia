"""Parse Google Maps saved-list exports into importable items.

Supported inputs
- Google Takeout "Maps (your places)":
    * `<List name>.csv`      columns: Title, Note, URL[, Tags|Comment]
    * `Saved Places.json`    GeoJSON FeatureCollection (starred / older lists)
    * the whole Takeout .zip (every CSV/JSON/KML inside is parsed)
- KML / KMZ (Google My Maps export, or Navia's own export → round-trip)
- A shared list link (maps.app.goo.gl/… → /maps/@/data=!4m3!11m2!2s<id>!3e3).
  Best-effort HTML scrape; Google can change the page at any time.

After parsing, `resolve_items` enriches each row through Google Places so the
import lands with a google_place_id, category and coordinates. Rows that can't
be resolved keep `resolved=False` and are still importable by name.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import re
import zipfile
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import unquote
import xml.etree.ElementTree as ET

from services import google_places
from services.link_resolver import google_maps as gm_links
from services.link_resolver import http as gm_http
from services.link_resolver.common import parse_meta, clean_text

logger = logging.getLogger(__name__)

MAX_ITEMS = 500          # hard cap per preview
MAX_RESOLVE = 150        # Places calls per preview (cost guard)


@dataclass
class ImportItem:
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    google_place_id: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    source_url: Optional[str] = None
    external_id: Optional[str] = None
    resolved: bool = False
    photo_reference: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ParsedList:
    source: str                 # takeout_csv|takeout_json|kml|zip|shared_link
    list_name: Optional[str]
    items: list[ImportItem]
    warnings: list[str]


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

_CID_RE = re.compile(r"[?&]cid=(\d+)")
_FTID_RE = re.compile(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)")


def _external_id_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    m = _CID_RE.search(url) or _FTID_RE.search(url)
    if m:
        return f"gmaps:{m.group(1)}"
    poi = gm_links.parse_place(url)
    if poi and poi.google_place_id:
        return f"gmaps:{poi.google_place_id}"
    return None


def parse_takeout_csv(text: str, list_name: Optional[str] = None) -> ParsedList:
    text = text.lstrip("﻿")
    reader = csv.DictReader(io.StringIO(text))
    items: list[ImportItem] = []
    warnings: list[str] = []
    cols = {c.strip().lower(): c for c in (reader.fieldnames or [])}
    if "title" not in cols:
        return ParsedList("takeout_csv", list_name, [], ["CSV has no 'Title' column — is this a Google Maps list export?"])
    for row in reader:
        title = (row.get(cols["title"]) or "").strip()
        if not title:
            continue
        url = (row.get(cols.get("url", ""), "") or "").strip() or None
        note = (row.get(cols.get("note", ""), "") or "").strip() or None
        tags = (row.get(cols.get("tags", cols.get("comment", "")), "") or "").strip()
        notes = "\n".join(b for b in [note, f"Tags: {tags}" if tags else None] if b) or None
        item = ImportItem(name=title, notes=notes, source_url=url, external_id=_external_id_from_url(url))
        poi = gm_links.parse_place(url) if url else None
        if poi:
            item.lat, item.lng = poi.lat, poi.lng
            item.google_place_id = poi.google_place_id
        items.append(item)
        if len(items) >= MAX_ITEMS:
            warnings.append(f"Only the first {MAX_ITEMS} rows were read.")
            break
    return ParsedList("takeout_csv", list_name, items, warnings)


def parse_takeout_json(text: str, list_name: Optional[str] = None) -> ParsedList:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return ParsedList("takeout_json", list_name, [], ["File is not valid JSON."])
    feats = data.get("features") if isinstance(data, dict) else None
    if not isinstance(feats, list):
        return ParsedList("takeout_json", list_name, [], ["JSON is not a GeoJSON FeatureCollection (expected Takeout 'Saved Places.json')."])
    items: list[ImportItem] = []
    warnings: list[str] = []
    for f in feats:
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or []
        # Takeout has used both TitleCase and snake_case keys over the years.
        loc = props.get("Location") or props.get("location") or {}
        name = (
            props.get("Title") or props.get("title") or props.get("name")
            or loc.get("Business Name") or loc.get("name") or ""
        ).strip()
        url = props.get("Google Maps URL") or props.get("google_maps_url") or None
        address = loc.get("Address") or loc.get("address") or None
        lat = lng = None
        if len(coords) >= 2:
            try:
                lng, lat = float(coords[0]), float(coords[1])
            except (TypeError, ValueError):
                pass
        geo = loc.get("Geo Coordinates") or {}
        if lat is None and geo:
            try:
                lat, lng = float(geo.get("Latitude")), float(geo.get("Longitude"))
            except (TypeError, ValueError):
                pass
        if not name and address:
            name = address
        if not name:
            continue
        comment = props.get("Comment") or props.get("comment") or None
        items.append(ImportItem(
            name=name, address=address, lat=lat, lng=lng, notes=comment,
            source_url=url, external_id=_external_id_from_url(url),
        ))
        if len(items) >= MAX_ITEMS:
            warnings.append(f"Only the first {MAX_ITEMS} features were read.")
            break
    return ParsedList("takeout_json", list_name, items, warnings)


def _local(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _find_text(el: ET.Element, name: str) -> Optional[str]:
    for child in el.iter():
        if _local(child.tag) == name and child.text and child.text.strip():
            return child.text.strip()
    return None


def parse_kml(text: str, list_name: Optional[str] = None) -> ParsedList:
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        return ParsedList("kml", list_name, [], [f"KML could not be parsed: {e}"])
    items: list[ImportItem] = []
    warnings: list[str] = []
    doc_name = None
    for el in root.iter():
        if _local(el.tag) == "Document":
            doc_name = _find_text(el, "name")
            break
    for pm in root.iter():
        if _local(pm.tag) != "Placemark":
            continue
        name = None
        desc = None
        addr = None
        coords_txt = None
        ext: dict[str, str] = {}
        for child in pm:
            t = _local(child.tag)
            if t == "name":
                name = (child.text or "").strip()
            elif t == "description":
                desc = clean_text(re.sub(r"<[^>]+>", " ", child.text or ""))
            elif t == "address":
                addr = (child.text or "").strip()
            elif t == "ExtendedData":
                for d in child.iter():
                    if _local(d.tag) == "Data":
                        k = d.get("name") or ""
                        v = _find_text(d, "value")
                        if k and v:
                            ext[k] = v
        for c in pm.iter():
            if _local(c.tag) == "coordinates" and c.text:
                coords_txt = c.text.strip()
                break
        lat = lng = None
        if coords_txt:
            first = coords_txt.split()[0]
            parts = first.split(",")
            if len(parts) >= 2:
                try:
                    lng, lat = float(parts[0]), float(parts[1])
                except ValueError:
                    pass
        if not name:
            continue
        items.append(ImportItem(
            name=name, address=addr or ext.get("address"), lat=lat, lng=lng,
            notes=ext.get("notes") or (desc if desc and desc != name else None),
            google_place_id=ext.get("google_place_id"), category=ext.get("category"),
            source_url=ext.get("source_url") or ext.get("google_maps_url"),
            external_id=ext.get("external_id"),
        ))
        if len(items) >= MAX_ITEMS:
            warnings.append(f"Only the first {MAX_ITEMS} placemarks were read.")
            break
    return ParsedList("kml", list_name or doc_name, items, warnings)


def parse_zip(data: bytes) -> ParsedList:
    items: list[ImportItem] = []
    warnings: list[str] = []
    names: list[str] = []
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        return ParsedList("zip", None, [], ["Not a valid .zip file."])
    for info in zf.infolist():
        low = info.filename.lower()
        if info.is_dir() or info.file_size > 25_000_000:
            continue
        if low.endswith((".csv", ".json", ".kml")):
            base = info.filename.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            raw = zf.read(info)
            parsed = parse_bytes(raw, info.filename)
            if parsed.items:
                names.append(base)
                # Prefix each item's notes with its list name so multi-list zips stay traceable.
                for it in parsed.items:
                    it.notes = f"[{base}] {it.notes}" if it.notes else f"[{base}]"
                items.extend(parsed.items)
            warnings.extend(f"{info.filename}: {w}" for w in parsed.warnings)
        if len(items) >= MAX_ITEMS:
            warnings.append(f"Stopped after {MAX_ITEMS} items.")
            break
    if not items and not warnings:
        warnings.append("No Maps lists found in the zip. Expected Takeout → Maps (your places).")
    return ParsedList("zip", ", ".join(names) or None, items[:MAX_ITEMS], warnings)


def parse_bytes(data: bytes, filename: str) -> ParsedList:
    low = (filename or "").lower()
    base = (filename or "").rsplit("/", 1)[-1].rsplit(".", 1)[0] or None
    if low.endswith(".zip"):
        return parse_zip(data)
    if low.endswith(".kmz"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if kml_names:
                return parse_kml(zf.read(kml_names[0]).decode("utf-8", "replace"), base)
        except zipfile.BadZipFile:
            pass
        return ParsedList("kml", base, [], ["Not a valid .kmz file."])
    text = data.decode("utf-8-sig", "replace")
    if low.endswith(".kml") or text.lstrip().startswith("<?xml") or "<kml" in text[:500]:
        return parse_kml(text, base)
    if low.endswith(".json") or text.lstrip().startswith("{"):
        return parse_takeout_json(text, base)
    return parse_takeout_csv(text, base)


# ---------------------------------------------------------------------------
# Shared list link (best-effort scrape)
# ---------------------------------------------------------------------------

_PLACE_URL_RE = re.compile(r"https://www\.google\.com/maps/place/([^\"'\\\s]+)")
_NAME_COORD_RE = re.compile(
    r'\\"([^\\"]{2,120})\\"[^\[\]]{0,200}?\[null,null,(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})\]'
)


def parse_shared_list(url: str) -> ParsedList:
    final = gm_links.expand(url)
    warnings = ["Shared-list import reads Google's public page and may miss items. Verify below."]
    fetched, html = gm_http.fetch_html(final)
    if not html:
        return ParsedList("shared_link", None, [], ["Google Maps list page could not be fetched. Use Google Takeout instead."])
    og = parse_meta(html)
    list_name = clean_text(og.get("og:title")) or None
    if list_name and " - Google" in list_name:
        list_name = list_name.split(" - Google")[0].strip()

    items: list[ImportItem] = []
    seen: set[str] = set()
    for m in _PLACE_URL_RE.finditer(html):
        u = "https://www.google.com/maps/place/" + m.group(1).replace("\\u003d", "=").replace("\\u0026", "&")
        poi = gm_links.parse_place(u)
        if not poi or not poi.name or poi.name.lower() in seen:
            continue
        seen.add(poi.name.lower())
        items.append(ImportItem(name=poi.name, lat=poi.lat, lng=poi.lng, google_place_id=poi.google_place_id,
                                source_url=u, external_id=_external_id_from_url(u)))
    if not items:
        for m in _NAME_COORD_RE.finditer(html):
            name = m.group(1).encode("utf-8").decode("unicode_escape", "ignore")
            if name.lower() in seen or name.startswith("http"):
                continue
            seen.add(name.lower())
            items.append(ImportItem(name=name, lat=float(m.group(2)), lng=float(m.group(3))))
    if not items:
        warnings.append("No places found on the list page. Export the list via Google Takeout and upload the file.")
    return ParsedList("shared_link", list_name, items[:MAX_ITEMS], warnings)


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

def resolve_items(items: list[ImportItem], *, hint: Optional[str] = None) -> list[ImportItem]:
    """Fill google_place_id / category / coords via Google Places (bounded)."""
    if not google_places.is_configured():
        for it in items:
            it.resolved = bool(it.lat is not None and it.lng is not None)
        return items
    calls = 0
    for it in items:
        if calls >= MAX_RESOLVE:
            break
        cand = None
        if it.google_place_id and not it.google_place_id.startswith("0x"):
            cand = google_places.place_details(it.google_place_id)
            calls += 1
        if cand is None:
            bias = (it.lat, it.lng) if it.lat is not None and it.lng is not None else None
            q = it.name if bias or not hint else f"{it.name} {hint}"
            res = google_places.search_text(q, location_bias=bias, radius_m=1500.0 if bias else 5000.0, max_results=1)
            calls += 1
            cand = res[0] if res else None
        if cand:
            it.google_place_id = cand.google_place_id
            it.name = it.name or cand.name
            it.address = it.address or cand.address
            it.lat = cand.lat if it.lat is None else it.lat
            it.lng = cand.lng if it.lng is None else it.lng
            it.category = it.category or cand.category
            it.photo_reference = cand.photo_reference
            it.resolved = True
        else:
            it.resolved = it.lat is not None and it.lng is not None
    return items

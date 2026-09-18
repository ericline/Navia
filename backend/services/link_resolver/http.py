"""Shared HTTP fetch for social/Maps pages. Kept in one place so tests can
monkeypatch `fetch_html` / `expand_url` and no module touches the network."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# A desktop browser UA gets the server-rendered HTML (with embedded JSON) far
# more often than the default httpx UA, which is frequently bot-blocked.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
TIMEOUT = 8.0


def expand_url(url: str) -> str:
    """Follow redirects (short links) and return the final URL. Returns the
    input on any failure."""
    try:
        with httpx.Client(follow_redirects=True, timeout=TIMEOUT, headers=_HEADERS) as c:
            r = c.head(url)
            # Some hosts reject HEAD; fall back to a GET that we don't read.
            if r.status_code >= 400:
                r = c.get(url)
            return str(r.url)
    except Exception as e:  # noqa: BLE001
        logger.info("expand_url failed for %s: %s", url, e)
        return url


def fetch_html(url: str) -> tuple[str, Optional[str]]:
    """GET a page. Returns (final_url, html or None)."""
    try:
        with httpx.Client(follow_redirects=True, timeout=TIMEOUT, headers=_HEADERS) as c:
            r = c.get(url)
            if r.status_code >= 400:
                logger.info("fetch_html %s -> %s", url, r.status_code)
                return str(r.url), None
            return str(r.url), r.text
    except Exception as e:  # noqa: BLE001
        logger.info("fetch_html failed for %s: %s", url, e)
        return url, None

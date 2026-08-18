#!/usr/bin/env python3
"""Fetch latest Polymarket prices for TI15 playoff matchups."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMMA = "https://gamma-api.polymarket.com"


def get_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "ti15-analyzer/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def parse_field(raw) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        return json.loads(raw)
    return []


def normalize_market(market: dict) -> dict:
    outcomes = parse_field(market.get("outcomes"))
    prices = [str(x) for x in parse_field(market.get("outcomePrices") or market.get("prices"))]
    return {
        "question": market.get("question") or "",
        "outcomes": outcomes,
        "prices": prices,
    }


def fetch_event(slug: str) -> dict:
    url = GAMMA + "/events?" + urllib.parse.urlencode({"slug": slug})
    rows = get_json(url)
    if not rows:
        raise RuntimeError(f"no event for slug {slug}")
    event = rows[0]
    return {
        "slug": event.get("slug") or slug,
        "title": event.get("title") or "",
        "volume": event.get("volume"),
        "markets": [normalize_market(m) for m in event.get("markets") or []],
    }


def slugs_from_playoffs() -> list[str]:
    playoffs = json.loads((ROOT / "data" / "playoffs.json").read_text())
    out = []
    for match in playoffs.get("matches") or []:
        slug = match.get("polySlug")
        if slug:
            out.append(slug)
    return out


def slugs_from_snapshot() -> list[str]:
    path = ROOT / "data" / "polymarket-playoffs.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return [e.get("slug") for e in data.get("events") or [] if e.get("slug")]


def main() -> None:
    slugs = slugs_from_playoffs() or slugs_from_snapshot()
    if not slugs:
        raise SystemExit("no polySlug in playoffs.json and no snapshot slugs")
    events = []
    for slug in slugs:
        print("fetch", slug)
        events.append(fetch_event(slug))
    payload = {
        "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": GAMMA,
        "events": events,
    }
    out = ROOT / "data" / "polymarket-playoffs.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print("wrote", out, "events", len(events), "asOf", payload["asOf"])


if __name__ == "__main__":
    main()

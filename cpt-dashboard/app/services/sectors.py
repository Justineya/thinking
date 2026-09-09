"""Sector baskets for CPT temperature S (median position score of peers)."""

from __future__ import annotations

# underlying ticker → sector key
TICKER_SECTOR: dict[str, str] = {
    "SNDK": "storage",
    "MU": "storage",
    "000660.KS": "storage",
    "STX": "storage",
    "WDC": "storage",
    "COHR": "optics",
    "AAOI": "optics",
    "AXTI": "optics",
    "CRDO": "optics",
    "RKLB": "space",
    "WOLF": "power_semi",
    "CRWV": "ai_infra",
}

SECTOR_MEMBERS: dict[str, list[str]] = {}
for _ticker, _sector in TICKER_SECTOR.items():
    SECTOR_MEMBERS.setdefault(_sector, []).append(_ticker)


def sector_of(ticker: str) -> str | None:
    return TICKER_SECTOR.get(ticker.strip().upper())


def peers_of(ticker: str) -> list[str]:
    sector = sector_of(ticker)
    if not sector:
        return [ticker.strip().upper()]
    return list(SECTOR_MEMBERS.get(sector, [ticker.strip().upper()]))

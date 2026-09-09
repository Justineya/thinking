from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf

# Limit concurrent Yahoo calls — Promise.all from the UI otherwise trips 502s.
_FETCH_SEM = threading.Semaphore(2)
_CACHE_LOCK = threading.Lock()
_BAR_CACHE: dict[tuple[str, int], tuple[float, list[dict]]] = {}
_CACHE_TTL_SEC = 5 * 60


def fetch_daily_bars(symbol: str, days: int = 30) -> list[dict]:
    """Fetch recent daily OHLCV bars. `days` is trading-day window size."""
    symbol = symbol.strip().upper()
    if not symbol:
        raise ValueError("symbol required")
    days = max(5, min(int(days), 120))
    key = (symbol, days)

    cached = _cache_get(key)
    if cached is not None:
        return cached

    last_err: Exception | None = None
    for attempt in range(3):
        try:
            bars = _download_bars(symbol, days)
            _cache_set(key, bars)
            return bars
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(0.6 * (attempt + 1))

    assert last_err is not None
    raise last_err


def _cache_get(key: tuple[str, int]) -> list[dict] | None:
    with _CACHE_LOCK:
        item = _BAR_CACHE.get(key)
        if not item:
            return None
        ts, bars = item
        if time.time() - ts > _CACHE_TTL_SEC:
            return None
        return [dict(b) for b in bars]


def _cache_set(key: tuple[str, int], bars: list[dict]) -> None:
    with _CACHE_LOCK:
        _BAR_CACHE[key] = (time.time(), [dict(b) for b in bars])


def _download_bars(symbol: str, days: int) -> list[dict]:
    period_days = min(days * 3 + 20, 400)
    with _FETCH_SEM:
        df = yf.download(
            symbol,
            period=f"{period_days}d",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=False,
        )
    if df is None or df.empty:
        # Fallback single-ticker history API
        with _FETCH_SEM:
            t = yf.Ticker(symbol)
            df = t.history(period=f"{period_days}d", auto_adjust=True)
    if df is None or df.empty:
        raise LookupError(f"no data for {symbol}")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    needed = {"Open", "High", "Low", "Close"}
    if not needed.issubset(set(df.columns)):
        raise LookupError(f"incomplete OHLCV for {symbol}")

    df = df.dropna(subset=["Open", "High", "Low", "Close"]).tail(days)
    bars: list[dict] = []
    for idx, row in df.iterrows():
        ts = pd.Timestamp(idx).to_pydatetime()
        bars.append(
            {
                "date": ts.date().isoformat(),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(float(row.get("Volume", 0) or 0)),
            }
        )
    if not bars:
        raise LookupError(f"empty bars for {symbol}")
    return bars


def cycle_score(current: float, low: float, high: float) -> float:
    if high == low:
        return 5.0
    return round(((current - low) / (high - low)) * 10, 2)


def score_label(score: float) -> str:
    if score <= 3:
        return "建仓区"
    if score <= 6:
        return "持有区"
    if score <= 8:
        return "警惕区"
    return "收获区"


def summarize_cycle(bars: list[dict]) -> dict[str, Any]:
    highs = [b["high"] for b in bars]
    lows = [b["low"] for b in bars]
    current = bars[-1]["close"]
    high = max(highs)
    low = min(lows)
    score = cycle_score(current, low, high)
    dist = None if high == 0 else round((current / high - 1) * 100, 2)
    return {
        "current": current,
        "high": high,
        "low": low,
        "score": score,
        "zone": score_label(score),
        "distanceToHighPct": dist,
        "asOf": bars[-1]["date"],
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


LEVERAGE_MAP = {
    "COHX": "COHR",
    "AAOX": "AAOI",
    "SNXX": "SNDK",
    "MULL": "MU",
    "SKUU": "000660.KS",
    "AXTY": "AXTI",
    "AXTX": "AXTI",
}

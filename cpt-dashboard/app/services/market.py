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

    # Yahoo often appends a stub daily row (OHLC all NaN, volume maybe set)
    # for the latest session before the official daily bar settles overnight.
    incomplete_dates = _incomplete_daily_dates(df)
    df = df.dropna(subset=["Open", "High", "Low", "Close"]).tail(days)
    bars: list[dict] = []
    for idx, row in df.iterrows():
        bars.append(_row_to_bar(idx, row))
    if not bars:
        raise LookupError(f"empty bars for {symbol}")

    # Backfill the latest session when daily OHLC is still unsettled.
    if incomplete_dates:
        session = _synthesize_session_bar(symbol, prefer_date=incomplete_dates[-1])
        if session is not None:
            bars = _merge_session_bar(bars, session)
    else:
        # Even without a stub row, daily feed can lag 1 session after close.
        session = _synthesize_session_bar(symbol, prefer_date=None)
        if session is not None and session["date"] > bars[-1]["date"]:
            bars = _merge_session_bar(bars, session)

    return bars[-days:]


def _incomplete_daily_dates(df: pd.DataFrame) -> list[str]:
    dates: list[str] = []
    for idx, row in df.iterrows():
        ohlc = [row.get("Open"), row.get("High"), row.get("Low"), row.get("Close")]
        if any(pd.isna(v) for v in ohlc):
            dates.append(pd.Timestamp(idx).date().isoformat())
    return dates


def _row_to_bar(idx: Any, row: pd.Series) -> dict:
    ts = pd.Timestamp(idx).to_pydatetime()
    return {
        "date": ts.date().isoformat(),
        "open": round(float(row["Open"]), 4),
        "high": round(float(row["High"]), 4),
        "low": round(float(row["Low"]), 4),
        "close": round(float(row["Close"]), 4),
        "volume": int(float(row.get("Volume", 0) or 0)),
    }


def _merge_session_bar(bars: list[dict], session: dict) -> list[dict]:
    if bars and bars[-1]["date"] == session["date"]:
        bars[-1] = session
        return bars
    return [*bars, session]


def _synthesize_session_bar(symbol: str, prefer_date: str | None) -> dict | None:
    """Build a daily bar from intraday candles or last quote when daily is lagging."""
    intra = _intraday_frame(symbol)
    if intra is not None and not intra.empty:
        by_day: dict[str, list[pd.Series]] = {}
        for idx, row in intra.iterrows():
            day = pd.Timestamp(idx).date().isoformat()
            by_day.setdefault(day, []).append(row)
        # Prefer the incomplete daily date; else newest intraday day.
        day_keys = list(by_day.keys())
        target = prefer_date if prefer_date in by_day else day_keys[-1]
        rows = by_day[target]
        opens = [float(r["Open"]) for r in rows if not pd.isna(r.get("Open"))]
        highs = [float(r["High"]) for r in rows if not pd.isna(r.get("High"))]
        lows = [float(r["Low"]) for r in rows if not pd.isna(r.get("Low"))]
        closes = [float(r["Close"]) for r in rows if not pd.isna(r.get("Close"))]
        vols = [float(r.get("Volume", 0) or 0) for r in rows]
        if opens and highs and lows and closes:
            return {
                "date": target,
                "open": round(opens[0], 4),
                "high": round(max(highs), 4),
                "low": round(min(lows), 4),
                "close": round(closes[-1], 4),
                "volume": int(sum(vols)),
            }

    quote = _last_quote(symbol)
    if quote is None:
        return None
    px, day = quote
    if prefer_date and day != prefer_date:
        # Quote day can differ by timezone; still usable if caller had a stub date.
        day = prefer_date
    return {
        "date": day,
        "open": px,
        "high": px,
        "low": px,
        "close": px,
        "volume": 0,
    }


def _intraday_frame(symbol: str) -> pd.DataFrame | None:
    with _FETCH_SEM:
        t = yf.Ticker(symbol)
        for interval in ("5m", "1m"):
            try:
                df = t.history(period="1d", interval=interval, auto_adjust=True)
            except Exception:  # noqa: BLE001
                continue
            if df is not None and not df.empty:
                return df
    return None


def _last_quote(symbol: str) -> tuple[float, str] | None:
    with _FETCH_SEM:
        t = yf.Ticker(symbol)
        px = None
        try:
            info = t.fast_info
            px = getattr(info, "last_price", None)
            if px is None:
                px = getattr(info, "lastPrice", None)
        except Exception:  # noqa: BLE001
            px = None
        if px is None:
            try:
                meta = t.info or {}
                px = meta.get("regularMarketPrice") or meta.get("currentPrice")
            except Exception:  # noqa: BLE001
                px = None
    if px is None or pd.isna(px):
        return None
    # Approximate session date in UTC; prefer_date overrides when stub exists.
    day = datetime.now(timezone.utc).date().isoformat()
    return round(float(px), 4), day


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

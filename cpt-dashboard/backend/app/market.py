from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import yfinance as yf


def fetch_daily_bars(symbol: str, days: int = 30) -> list[dict]:
    """Fetch recent daily OHLCV bars. `days` is trading-day window size."""
    symbol = symbol.strip().upper()
    if not symbol:
        raise ValueError("symbol required")
    days = max(5, min(int(days), 120))

    # Pull extra calendar days so we still have enough trading sessions.
    period_days = min(days * 3 + 20, 400)
    df = yf.download(
        symbol,
        period=f"{period_days}d",
        interval="1d",
        auto_adjust=True,
        progress=False,
        threads=False,
    )
    if df is None or df.empty:
        raise LookupError(f"no data for {symbol}")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

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


def summarize_cycle(bars: list[dict]) -> dict:
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


# Leveraged ETF -> underlying for portfolio display
LEVERAGE_MAP = {
    "COHX": "COHR",
    "AAOX": "AAOI",
    "SNXX": "SNDK",
    "MULL": "MU",
    "SKUU": "000660.KS",  # SK Hynix proxy; may be sparse via Yahoo
    "AXTY": "AXTI",
}

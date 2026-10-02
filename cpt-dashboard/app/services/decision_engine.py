from __future__ import annotations

from dataclasses import asdict, dataclass, field
from statistics import mean, median
from typing import Literal

Action = Literal[
    "试探建仓",
    "正常建仓",
    "加仓",
    "持有",
    "部分止盈",
    "明显减仓",
]

ACTION_PCT: dict[Action, float] = {
    "试探建仓": 0.10,
    "正常建仓": 0.20,
    "加仓": 0.15,
    "持有": 0.0,
    "部分止盈": 0.25,
    "明显减仓": 0.50,
}


@dataclass
class DecisionCard:
    symbol: str
    underlying: str
    action: Action
    size_pct: float  # 0.10 = 10%
    reason: str
    position_score: float | None = None
    sector_score: float | None = None
    sector_label: str | None = None
    time_progress: float | None = None  # days_since_low / avg recent upswing
    time_progress_vs_last: float | None = None
    time_progress_vs_median: float | None = None
    days_since_low: int | None = None
    t_avg_days: float | None = None
    t_last_days: float | None = None
    t_median_days: float | None = None
    t_recent_days: list[float] = field(default_factory=list)
    cycle_range_pct: float | None = None
    add_gap: float | None = None
    change_from_last_buy: float | None = None
    position_usage: float | None = None
    profit_pct: float | None = None
    failed_breakout: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        d["size_pct_display"] = f"{int(round(self.size_pct * 100))}%"
        return d


def sector_label(score: float | None) -> str:
    if score is None:
        return "未知"
    if score > 8:
        return "过热"
    if score > 6:
        return "偏热"
    if score <= 3:
        return "偏冷"
    return "正常"


def add_gap_from_range(cycle_range_pct: float) -> float:
    """Minimum drop from last buy before next add is even considered."""
    r = max(0.0, cycle_range_pct)
    if r < 0.20:
        return 0.045
    if r < 0.40:
        return 0.07
    if r < 0.60:
        return 0.10
    if r < 1.00:
        return 0.15
    return 0.20


def reduce_gap_from_range(cycle_range_pct: float) -> float:
    return max(0.05, cycle_range_pct * 0.15)


def decide(
    *,
    symbol: str,
    underlying: str,
    position_score: float,
    sector_score: float,
    time_progress: float,
    cycle_range_pct: float,
    change_from_last_buy: float | None,
    position_usage: float,
    profit_pct: float | None,
    failed_breakout: bool,
    has_position: bool,
    days_since_low: int | None = None,
    t_avg_days: float | None = None,
    t_last_days: float | None = None,
    t_median_days: float | None = None,
    t_recent_days: list[float] | None = None,
    time_progress_vs_last: float | None = None,
    time_progress_vs_median: float | None = None,
) -> DecisionCard:
    """
    Final CPT V2 output: only 6 actions.
    Internal complexity stays here; UI gets action + % + reason.
    """
    add_gap = add_gap_from_range(cycle_range_pct)
    drop = change_from_last_buy if change_from_last_buy is not None else 0.0
    usage = max(0.0, min(1.0, position_usage))
    s_label = sector_label(sector_score)
    recent = list(t_recent_days or [])

    def card(action: Action, reason: str) -> DecisionCard:
        return DecisionCard(
            symbol=symbol,
            underlying=underlying,
            action=action,
            size_pct=ACTION_PCT[action],
            reason=reason,
            position_score=round(position_score, 2),
            sector_score=round(sector_score, 2),
            sector_label=s_label,
            time_progress=round(time_progress, 2),
            time_progress_vs_last=None if time_progress_vs_last is None else round(time_progress_vs_last, 2),
            time_progress_vs_median=None if time_progress_vs_median is None else round(time_progress_vs_median, 2),
            days_since_low=days_since_low,
            t_avg_days=None if t_avg_days is None else round(t_avg_days, 1),
            t_last_days=None if t_last_days is None else round(t_last_days, 1),
            t_median_days=None if t_median_days is None else round(t_median_days, 1),
            t_recent_days=recent,
            cycle_range_pct=round(cycle_range_pct, 3),
            add_gap=round(add_gap, 3),
            change_from_last_buy=None if change_from_last_buy is None else round(change_from_last_buy, 3),
            position_usage=round(usage, 2),
            profit_pct=None if profit_pct is None else round(profit_pct, 2),
            failed_breakout=failed_breakout,
        )

    # --- High zone: take profit / cut ---
    if position_score > 8 and has_position:
        if failed_breakout or sector_score > 8 or (profit_pct is not None and profit_pct >= 20):
            why = []
            if failed_breakout:
                why.append("冲击前高失败")
            if sector_score > 8:
                why.append("板块过热")
            if profit_pct is not None and profit_pct >= 20:
                why.append(f"盈利约{profit_pct:.0f}%")
            return card("明显减仓", "；".join(why) or "高位风险抬升")
        return card("部分止盈", "进入收获区，分批兑现")

    # --- Cap: no more adds ---
    if usage >= 1.0:
        return card("持有", "仓位已打满，停止加仓，保留纪律")

    if usage >= 0.75 and position_score <= 5:
        return card("持有", "仓位使用已达75%，观望保留最后弹药")

    # --- Sector overheat: never add ---
    if sector_score > 8:
        if has_position and position_score > 5:
            return card("持有", "板块过热，停止新增，持有观察")
        return card("持有", "板块过热，停止新增")

    # --- Mid band: default hold / 观望 ---
    if position_score > 3:
        if position_score < 8:
            return card("持有", "仍在中位区，暂不新增，也不减仓")
        if not has_position:
            return card("持有", "高位空仓，不追")

    # --- Low band P <= 3 ---
    # Time progress T is informational only (shown on cards). Cycle length alone
    # does not block entries — if price is in build zone, allow buy/add by P/S/gap.
    if not has_position:
        if sector_score > 6:
            return card("试探建仓", "低位但板块偏热，仅允许试探仓")
        return card("正常建仓", "价格低位，板块未过热，建立观察仓")

    if drop < add_gap:
        need = f"{add_gap * 100:.0f}%"
        if drop < 0:
            return card("持有", f"价格高于上次买入，未形成加仓回撤（需跌≥{need}），继续观望")
        got = f"{drop * 100:.1f}%"
        return card("持有", f"尚未达到加仓间隔（已回撤{got}，需≥{need}），继续观望")

    if usage >= 0.75:
        return card("持有", "已达加仓间隔，但仓位预算仅剩极端区预留，观望")

    return card("加仓", f"低位且已满足动态间隔（≥{add_gap * 100:.0f}%），分批加仓")


def cycle_metrics_from_bars(bars: list[dict], window_days: int = 30) -> dict:
    """
    From daily bars compute:
    - position_score P (0-10) over the selected trading-day window
    - cycle_range_pct R = (high-low)/high
    - per-ticker time stats: avg / last / median / recent upswing lengths
    - time_progress = days_since_low / avg(recent upswings)
    - failed_breakout heuristic
    """
    empty = {
        "position_score": 5.0,
        "cycle_range_pct": 0.3,
        "time_progress": 0.5,
        "time_progress_vs_last": 0.5,
        "time_progress_vs_median": 0.5,
        "failed_breakout": False,
        "high": None,
        "low": None,
        "current": None,
        "window_days": window_days,
        "days_since_low": 0,
        "t_avg_days": 21.0,
        "t_last_days": 21.0,
        "t_median_days": 21.0,
        "t_recent_days": [],
        "typical_upswing_days": 21.0,
    }
    if not bars or len(bars) < 5:
        return empty

    closes = [float(b["close"]) for b in bars]
    highs = [float(b.get("high", b["close"])) for b in bars]
    lows = [float(b.get("low", b["close"])) for b in bars]
    current = closes[-1]

    win = max(5, min(int(window_days or 30), 120))
    w = bars[-win:] if len(bars) >= win else bars
    w_high = max(float(b.get("high", b["close"])) for b in w)
    w_low = min(float(b.get("low", b["close"])) for b in w)
    span = w_high - w_low
    if span <= 1e-9:
        p = 5.0
    else:
        p = max(0.0, min(10.0, (current - w_low) / span * 10))

    r = 0.0 if w_high <= 0 else (w_high - w_low) / w_high

    # Per-ticker historical upswings (each stock has its own rhythm).
    recent = _upswing_lengths(closes, lookback=252, keep=6)
    t_avg = float(mean(recent)) if recent else 21.0
    t_med = float(median(recent)) if recent else 21.0
    t_last = float(recent[-1]) if recent else 21.0
    days_since_low = _days_since_trough(closes)
    t_vs_avg = days_since_low / t_avg if t_avg > 0 else 0.5
    t_vs_last = days_since_low / t_last if t_last > 0 else 0.5
    t_vs_med = days_since_low / t_med if t_med > 0 else 0.5

    failed = _failed_breakout(closes, highs)

    return {
        "position_score": round(p, 2),
        "cycle_range_pct": round(r, 4),
        # Primary T for gates: vs this ticker's own average of recent cycles
        "time_progress": round(t_vs_avg, 3),
        "time_progress_vs_last": round(t_vs_last, 3),
        "time_progress_vs_median": round(t_vs_med, 3),
        "failed_breakout": failed,
        "high": w_high,
        "low": w_low,
        "current": current,
        "typical_upswing_days": t_avg,  # backward compatible alias
        "days_since_low": days_since_low,
        "t_avg_days": round(t_avg, 1),
        "t_last_days": round(t_last, 1),
        "t_median_days": round(t_med, 1),
        "t_recent_days": [round(x, 1) for x in recent],
        "window_days": win,
    }


def _upswing_lengths(closes: list[float], lookback: int = 252, keep: int = 6) -> list[float]:
    """Detect meaningful trough→peak lengths for this ticker; return most recent `keep`."""
    xs = closes[-lookback:] if len(closes) > lookback else closes
    if len(xs) < 30:
        return []
    # Wider window reduces noise vs 5-day local zigzags
    w = 7
    troughs: list[int] = []
    peaks: list[int] = []
    for i in range(w, len(xs) - w):
        window = xs[i - w : i + w + 1]
        if xs[i] == min(window):
            troughs.append(i)
        if xs[i] == max(window):
            peaks.append(i)
    lengths: list[float] = []
    for t in troughs:
        later = [p for p in peaks if p > t]
        if not later:
            continue
        p = later[0]
        span = p - t
        # Require both duration and magnitude so tiny chop doesn't pollute avg/last T
        if span >= 8 and xs[p] > xs[t] * 1.10:
            lengths.append(float(span))
    return lengths[-keep:] if lengths else []


def _days_since_trough(closes: list[float]) -> int:
    """Days since the most recent significant local trough (same scale as upswing detector)."""
    xs = closes[-120:] if len(closes) >= 120 else closes
    if not xs:
        return 0
    w = 7
    troughs: list[int] = []
    for i in range(w, len(xs) - w):
        window = xs[i - w : i + w + 1]
        if xs[i] == min(window):
            troughs.append(i)
    if troughs:
        abs_low = min(xs)
        candidates = [i for i in troughs if xs[i] <= abs_low * 1.05]
        i_min = (candidates or troughs)[-1]
    else:
        i_min = min(range(len(xs)), key=lambda i: xs[i])
    return len(xs) - 1 - i_min


def _failed_breakout(closes: list[float], highs: list[float]) -> bool:
    """Near prior high then fade — rough '冲顶失败'."""
    if len(closes) < 15:
        return False
    prior_high = max(highs[:-3])
    recent_high = max(highs[-10:])
    current = closes[-1]
    touched = recent_high >= prior_high * 0.98
    faded = current < prior_high * 0.95 and current < recent_high * 0.97
    return touched and faded

#!/usr/bin/env python3
"""Bankroll math: quarter-Kelly on the *current* bankroll.

Not a fixed 100. Not a fixed 10%. After a win the dollar amount can rise
because the bankroll rose; the fraction is recomputed from the *next* bet's
edge, not from the fact that you just won.
"""
from __future__ import annotations

BANKROLL0 = 1000
KELLY_FRACTION = 0.25  # Thorp: use 1/4 when p is estimated, not known
CAP = 0.05  # never more than 5% of current bankroll on one ticket
MIN_STAKE = 8  # below this, skip (noise / juice)
ODDS_GRID = [1.55, 1.60, 1.65, 1.70, 1.75, 1.80, 1.85, 1.90, 2.00]
DEFAULT_LOW_ODDS = 1.70  # typical 低保 placeholder; plug in the real price


def full_kelly(p: float, odds: float) -> float:
    """f* = (p*odds - 1) / (odds - 1). Negative => no bet."""
    if odds <= 1 or p <= 0 or p >= 1:
        return 0.0
    edge = p * odds - 1
    return max(0.0, edge / (odds - 1))


def quarter_kelly(p: float, odds: float) -> float:
    return min(CAP, full_kelly(p, odds) * KELLY_FRACTION)


def break_even_odds(p: float) -> float:
    if p <= 0:
        return 99.0
    return round(1 / p, 2)


def ticket(p: float, odds: float, bankroll: float) -> dict:
    fk = full_kelly(p, odds)
    qk = quarter_kelly(p, odds)
    ev_per_yuan = p * odds - 1
    stake = int(round(bankroll * qk))
    if qk <= 0 or ev_per_yuan <= 0:
        action = "空仓"
        stake = 0
    elif stake < MIN_STAKE:
        action = "优势太薄，空仓"
        stake = 0
    else:
        action = "下"
    win_bank = round(bankroll + stake * (odds - 1), 1) if stake else bankroll
    lose_bank = round(bankroll - stake, 1) if stake else bankroll
    return {
        "odds": odds,
        "fullKelly": round(fk, 4),
        "quarterKelly": round(qk, 4),
        "evPerYuan": round(ev_per_yuan, 4),
        "stake": stake,
        "pctOfBank": round(100 * stake / bankroll, 2) if bankroll else 0,
        "ifWin": win_bank,
        "ifLose": lose_bank,
        "evYuan": round(stake * ev_per_yuan, 1),
        "action": action,
    }


def grid_for(p: float, bankroll: float = BANKROLL0) -> list[dict]:
    return [ticket(p, o, bankroll) for o in ODDS_GRID]


def _next_live(picks: list[dict], odds: float, bank: float) -> dict | None:
    """First remaining ticket that would actually be placed at this bank."""
    running = bank
    for pick in picks:
        t = ticket(pick["modelP"], odds, running)
        if t["stake"]:
            return {
                "next": pick["pick"],
                "when": pick["when"],
                "bank": round(running, 1),
                "stake": t["stake"],
                "pctOfBank": t["pctOfBank"],
                "action": t["action"],
                "quarterKelly": t["quarterKelly"],
            }
    return None


def sequential_path(picks: list[dict], odds: float, start: float = BANKROLL0) -> dict:
    """One G1 F10K at a time; next stake uses the updated bankroll."""
    steps = []
    for pick in picks:
        t = ticket(pick["modelP"], odds, start)
        steps.append(
            {
                "id": pick["id"],
                "when": pick["when"],
                "pick": pick["pick"],
                "modelP": pick["modelP"],
                "bankBefore": start,
                **t,
            }
        )

    walk = []
    running = start
    for i, pick in enumerate(picks):
        t = ticket(pick["modelP"], odds, running)
        node = {
            "pick": pick["pick"],
            "when": pick["when"],
            "modelP": pick["modelP"],
            "bankBefore": round(running, 1),
            "stake": t["stake"],
            "pctOfBank": t["pctOfBank"],
            "quarterKelly": t["quarterKelly"],
            "action": t["action"],
            "ifWinBank": t["ifWin"],
            "ifLoseBank": t["ifLose"],
        }
        if t["stake"] == 0:
            node["nextNote"] = "空仓，本金不动，进入下一场"
            walk.append(node)
            continue
        rest = picks[i + 1 :]
        win_next = _next_live(rest, odds, t["ifWin"])
        lose_next = _next_live(rest, odds, t["ifLose"])
        if win_next:
            win_next["naiveFixed100"] = 100
            win_next["naive10pct"] = int(round(t["ifWin"] * 0.10))
        if lose_next:
            lose_next["naiveFixed100"] = 100
            lose_next["naive10pct"] = int(round(t["ifLose"] * 0.10))
        node["ifWinNext"] = win_next
        node["ifLoseNext"] = lose_next
        walk.append(node)
        # Remaining live bets depend on this outcome; shown as the fork.
        break
    return {"odds": odds, "start": start, "steps": steps, "walk": walk}


def simultaneous(picks: list[dict], odds: float, start: float = BANKROLL0) -> dict:
    """All tickets before any settle: do not ¼Kelly each on the full 1000."""
    raw = []
    for pick in picks:
        t = ticket(pick["modelP"], odds, start)
        raw.append({**pick, **t})
    total = sum(r["stake"] for r in raw)
    cap_yuan = int(round(start * 0.10))
    scale = 1.0 if total <= cap_yuan or total == 0 else cap_yuan / total
    sized = []
    for r in raw:
        stake = int(round(r["stake"] * scale)) if r["stake"] else 0
        sized.append(
            {
                "pick": r["pick"],
                "when": r["when"],
                "modelP": r["modelP"],
                "rawStake": r["stake"],
                "stake": stake,
                "action": "空仓" if stake == 0 else ("压缩后下" if scale < 0.999 else "下"),
            }
        )
    return {
        "odds": odds,
        "scale": round(scale, 3),
        "total": sum(x["stake"] for x in sized),
        "cap": cap_yuan,
        "tickets": sized,
    }


def strategy_compare(picks: list[dict], odds: float, start: float = BANKROLL0) -> list[dict]:
    """Fixed 100 / always 10% / quarter-Kelly, same prices, same model p."""
    rows = []
    for pick in picks:
        t = ticket(pick["modelP"], odds, start)
        edge = pick["modelP"] * odds - 1
        rows.append(
            {
                "pick": pick["pick"],
                "when": pick["when"],
                "modelP": pick["modelP"],
                "breakEvenOdds": break_even_odds(pick["modelP"]),
                "edgePerYuan": round(edge, 4),
                "fixed100": 100,
                "fixed100Ev": round(100 * edge, 1),
                "pct10": int(round(start * 0.10)),
                "pct10Ev": round(start * 0.10 * edge, 1),
                "qKelly": t["stake"],
                "qKellyEv": t["evYuan"],
                "qKellyPct": t["pctOfBank"],
                "fullKellyPct": round(100 * t["fullKelly"], 2),
                "action": t["action"],
            }
        )
    return rows


def resize_example(picks: list[dict], odds: float, start: float = BANKROLL0) -> dict:
    """Answer: after a win, next stake is neither still 100 nor 10%."""
    live = [p for p in picks if ticket(p["modelP"], odds, start)["stake"] > 0]
    if len(live) < 2:
        live = picks[-2:]
    first, second = live[0], live[1]
    t1 = ticket(first["modelP"], odds, start)
    win = ticket(second["modelP"], odds, t1["ifWin"])
    lose = ticket(second["modelP"], odds, t1["ifLose"])
    same_frac = (
        t1["stake"]
        and win["stake"]
        and abs(win["pctOfBank"] - t1["pctOfBank"]) < 0.2
    )
    return {
        "question": "赚了下一把还是下 100，还是下 10%？",
        "answer": "都不是。下一把 = 结算后的本金 × 下一把自己的¼Kelly。赢了只是本金变大，分数不因为刚赢了就加大。",
        "odds": odds,
        "first": {
            "pick": first["pick"],
            "when": first["when"],
            "modelP": first["modelP"],
            "bank": start,
            "stake": t1["stake"],
            "pctOfBank": t1["pctOfBank"],
            "quarterKelly": t1["quarterKelly"],
            "fullKelly": t1["fullKelly"],
            "ifWin": t1["ifWin"],
            "ifLose": t1["ifLose"],
        },
        "ifWin": {
            "bank": t1["ifWin"],
            "next": second["pick"],
            "stake": win["stake"],
            "pctOfBank": win["pctOfBank"],
            "naiveFixed100": 100,
            "naive10pct": int(round(t1["ifWin"] * 0.10)),
        },
        "ifLose": {
            "bank": t1["ifLose"],
            "next": second["pick"],
            "stake": lose["stake"],
            "pctOfBank": lose["pctOfBank"],
            "naiveFixed100": 100,
            "naive10pct": int(round(t1["ifLose"] * 0.10)),
        },
        "sameFractionAfterWin": same_frac,
        "whyNot100": "固定 100 不看优势：负期望也会下 100，优势大的也只下 100。",
        "whyNot10pct": (
            f"本金 10% 在低保 {odds:.2f}、p≈{first['modelP']:.0%} 时接近全Kelly"
            f"（全Kelly约 {round(100 * t1['fullKelly'])}%）。p 是从约 20 局估的，全Kelly会过度下注。"
        ),
    }


def build_bankroll(known: list[dict], teams: dict) -> dict:
    by_id = {s["id"]: s for s in known}

    def g1_f10(sim_id: str, side: str) -> float:
        sim = by_id.get(sim_id) or {}
        g1 = (sim.get("maps") or [{}])[0]
        key = "pF10A" if side == "A" else "pF10B"
        return float(g1.get(key) or sim.get(key) or 0.5)

    def sample_line(name: str) -> str:
        t = teams.get(name) or {}
        n = t.get("games") or 0
        got = t.get("f10k_got") or 0
        rate = t.get("f10k_rate")
        return f"本届 {got}/{n} 先到10杀（{round((rate or 0)*100)}%）"

    picks = [
        {
            "id": "ubqf1",
            "when": "8/20 10:00 G1",
            "alias": "1win / Iron Wing",
            "pick": "Iron Wing 先到 10 杀",
            "modelP": g1_f10("ubqf1", "A"),
            "sample": sample_line("Iron Wing"),
            "note": "模型只有约 54%。低保 1.70 时 p×赔率<1，期望为负——低保不等于该下。",
        },
        {
            "id": "ubqf2",
            "when": "8/20 13:00 G1",
            "alias": "PAVI / TEAM VISION",
            "pick": "TEAM VISION 先到 10 杀",
            "modelP": g1_f10("ubqf2", "A"),
            "sample": sample_line("TEAM VISION"),
            "note": "系列可以是低保，先到10杀不是。瑞士第二局 BoomBoys 先到10杀、VISION 仍赢图。",
        },
        {
            "id": "ubqf3",
            "when": "8/20 16:00 G1",
            "alias": "液体 / Team Liquid",
            "pick": "Team Liquid 先到 10 杀",
            "modelP": g1_f10("ubqf3", "A"),
            "sample": sample_line("Team Liquid"),
            "note": "四场里最站得住的10杀低保。本届先到10杀率八强最高。",
        },
        {
            "id": "ubqf4",
            "when": "8/20 19:00 G1",
            "alias": "Falcons",
            "pick": "Team Falcons 先到 10 杀",
            "modelP": g1_f10("ubqf4", "B"),
            "sample": sample_line("Team Falcons"),
            "note": "NGX 赢图不靠堆前10人头。先到10杀跟 Falcons，不要跟 NGX 系列混为一谈。",
        },
    ]
    for p in picks:
        p["modelP"] = round(p["modelP"], 3)
        p["breakEvenOdds"] = break_even_odds(p["modelP"])
        p["grid"] = grid_for(p["modelP"], BANKROLL0)
        p["atDefault"] = ticket(p["modelP"], DEFAULT_LOW_ODDS, BANKROLL0)

    return {
        "start": BANKROLL0,
        "method": "quarter-kelly-on-current-bankroll",
        "kellyFraction": KELLY_FRACTION,
        "cap": CAP,
        "minStake": MIN_STAKE,
        "defaultOdds": DEFAULT_LOW_ODDS,
        "formula": "全Kelly f* = (p×赔率 − 1) / (赔率 − 1)；实下注码 = 当前本金 × min(5%, 0.25×f*)",
        "question": "赚了下一把还是下 100，还是下 10%？",
        "answer": "都不是。下一把 = 结算后的本金 × 下一把自己的¼Kelly。赢了本金变大，金额可以略升；分数由下一把优势决定，不因为刚赢了就改成 10%。",
        "rules": [
            "不是固定 100。也不是每把都下当前本金的 10%。10% 接近全Kelly，概率是估出来的，会过度下注。",
            "每一把单独算优势。优势不同，分数不同。没优势就 0。",
            "注码 = 当前本金 × 这一把的 ¼Kelly（单票上限 5%）。赢了本金变大，下一把金额变大；输了变小。分数不因为刚赢了就加大。",
            "同一天四场按开赛顺序：一场 G1 先到10杀结算完，再用新本金算下一场。不要用同一笔 1000 同时按四场各 10% 去重仓。",
            "若开赛前就要一次下完：先各算 ¼Kelly，合计超过本金 10% 就同比例压缩。",
            "绝不输了加码翻本（马丁）。那是负期望下的破产策略。",
        ],
        "whyQuarter": [
            "Kelly 公式在 p 和赔率已知、可重复独立下注时，最大化对数财富增长。",
            "这里的 p 来自本届约 20 局/队，标准误大约 8–11 个百分点，不是已知真值。",
            "Thorp 的做法：估计概率时用 1/4 Kelly。全Kelly在估高 10 个点时会过度下注，长期增长反而更差。",
            "单票再加硬顶 5%，避免某一场「模型很满」把本金一次押进去。",
        ],
        "picks": picks,
        "compareAt170": strategy_compare(picks, 1.70),
        "resizeAt170": resize_example(picks, 1.70),
        "sequentialAt170": sequential_path(picks, 1.70),
        "sequentialAt185": sequential_path(picks, 1.85),
        "simultaneousAt170": simultaneous(picks, 1.70),
        "simultaneousAt185": simultaneous(picks, 1.85),
    }


def _self_check() -> None:
    # p=0.65, decimal 1.70 → f* = (1.105-1)/0.70 = 0.15; ¼Kelly = 0.0375
    assert abs(full_kelly(0.65, 1.70) - 0.15) < 1e-9
    assert abs(quarter_kelly(0.65, 1.70) - 0.0375) < 1e-9
    t = ticket(0.65, 1.70, 1000)
    assert t["stake"] == 38
    assert t["action"] == "下"
    # negative EV → skip, including a "low-odds favorite"
    assert ticket(0.54, 1.70, 1000)["stake"] == 0
    # after a win, dollars tick up; fraction stays ~3.75% if the next edge is the same
    t2 = ticket(0.65, 1.70, t["ifWin"])
    assert t2["stake"] in {38, 39}  # 1026.6 * 0.0375 ≈ 38.5
    assert abs(t2["pctOfBank"] - t["pctOfBank"]) < 0.2
    assert t2["stake"] != 100
    assert t2["stake"] < int(round(t["ifWin"] * 0.10))
    # cap: huge edge still 5%
    assert quarter_kelly(0.80, 2.00) == CAP
    assert ticket(0.80, 2.00, 1000)["stake"] == 50
    print("stake_plan self-check ok")


if __name__ == "__main__":
    _self_check()

#!/usr/bin/env python3
"""Build web/data/bundle.json from games.json + polymarket snapshot."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EIGHT = [
    "TEAM VISION",
    "Team Liquid",
    "Nigma Galaxy",
    "Team Spirit",
    "Iron Wing",
    "Team Falcons",
    "BoomBoys",
    "Team Yandex",
]


def series_price(markets: dict, title_sub: str) -> dict | None:
    for event in markets["events"]:
        if title_sub not in (event.get("title") or ""):
            continue
        for market in event["markets"]:
            question = market["question"]
            if "(BO3)" in question and "Game" not in question:
                return {
                    "outcomes": market["outcomes"],
                    "prices": [float(x) for x in market["prices"]],
                    "volume": event.get("volume"),
                    "slug": event["slug"],
                }
    return None


def team_profile(games: list[dict], name: str) -> dict:
    mine = []
    for game in games:
        if name in (game["radiant"], game["dire"]):
            side = "radiant" if game["radiant"] == name else "dire"
            mine.append((game, side))
    n = len(mine)
    wins = sum(1 for game, _ in mine if game["winner"] == name)
    f10k_got = sum(1 for game, side in mine if game.get("f10k") and game["f10k"]["side"] == side)
    f10k_mid = sum(
        1
        for game, side in mine
        if game.get("f10k") and game["f10k"]["side"] == side and game.get("f10k_by_mid")
    )
    mid_k = sum((game["sides"][side]["mid"]["kills_before_10"] or 0) for game, side in mine)
    ms_k = sum((game["sides"][side].get("first10_mid_sup_kills") or 0) for game, side in mine)
    driven = sum(1 for game, side in mine if game["sides"][side].get("mid_sup_driven"))
    mids = Counter(game["sides"][side]["mid"]["hero"] for game, side in mine)
    pos4s = Counter(game["sides"][side]["pos4"]["hero"] for game, side in mine)
    pace = Counter(game["pace"] for game, _ in mine)
    stance = Counter(game["stance"] for game, _ in mine)
    duration = sum(game["duration"] for game, _ in mine) / n
    f10k_times = [
        game["f10k"]["time"]
        for game, side in mine
        if game.get("f10k") and game["f10k"]["side"] == side
    ]
    return {
        "name": name,
        "games": n,
        "wins": wins,
        "winrate": round(wins / n, 3),
        "f10k_got": f10k_got,
        "f10k_rate": round(f10k_got / n, 3),
        "f10k_by_mid": f10k_mid,
        "avg_mid_kills_in_first10": round(mid_k / n, 2),
        "avg_mid_sup_kills_in_first10": round(ms_k / n, 2),
        "mid_sup_driven_rate": round(driven / n, 3),
        "avg_duration_min": round(duration / 60, 1),
        "avg_f10k_time_when_got_s": round(sum(f10k_times) / len(f10k_times), 0) if f10k_times else None,
        "mids": mids.most_common(5),
        "pos4s": pos4s.most_common(5),
        "pace": dict(pace),
        "stance": dict(stance),
    }


def h2h(games: list[dict], team_a: str, team_b: str) -> list[dict]:
    return [game for game in games if {game["radiant"], game["dire"]} == {team_a, team_b}]


def main() -> None:
    games = json.loads((ROOT / "data" / "games.json").read_text())["games"]
    markets = json.loads((ROOT / "data" / "polymarket-playoffs.json").read_text())
    series = [
        {
            "id": "ubqf1",
            "teamA": "Iron Wing",
            "teamB": "Team Spirit",
            "when": "8/20 10:00 CST",
            "poly": series_price(markets, "Iron Wing vs Team Spirit"),
            "insight": "本届无直接交手。两边中单都爱 Earth Spirit。Spirit 的 F10K 0 次由 Larl 收刀，中单更多是对线资源而不是前10杀收割者。IW 前10杀中单出手更少（0.94），F10K 一半靠其他位置。市场接近均势，适合看 G1 中辅是否先开。",
        },
        {
            "id": "ubqf2",
            "teamA": "TEAM VISION",
            "teamB": "BoomBoys",
            "when": "8/20 13:00 CST",
            "poly": series_price(markets, "TEAM VISION vs BoomBoys"),
            "insight": "瑞士轮 VISION 2-0，两局都慢。No[o]ne 前10杀场均 2.1 刀，中辅驱动 90%，是八强里最明显的中辅轴。BoomBoys 中单（gpk）自己也能收 F10K，但系列里第一局 F10K 是 MieRo 的 Enigma。市场 80% 给系列，-1.5 接近 50%，跟系列、慎追 2-0。",
        },
        {
            "id": "ubqf3",
            "teamA": "Team Liquid",
            "teamB": "Team Yandex",
            "when": "8/20 16:00 CST",
            "poly": series_price(markets, "Team Liquid vs Team Yandex"),
            "insight": "瑞士轮 Liquid 2-1。三局 F10K 分别是 m1CKe、tOfu、CHIRA_JUNIOR，只有一局是中单收刀。Nisha 本届 Earth Spirit 5 次。市场只给 Liquid 54.5%，和 H2H 不完全同向，信心应偏低。",
        },
        {
            "id": "ubqf4",
            "teamA": "Nigma Galaxy",
            "teamB": "Team Falcons",
            "when": "8/20 19:00 CST",
            "poly": series_price(markets, "Nigma Galaxy vs Team Falcons"),
            "insight": "本届无直接交手。NGX 瑞士战绩更好（80%），F10K 拿到率 60%，但中辅驱动只有 40%——他们的前10杀更散。Falcons F10K 58.8%，Malr1ne 场均 1.65 刀更像中单轴。市场 65.5% 给 Falcons，是名气/卫冕溢价，对 NGX 中辅是否能打出同框是关键。",
        },
    ]
    for item in series:
        item["h2hIds"] = [game["match_id"] for game in h2h(games, item["teamA"], item["teamB"])]
        item["profileA"] = team_profile(games, item["teamA"])
        item["profileB"] = team_profile(games, item["teamB"])

    bundle = {
        "asOf": "2026-08-17",
        "note": "只覆盖八强在 TI15 的 80 局。F10K=第10个英雄击杀。中辅驱动=该队中单+两个辅助在前10杀里合计至少3刀。",
        "teams": {name: team_profile(games, name) for name in EIGHT},
        "series": series,
        "games": games,
    }
    out = ROOT / "web" / "data" / "bundle.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False))
    print("wrote", out, "bytes", out.stat().st_size)


if __name__ == "__main__":
    main()

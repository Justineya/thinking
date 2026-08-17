#!/usr/bin/env python3
"""Derive First-10-Kills (第10个英雄击杀归属) from an OpenDota parsed match.

Valve / Liquipedia do not store F10K as a native field. This is a betting-derived
stat. If OpenDota has parsed the replay, players[].kills_log is enough.

Usage:
  python3 scripts/f10k.py 8948533452
"""
from __future__ import annotations

import json
import sys
import urllib.request


def fetch_match(match_id: int) -> dict:
    req = urllib.request.Request(
        f"https://api.opendota.com/api/matches/{match_id}",
        headers={"User-Agent": "TI15Analyzer/0.1"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def first_10_kills(match: dict) -> dict:
    events = []
    for player in match.get("players") or []:
        side = "radiant" if player.get("isRadiant") else "dire"
        for kill in player.get("kills_log") or []:
            key = str(kill.get("key") or "")
            if not key.startswith("npc_dota_hero_"):
                continue
            events.append(
                {
                    "time": int(kill["time"]),
                    "side": side,
                    "victim": key,
                    "killer_hero_id": player.get("hero_id"),
                    "killer_slot": player.get("player_slot"),
                }
            )
    events.sort(key=lambda e: (e["time"], e["killer_slot"] or 0))
    if len(events) < 10:
        return {
            "ok": False,
            "reason": "fewer_than_10_hero_kills",
            "hero_kills_logged": len(events),
            "parsed": match.get("version") is not None,
        }
    tenth = events[9]
    same_second = [e for e in events if e["time"] == tenth["time"]]
    rad = sum(1 for e in events[:10] if e["side"] == "radiant")
    return {
        "ok": True,
        "match_id": match.get("match_id"),
        "radiant": match.get("radiant_name"),
        "dire": match.get("dire_name"),
        "f10k_side": tenth["side"],
        "f10k_team": match.get("radiant_name") if tenth["side"] == "radiant" else match.get("dire_name"),
        "tenth_kill_time_s": tenth["time"],
        "split_after_10": {"radiant": rad, "dire": 10 - rad},
        "ambiguous_same_second": len(same_second) > 1,
        "tenth_kill": tenth,
        "definition": "第10个英雄击杀归属，不是先到10杀",
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: f10k.py <match_id>", file=sys.stderr)
        sys.exit(2)
    match_id = int(sys.argv[1])
    result = first_10_kills(fetch_match(match_id))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

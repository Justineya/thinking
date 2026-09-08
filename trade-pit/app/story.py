from __future__ import annotations

import re
from datetime import date


def draft_from_story(story: str) -> dict:
    """Turn a freeform oral story into a pit draft (title/rule/tags/severity)."""
    text = " ".join(story.strip().split())
    if not text:
        raise ValueError("故事是空的")

    title = _title(text)
    rule = _rule(text)
    tags = _tags(text)
    severity = _severity(text)
    cost = _cost(text)

    return {
        "title": title[:80],
        "what_happened": story.strip()[:2000],
        "cost_note": cost[:500],
        "rule": rule[:200],
        "tags": tags[:120],
        "severity": severity,
        "pinned": True,
    }


def _title(text: str) -> str:
    if re.search(r"过山车", text):
        if re.search(r"\+?\s*7|7\s*个点|百分之\s*七", text) and re.search(r"\+?\s*5|5\s*个点", text):
            return "夜盘+7过山车，+5还追"
        return "过山车行情里动手"
    if re.search(r"追", text) and re.search(r"加仓|追进|追高", text):
        return "浮盈时追进去"
    if re.search(r"割肉|砍仓", text):
        return "恐慌割肉"
    if re.search(r"抄底", text):
        return "抄底抄早了"
    # first clause
    chunk = re.split(r"[。！？\n]", text)[0].strip()
    if len(chunk) > 24:
        chunk = chunk[:24] + "…"
    return chunk or f"口述翻车 · {date.today().isoformat()}"


def _rule(text: str) -> str:
    # Specific patterns first
    if re.search(r"夜盘|盘前", text) and re.search(r"追|加仓", text):
        return "夜盘浮盈不是加仓许可。没有盘前计划，浮盈≥5%时不许再追、不许加仓。"
    if re.search(r"追(涨|高|进)|追进去", text):
        return "手痒想追的那一刻，先空手看完一根完整 K 线再决定。"
    if re.search(r"利空|消息|恐慌|割", text):
        return "没有事先写好的止损位，就不许因为标题党或盘感割肉。"
    if re.search(r"补仓|抄底", text):
        return "下跌趋势里不加仓；只允许在预设价位分批，不许临时改计划。"
    if re.search(r"满仓|踏空", text):
        return "没有交易计划就不许临时满仓；踏空不等于必须追。"
    return "下次同样场景出现时，先停手 10 分钟，对照计划再下单；没有计划就不许动。"


def _tags(text: str) -> str:
    mapping = [
        (r"美股|纳斯达克|标普", "美股"),
        (r"夜盘", "夜盘"),
        (r"盘前", "盘前"),
        (r"追|追涨|追高", "追涨"),
        (r"加仓", "加仓"),
        (r"过山车", "过山车"),
        (r"割肉|砍仓", "割肉"),
        (r"抄底|补仓", "抄底"),
        (r"满仓", "满仓"),
    ]
    found = []
    for pat, tag in mapping:
        if re.search(pat, text) and tag not in found:
            found.append(tag)
    return ",".join(found[:6])


def _severity(text: str) -> int:
    if re.search(r"全仓|过山车|爆|穿仓|大亏", text):
        return 5
    if re.search(r"追|加仓|割肉", text):
        return 4
    return 3


def _cost(text: str) -> str:
    if re.search(r"过山车", text):
        return "冲高浮盈回吐，追进去后更被动"
    if re.search(r"亏|回撤|转绿|回落", text):
        return "浮盈回吐 / 情绪磨损"
    return ""

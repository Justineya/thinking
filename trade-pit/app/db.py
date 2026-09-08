from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "pits.db"

SEED_PITS = [
    {
        "title": "一买就跌，一卖就涨",
        "what_happened": "追涨买入后立刻回撤；恐慌割肉后行情立刻拉回。",
        "cost_note": "手续费 + 情绪磨损，账户数字反复打脸",
        "rule": "手痒想追的那一刻，先空手看完一根完整 K 线再决定。",
        "tags": "追涨,杀跌,情绪",
        "severity": 5,
        "pinned": 1,
    },
    {
        "title": "利空一出就交筹码",
        "what_happened": "看到利空/群消息慌了，市价砍仓；刚卖完就开始拉。",
        "cost_note": "洗掉的是我，不是主力",
        "rule": "没有事先写好的止损位，就不许因为标题党割肉。",
        "tags": "恐慌,消息,割肉",
        "severity": 5,
        "pinned": 1,
    },
    {
        "title": "抄底抄在半山腰",
        "what_happened": "以为跌够了加仓，下面还有地下室。",
        "cost_note": "越补越套",
        "rule": "下跌趋势里不加仓；只允许在预设价位分批，不许临时改计划。",
        "tags": "抄底,补仓",
        "severity": 4,
        "pinned": 1,
    },
]


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS pits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                what_happened TEXT NOT NULL,
                cost_note TEXT NOT NULL DEFAULT '',
                rule TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '',
                severity INTEGER NOT NULL DEFAULT 3,
                pinned INTEGER NOT NULL DEFAULT 0,
                repeat_count INTEGER NOT NULL DEFAULT 1,
                acknowledged_count INTEGER NOT NULL DEFAULT 0,
                last_acknowledged_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reviewed_at TEXT NOT NULL,
                pit_count INTEGER NOT NULL,
                note TEXT NOT NULL DEFAULT ''
            );
            """
        )
        count = conn.execute("SELECT COUNT(*) AS c FROM pits").fetchone()["c"]
        if count == 0:
            now = _now()
            for item in SEED_PITS:
                conn.execute(
                    """
                    INSERT INTO pits (
                        title, what_happened, cost_note, rule, tags,
                        severity, pinned, repeat_count, acknowledged_count,
                        last_acknowledged_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)
                    """,
                    (
                        item["title"],
                        item["what_happened"],
                        item["cost_note"],
                        item["rule"],
                        item["tags"],
                        item["severity"],
                        item["pinned"],
                        now,
                        now,
                    ),
                )


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return dict(row)


def list_pits(*, pinned_first: bool = True) -> list[dict]:
    order = "pinned DESC, severity DESC, updated_at DESC" if pinned_first else "updated_at DESC"
    with _connect() as conn:
        rows = conn.execute(f"SELECT * FROM pits ORDER BY {order}").fetchall()
    return [dict(r) for r in rows]


def get_pit(pit_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM pits WHERE id = ?", (pit_id,)).fetchone()
    return _row_to_dict(row)


def create_pit(payload: dict) -> dict:
    now = _now()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO pits (
                title, what_happened, cost_note, rule, tags,
                severity, pinned, repeat_count, acknowledged_count,
                last_acknowledged_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)
            """,
            (
                payload["title"],
                payload["what_happened"],
                payload.get("cost_note", ""),
                payload["rule"],
                payload.get("tags", ""),
                int(payload.get("severity", 3)),
                1 if payload.get("pinned") else 0,
                now,
                now,
            ),
        )
        pit_id = cur.lastrowid
    return get_pit(pit_id)  # type: ignore[return-value]


def update_pit(pit_id: int, payload: dict) -> dict | None:
    existing = get_pit(pit_id)
    if not existing:
        return None
    now = _now()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE pits SET
                title = ?, what_happened = ?, cost_note = ?, rule = ?, tags = ?,
                severity = ?, pinned = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                payload.get("title", existing["title"]),
                payload.get("what_happened", existing["what_happened"]),
                payload.get("cost_note", existing["cost_note"]),
                payload.get("rule", existing["rule"]),
                payload.get("tags", existing["tags"]),
                int(payload.get("severity", existing["severity"])),
                1 if payload.get("pinned", existing["pinned"]) else 0,
                now,
                pit_id,
            ),
        )
    return get_pit(pit_id)


def bump_repeat(pit_id: int) -> dict | None:
    existing = get_pit(pit_id)
    if not existing:
        return None
    now = _now()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE pits SET
                repeat_count = repeat_count + 1,
                severity = MIN(5, severity + 1),
                pinned = 1,
                updated_at = ?
            WHERE id = ?
            """,
            (now, pit_id),
        )
    return get_pit(pit_id)


def acknowledge_pit(pit_id: int) -> dict | None:
    existing = get_pit(pit_id)
    if not existing:
        return None
    now = _now()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE pits SET
                acknowledged_count = acknowledged_count + 1,
                last_acknowledged_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (now, now, pit_id),
        )
    return get_pit(pit_id)


def delete_pit(pit_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM pits WHERE id = ?", (pit_id,))
        return cur.rowcount > 0


def complete_review(pit_count: int, note: str = "") -> dict:
    now = _now()
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO reviews (reviewed_at, pit_count, note) VALUES (?, ?, ?)",
            (now, pit_count, note),
        )
        review_id = cur.lastrowid
        row = conn.execute("SELECT * FROM reviews WHERE id = ?", (review_id,)).fetchone()
    return dict(row)


def latest_review() -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM reviews ORDER BY reviewed_at DESC LIMIT 1"
        ).fetchone()
    return _row_to_dict(row)


def stats() -> dict:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) AS pinned,
                COALESCE(SUM(repeat_count), 0) AS repeats,
                COALESCE(SUM(acknowledged_count), 0) AS acknowledged
            FROM pits
            """
        ).fetchone()
    latest = latest_review()
    return {
        "total": row["total"] or 0,
        "pinned": row["pinned"] or 0,
        "repeats": row["repeats"] or 0,
        "acknowledged": row["acknowledged"] or 0,
        "latest_review": latest,
    }

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from app.config import DB_PATH, DATA_DIR, RECORDS_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    region TEXT NOT NULL,
    institution TEXT,
    record_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT,
    file_path TEXT,
    extracted_text TEXT,
    notes TEXT,
    metadata_json TEXT,
    tags TEXT
);

CREATE INDEX IF NOT EXISTS idx_records_visit_date ON records(visit_date DESC);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


async def insert_record(row: dict[str, Any]) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO records (
                created_at, visit_date, region, institution, record_type,
                title, file_name, file_path, extracted_text, notes,
                metadata_json, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row.get("created_at", _now_iso()),
                row["visit_date"],
                row["region"],
                row.get("institution"),
                row["record_type"],
                row["title"],
                row.get("file_name"),
                row.get("file_path"),
                row.get("extracted_text"),
                row.get("notes"),
                json.dumps(row.get("metadata") or {}, ensure_ascii=False),
                row.get("tags"),
            ),
        )
        await db.commit()
        return cursor.lastrowid


async def list_records(limit: int = 200) -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT id, created_at, visit_date, region, institution,
                   record_type, title, file_name, notes, tags,
                   substr(extracted_text, 1, 300) AS text_preview
            FROM records
            ORDER BY visit_date DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_record(record_id: int) -> dict[str, Any] | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM records WHERE id = ?", (record_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        data = dict(row)
        if data.get("metadata_json"):
            data["metadata"] = json.loads(data["metadata_json"])
        return data


async def search_records(query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Simple keyword search for RAG context."""
    raw = query.strip()
    terms = [t.strip() for t in raw.replace("，", " ").split() if t.strip()]
    # Also try stripping common question suffixes for Chinese queries
    for suffix in ("怎么样", "如何", "多少", "是什么", "有没有", "吗", "呢"):
        if raw.endswith(suffix) and len(raw) > len(suffix) + 1:
            terms.append(raw[: -len(suffix)])
    if raw and raw not in terms:
        terms.insert(0, raw)

    if not terms:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT id, visit_date, region, institution, record_type,
                       title, extracted_text, notes
                FROM records
                ORDER BY visit_date DESC
                LIMIT ?
                """,
                (limit,),
            )
            return [dict(row) for row in await cursor.fetchall()]

    clauses = []
    params: list[Any] = []
    for term in terms[:6]:
        like = f"%{term}%"
        clauses.append(
            "(title LIKE ? OR institution LIKE ? OR extracted_text LIKE ? OR notes LIKE ? OR tags LIKE ?)"
        )
        params.extend([like, like, like, like, like])

    where = " OR ".join(clauses)
    sql = f"""
        SELECT id, visit_date, region, institution, record_type,
               title, extracted_text, notes
        FROM records
        WHERE {where}
        ORDER BY visit_date DESC
        LIMIT ?
    """
    params.append(limit)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(sql, params)
        return [dict(row) for row in await cursor.fetchall()]

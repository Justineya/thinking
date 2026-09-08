from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db

ROOT = Path(__file__).resolve().parents[1]
STATIC = Path(__file__).resolve().parent / "static"

app = FastAPI(title="谨记 · 炒股坑本", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


class PitIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    what_happened: str = Field(min_length=1, max_length=2000)
    cost_note: str = Field(default="", max_length=500)
    rule: str = Field(min_length=4, max_length=200)
    tags: str = Field(default="", max_length=120)
    severity: int = Field(default=3, ge=1, le=5)
    pinned: bool = True


class PitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    what_happened: str | None = Field(default=None, min_length=1, max_length=2000)
    cost_note: str | None = Field(default=None, max_length=500)
    rule: str | None = Field(default=None, min_length=4, max_length=200)
    tags: str | None = Field(default=None, max_length=120)
    severity: int | None = Field(default=None, ge=1, le=5)
    pinned: bool | None = None


class ReviewIn(BaseModel):
    pit_ids: list[int] = Field(default_factory=list)
    note: str = Field(default="", max_length=300)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/api/stats")
def api_stats() -> dict:
    return db.stats()


@app.get("/api/pits")
def api_list_pits() -> list[dict]:
    return db.list_pits()


@app.post("/api/pits")
def api_create_pit(body: PitIn) -> dict:
    return db.create_pit(body.model_dump())


@app.patch("/api/pits/{pit_id}")
def api_update_pit(pit_id: int, body: PitUpdate) -> dict:
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    pit = db.update_pit(pit_id, data)
    if not pit:
        raise HTTPException(404, "坑不存在")
    return pit


@app.post("/api/pits/{pit_id}/again")
def api_bump(pit_id: int) -> dict:
    pit = db.bump_repeat(pit_id)
    if not pit:
        raise HTTPException(404, "坑不存在")
    return pit


@app.post("/api/pits/{pit_id}/ack")
def api_ack(pit_id: int) -> dict:
    pit = db.acknowledge_pit(pit_id)
    if not pit:
        raise HTTPException(404, "坑不存在")
    return pit


@app.delete("/api/pits/{pit_id}")
def api_delete(pit_id: int) -> dict:
    if not db.delete_pit(pit_id):
        raise HTTPException(404, "坑不存在")
    return {"ok": True}


@app.post("/api/review/complete")
def api_review(body: ReviewIn) -> dict:
    for pit_id in body.pit_ids:
        db.acknowledge_pit(pit_id)
    return db.complete_review(pit_count=len(body.pit_ids), note=body.note)


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8766, reload=False)


if __name__ == "__main__":
    main()

# CPT Dashboard · 周期位置交易（MVP v2）

基于你上传的 **CPT FastAPI Backend**（async + PostgreSQL），并保留 Yahoo 行情与单页前端。

## 架构

```
Frontend (index.html)
        │ REST
        ▼
FastAPI (async SQLAlchemy + asyncpg)
  Portfolio / Cycle / Watchlist / Market
        │
        ▼
PostgreSQL
  portfolio_holdings · cycle_scores · watchlist
```

评分公式：`score = (current - low) / (high - low) * 10`  
分区：`build` ≤3 · `hold` ≤6 · `warning` ≤8 · `harvest` >8

## 启动

```bash
cd cpt-dashboard
cp .env.example .env
# 需要 PostgreSQL（本地或 docker compose up -d db）
bash start.sh
```

打开 http://127.0.0.1:8787/ · Docs http://127.0.0.1:8787/docs

一键：`docker compose up`

## API（与上传包对齐并增强）

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/portfolio` | 新增/按 symbol 更新持仓 |
| GET | `/api/portfolio` | 持仓 + 市值/盈亏/周期分 |
| PATCH/DELETE | `/api/portfolio/{id}` | 改 / 删 |
| PUT | `/api/cycle` | 手写 upsert 行情快照 |
| POST | `/api/cycle/refresh` | Yahoo 拉取观察池+持仓并写库 |
| GET | `/api/cycle?zone=build` | 周期筛选 |
| GET | `/api/cycle/{ticker}` | 单票评分（缺省可 `refresh=true`） |
| GET/POST/DELETE | `/api/watchlist` | 观察池 |
| GET | `/api/market/bars` | K 线（图表用） |

## 设计说明

上传包把行情写入与评分解耦（`PUT /api/cycle`）。本仓库额外提供 `POST /api/cycle/refresh`，用 Yahoo 填 `cycle_scores`，这样 Cycle Scanner 开箱可用。以后可换成 Polygon / 富途夜盘适配器，只改 refresh，前端不变。

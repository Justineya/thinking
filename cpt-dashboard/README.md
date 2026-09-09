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

## 执行决策 V2

内部计算：价格位置 P、时间进度 T、周期振幅 R、加仓间隔 G、板块温度 S。  
最终每只股票只输出一张卡：

- 动作：试探建仓 / 正常建仓 / 加仓 / 持有 / 部分止盈 / 明显减仓
- 比例：买入相对目标仓位，卖出相对当前持仓
- 理由：一句话

`GET /api/decision/cards` · 观望并入「持有 0%」（默认状态）。

本机先启动 **FutuOpenD**（默认 `127.0.0.1:11111`），在富途 App 建自定义自选分组（默认名 `CPT`），然后：

```bash
# .env
FUTU_OPEND_HOST=127.0.0.1
FUTU_OPEND_PORT=11111
FUTU_TRD_ENV=REAL
FUTU_WATCHLIST_GROUP=CPT
# 若 OpenD 要求解锁交易才可读持仓：
# FUTU_UNLOCK_PASSWORD=你的解锁密码
```

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/futu/status` | OpenD 连通性 |
| GET | `/api/futu/positions` | 预览富途持仓 |
| POST | `/api/futu/portfolio/sync` | 同步持仓入库（可 `replace`） |
| GET | `/api/futu/watchlist/groups` | 自选分组 |
| GET | `/api/futu/watchlist?group=CPT` | 读富途自选 |
| POST | `/api/futu/watchlist/add` | 加自选（可同时写富途 App + CPT 观察池） |
| POST | `/api/futu/watchlist/import` | 把富途分组导入 CPT |

前端持仓区有「从富途同步持仓 / 加自选」。**CPT 后端需与 OpenD 同机**（或能访问 OpenD 端口）；云端 Demo 连不到你家里的 OpenD。


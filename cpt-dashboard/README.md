# CPT Dashboard · 周期位置交易仪表盘（MVP v2）

单文件前端 + FastAPI + **SQLite/Postgres**。只做周期位置评分，不含 MACD / MA / RSI。

## 架构

```
Next.js/HTML Dashboard  →  FastAPI  →  PostgreSQL / SQLite
                         Portfolio / Market / Cycle / Watchlist
```

**目标数据库是 PostgreSQL**。未设置 `DATABASE_URL` 时回退到本地 SQLite（`data/cpt.db`），方便无 Docker 试跑。

## 公式

```
score = (current - low) / (high - low) * 10
```

| 分数 | 分区 | zone 参数 |
|------|------|-----------|
| 0–3 | 建仓区 | `build` |
| >3–6 | 持有区 | `hold` |
| >6–8 | 警惕区 | `warning` |
| >8–10 | 收获区 | `harvest` |

## 启动

```bash
cd cpt-dashboard
bash start.sh
```

打开 http://127.0.0.1:8787/

### PostgreSQL（推荐）

```bash
cp .env.example .env
docker compose up -d db
# .env 已含 DATABASE_URL=postgresql+psycopg2://cpt:cpt@127.0.0.1:5432/cpt
bash start.sh
```

或一键：`docker compose up`（api + db）。

健康检查会回传数据库方言：`GET /api/health` → `"db":"postgresql"`。

## API

### 持仓（数据库）

- `GET /api/portfolio` — 列表（含市值/盈亏/底层周期分）
- `POST /api/portfolio` — 新增或按 symbol 更新
- `DELETE /api/portfolio/{id}`

```json
POST /api/portfolio
{
  "symbol": "COHX",
  "underlying": "COHR",
  "shares": 270,
  "cost_price": 25.35
}
```

### 观察池

- `GET /api/watchlist`
- `POST /api/watchlist` `{ "ticker": "WOLF" }`
- `DELETE /api/watchlist/{ticker}`

### 周期评分

- `GET /api/cycle/COHR?days=30`
- `GET /api/cycle/filter?zone=build|hold|warning|harvest|all`

### 行情

- `GET /api/market/bars?symbol=COHR&days=30`（Yahoo 代理，前端不放 Key）

## 前端（V2）

- 持仓 **入库**，不再用 localStorage
- Cycle Scanner：分区筛选 + 搜索（评分低→高）
- ECharts 价格曲线 / 0–10 仪表盘 / 四区热力图
- 杠杆映射：COHX→COHR、AAOX→AAOI、SNXX→SNDK、MULL→MU

## 表结构

- `portfolio` — 真实持仓（symbol / underlying / shares / cost_price）
- `watchlist` — 周期观察池
- `cycle_score_cache` — 评分缓存（默认 TTL 5 分钟）
- `market_snapshot` — 预留

## 下一阶段（V3）

- Sidebar 多页：Dashboard / Portfolio / Watchlist / Cycle Scanner / Settings
- AI Explain（「为什么 SNXX 是 9 分」）
- **冲顶失败** 标记 + 周期雷达

# CPT Dashboard · 周期位置交易仪表盘

单文件前端 + FastAPI 行情代理。**只做周期位置评分**，不含 MACD / MA / RSI。

## 公式

```
score = (current - low) / (high - low) * 10
```

| 分数 | 分区 |
|------|------|
| 0–3 | 建仓区 |
| >3–6 | 持有区 |
| >6–8 | 警惕区 |
| >8–10 | 收获区 |

## 启动

```bash
cd cpt-dashboard
bash start.sh
```

打开 http://127.0.0.1:8787/

Windows 可双击 `start.bat`。

## API

### `GET /api/market/bars?symbol=COHR&days=30`

```json
{
  "symbol": "COHR",
  "days": 30,
  "bars": [
    {
      "date": "2026-08-03",
      "open": 280.5,
      "high": 291.2,
      "low": 276.8,
      "close": 287.4,
      "volume": 5200000
    }
  ]
}
```

当前后端用 **Yahoo Finance** 代理（前端不放 API Key）。以后可换成 Polygon，路径保持不变。

### `GET /api/cycle/COHR?days=30`

返回现价、高低、评分、分区。

## 前端能力（V2）

- 15 / 30 交易日切换
- ECharts 价格曲线 + 高低标记线
- 0–10 周期仪表盘
- 自选表 + **分区筛选** + **代码搜索**（评分低→高）
- Treemap 四区热力图
- **持仓管理**：持仓代码 / 底层代码 / 股数 / 成本；市值与浮动盈亏；底层周期分；localStorage 持久化
- 杠杆映射自动填充：COHX→COHR、AAOX→AAOI、SNXX→SNDK、MULL→MU
- 可配置 API Base

预设观察池（正股）：COHR / AAOI / AXTI / WOLF / CRDO / SNDK / MU / RKLB / CRWV  
（对应你杠杆仓：COHX→COHR、AAOX→AAOI、SNXX→SNDK 等）

# TI15 淘汰赛分析台

The International 2026 淘汰赛分析产品。当前是产品设计页 + 数据快照，还不是完整赛评引擎。

**样本：只做八强在 TI15 打过的比赛。** 淘汰队互打和赛前历史不做参考。

## 本地打开

```bash
cd ti15-analyzer/web
python3 -m http.server 4173
```

浏览器访问 http://localhost:4173

首十杀推导（需本机出网）：

```bash
python3 ti15-analyzer/scripts/f10k.py 8948533452
```

## 数据

- [PRODUCT.md](PRODUCT.md) — 产品理解
- [data/playoffs.json](data/playoffs.json) — 八强与 8/20 对阵
- [data/scope.json](data/scope.json) — 80 局进 / 29 局丢
- [data/polymarket-playoffs.json](data/polymarket-playoffs.json) — 四场 BO3 市场快照

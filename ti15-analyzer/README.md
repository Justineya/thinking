# TI15 淘汰赛分析台

The International 2026 淘汰赛分析。主入口是逐场分析页：八强在 TI15 的 80 局，每局看 BP、节奏、F10K（中单）、中辅联动。

**样本：只做八强在 TI15 打过的比赛。** 淘汰队互打和赛前历史不做参考。

## 本地打开

```bash
cd ti15-analyzer/web
python3 -m http.server 4173
```

浏览器访问 http://localhost:4173/analysis.html 看逐场分析。

首十杀推导（需本机出网）：

```bash
python3 ti15-analyzer/scripts/f10k.py 8948533452
```

## 数据

- [web/analysis.html](web/analysis.html) — **逐场分析（主入口）**
- [PRODUCT.md](PRODUCT.md) — 产品理解
- [data/games.json](data/games.json) — 80 局结构化四镜头
- [web/data/bundle.json](web/data/bundle.json) — 网页用的队伍画像 + 四场预览

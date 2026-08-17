# TI15 淘汰赛分析台

The International 2026 淘汰赛分析产品。当前仓库里是**产品设计页**，还不是完整赛评引擎。

## 本地打开

直接打开网页：

```bash
cd ti15-analyzer/web
python3 -m http.server 4173
```

浏览器访问 http://localhost:4173

## 部署

`web/` 是纯静态文件，可丢到 GitHub Pages、Cloudflare Pages 或任意静态托管。根目录选 `ti15-analyzer/web`。

## 文档

- [PRODUCT.md](PRODUCT.md) — 产品理解、数据接口、待确认项
- [data/playoffs.json](data/playoffs.json) — 八强、队名别名、8/20 对阵

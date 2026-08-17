# TI15 淘汰赛分析台

主入口：八强在 TI15 的 80 局逐场分析。

**不要点 GitHub 上的 `analysis.html` 源码页**，那只是代码，浏览器不会当网站跑。

## 线上地址（Cloudflare）

已部署到 Cloudflare Workers（免费）：

**https://ti15-playoff-analyzer.pale-belt.workers.dev**

第一次打开可能有 Cloudflare 人机验证，勾一下就能进。首页就是逐场分析。

### 请在 60 分钟内认领，否则会消失

没有登录 Cloudflare 账号时，这是临时预览账号。打开下面这个链接，用免费 Cloudflare 账号登录/注册，点 Claim，网站就会留在你的账号里：

https://dash.cloudflare.com/claim-preview?claimToken=vCoOAS3XXA_ZYhKsXjh3E702-zYINS-rtLywm9IJjKA

认领后仍是免费套餐，不需要绑信用卡。

本机以后若要更新站点（需已认领或提供 `CLOUDFLARE_API_TOKEN`）：

```bash
cd ti15-analyzer
npx wrangler deploy
```

## 备用打开方式

电脑上下载仓库后，双击 `ti15-analyzer/web/index.html` 或 `analysis.html` 也可以（已经不需要本地服务器）。

单文件版：`ti15-analyzer/web/standalone.html`

## 数据

- [web/index.html](web/index.html) — 逐场分析（站点首页）
- [web/analysis.html](web/analysis.html) — 同一页
- [web/design.html](web/design.html) — 产品设计
- [web/standalone.html](web/standalone.html) — 单文件版
- [PRODUCT.md](PRODUCT.md) — 产品理解

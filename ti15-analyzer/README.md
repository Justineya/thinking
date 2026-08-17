# TI15 淘汰赛分析台

主入口：八强在 TI15 的 80 局逐场分析 + 淘汰赛四天对阵图 + 每局至少 5 次 BP 模拟。

**不要点 GitHub 上的 `analysis.html` 源码页**，那只是代码，浏览器不会当网站跑。

## 线上地址

当前 Cloudflare Workers 预览：

**https://ti15-playoff-analyzer.ambiguous-shock.workers.dev**

这不是自动长期的。预览账号必须在创建后约 1 小时内用免费 Cloudflare 账号认领，认领后才长期留在你的账号里（免费套餐，一般不用绑卡）。没认领就会消失。

认领（约 1 小时内有效）：

https://dash.cloudflare.com/claim-preview?claimToken=yGJPvVlE06PiLqqFyun-WXa_zx6a7WHZzRM53TP0ECg

第一次打开可能有人机验证。

## 复制到你自己的网站

整站是静态文件，把 `ti15-analyzer/web/` 这个目录原样上传即可，不需要后端。

里面至少要有：

- `index.html`（首页）
- `analysis.html` / `design.html`
- `styles.css`
- `analysis.js`
- `data.js`（数据已打进这个文件）

常见做法：

1. 你现有的站点：把上述文件拷进任意子目录，例如 `https://你的域名/ti15/`
2. Cloudflare Pages：登录后拖拽 `web/` 文件夹，或 `npx wrangler pages deploy ti15-analyzer/web --project-name ti15-analyzer`
3. Netlify / Vercel：同样只发布 `web/` 目录
4. 本机：双击 `web/index.html`

更新数据后在仓库里跑：

```bash
python3 ti15-analyzer/scripts/ingest_games.py
python3 ti15-analyzer/scripts/simulate_playoffs.py
python3 ti15-analyzer/scripts/build_bundle.py
```

然后再上传 `web/`，或 `cd ti15-analyzer && npx wrangler deploy`。

## 口径

- 先到 10 杀：哪支队伍先获得 10 次英雄击杀
- 参与次数 = 击杀 + 助攻（助攻用同一波团战估算）
- 预测只用本届 80 局，不用 TI 之前的历史

## 数据

- [web/index.html](web/index.html) — 对阵 / 预测 / 逐场
- [web/design.html](web/design.html) — 产品设计
- [PRODUCT.md](PRODUCT.md) — 产品理解

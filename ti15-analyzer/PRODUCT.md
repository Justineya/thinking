# TI15 淘汰赛分析台 · 产品理解

日期：2026-08-17  
范围：The International 2026（TI15）淘汰赛  
形态：可部署网页，而不是每次打开 Cursor 看一篇长评

本文是设计评审稿。完整排版见 [`web/index.html`](web/index.html)。

## 1. 看法

- 做成站的理由：淘汰赛只有四天，队名、瑞士成绩、BP、Bo3/Bo5 会连续变化。价值在「同一套数据 + 同一套模型」刷新，而不是重写文章。
- 不要做第二个液体百科。百科负责事实；本产品负责交手画像 → 英雄池 → 模拟 BP → 系列胜率 → 竞猜决策。
- 竞猜模块克制：输出系列倾向、地图分、信心区间、「不该追的场次」。不爬非法博彩盘口，不写「稳胆」。
- 最大数据坑：队名漂移。PARIVISION → TEAM VISION，BetBoom → BoomBoys，Tundra → 1w → Iron Wing。H2H 主键必须是 `team_id` + 五人组。

## 2. 页面

1. 总览 / 双败图
2. 系列预览（核心）
3. 队伍 / 选手
4. 7.41e Meta
5. 竞猜面板
6. 赛后复盘与校准

## 3. 数据接口

| 层 | 源 | 用途 | 本期 |
| --- | --- | --- | --- |
| 赛程事实 | Liquipedia MediaWiki parse / 官方 v3 | 对阵、时间、阵容、改名 | parse 已验证（必须 Gzip + UA）；v3 需 Key |
| 比赛细节 | OpenDota REST + explorer | H2H、英雄池、本届 `leagueid=19719` | **已打通，P1 主力** |
| 深度解析 | STRATZ GraphQL | 完整 BP 顺序、视野、赛况 | 需 Token |
| 版本对照 | OpenDota heroStats；D2PT 只人工看 | 7.41e 优先度 | 不爬 D2PT |

Steam leagueid：`19719`。八强 OpenDota team_id 见 `data/playoffs.json`。

Liquipedia 能用，而且必须用；但它给不了「怎么打」。完整分析要叠 OpenDota（必须）和 STRATZ（加深 BP）。

## 4. 8/20 胜者组首轮

- 10:00 CST Iron Wing vs Team Spirit
- 13:00 TEAM VISION vs BoomBoys
- 16:00 Team Liquid vs Team Yandex
- 19:00 Nigma Galaxy vs Team Falcons

## 5. 需要确认后再做真分析页

1. 先做 8/20 四场，还是八强全量一起上
2. 有没有 Liquipedia v3 Key / STRATZ Token
3. 竞猜口径：默认系列胜负 + 地图分；让分只给「模型是否覆盖」

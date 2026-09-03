# 个人健康档案

本地优先：**随手记症状** + 偶尔补化验/就诊记录，AI 按**你自己的时间线**综合分析。港深跨境就医场景友好。

> 仅供个人整理与健康咨询参考，不替代医生面诊。

## 功能（Phase 1 · 个人自用）

- **症状日记**：像闲聊一样记「今天胃胀、打嗝…」
- **综合分析**：跨多条症状 + 报告做时间线梳理
- **上传报告（可选）**：PDF / 文本
- **一键综合分析**：`POST /api/analyze/summary`

## 快速开始

```bash
git clone <你的新仓库地址>
cd <仓库名>

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# 编辑 .env，填入 LLM_API_KEY（通义 / DeepSeek / OpenAI 兼容）

python -m app.main
```

必须在 **`health-archive/` 目录内**运行（不要在仓库根目录跑）。

浏览器打开：<http://127.0.0.1:8765>

登录页：<http://127.0.0.1:8765/login>

默认账号 **admin** / 密码 **vitaring**（可在 `.env` 的 `APP_PASSWORD` 修改）。

或使用一键脚本：

```bash
bash scripts/setup.sh
```

## 数据存储

| 路径 | 说明 |
|------|------|
| `data/records/` | 上传的原始文件 |
| `data/health.db` | SQLite 索引与正文 |

**切勿**将 `data/`、`.env` 提交到 git。换机时备份整个 `data/` 目录。

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/journal` | 记一条症状 |
| POST | `/api/records` | 上传报告 |
| GET | `/api/records` | 时间轴列表 |
| POST | `/api/ask` | 提问分析 |
| POST | `/api/analyze/summary` | 一键综合分析 |

## 架构

```
浏览器 → FastAPI → SQLite（你的数据）
              ↓
         大模型 API（.env 里的 Key，仅服务端）
```

- **不要**把 LLM Key 写进前端
- **不要**用 Cursor Agent 做网页实时分析（见 [docs/CURSOR_AUTOMATION.md](docs/CURSOR_AUTOMATION.md) 仅作可选批处理）

## 文档

- [给新 Cursor Agent 的交接指令（复制粘贴）](docs/AGENT_HANDOFF.md)
- [从本目录迁到新仓库](docs/SPIN_OUT.md)
- [多人 / 家庭共享路线图](docs/ROADMAP.md)
- [Cursor Automation 批处理（可选）](docs/CURSOR_AUTOMATION.md)

## 技术栈

FastAPI · SQLite · 单页 HTML（无前端构建）

## 后续

见 [docs/ROADMAP.md](docs/ROADMAP.md)

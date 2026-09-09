# VitaRing / Vita360

本地个人健康档案：**随手记症状** + 可选化验报告 + AI 按你自己的时间线分析。

> 仅供个人整理参考，不替代医生面诊。

## Windows 最快启动

1. 安装 [Python 3.11+](https://www.python.org/downloads/)（安装时勾选 **Add python.exe to PATH**）
2. 双击仓库里的 `start.bat`
3. 浏览器打开 http://127.0.0.1:8765/login
4. 账号 **admin**　密码 **vitaring**

不要打开 GitHub 网页当 App 用（GitHub Pages 跑不了登录和数据库）。

## Mac / Linux

```bash
cd Vita360-    # 或本仓库根目录
bash start.sh
```

## 手动启动

```bash
python -m pip install -r requirements.txt
copy .env.example .env     # Mac/Linux: cp .env.example .env
python -m app.main
```

必须在**本仓库根目录**运行（能看到 `app/` 和 `start.bat` 的那一层）。

## 登录说明

| 项 | 值 |
|----|-----|
| 地址 | http://127.0.0.1:8765/login |
| 用户名 | `admin` |
| 密码 | `vitaring` |

改密码：编辑 `.env` 里的 `APP_PASSWORD`，保存后重启 `start.bat`。

## 功能

- 症状日记（像闲聊一样写）
- 时间轴
- AI 综合分析（需在 `.env` 填 `LLM_API_KEY`）
- 可选上传 PDF 报告

## 数据

保存在本机 `data/`，不要提交到 git。

## 文档

- [登录页模板](docs/LOGIN_TEMPLATE.md)
- [路线图](docs/ROADMAP.md)


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

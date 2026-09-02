# 个人健康档案（Phase 1）

本地优先的个人健康档案：**随手记症状**（像闲聊）+ 偶尔补化验/就诊记录，AI 按**你自己的时间线**综合分析。

> 仅供个人整理与健康咨询参考，不替代医生面诊。

## 功能（第一期）

- **症状日记**：随手写「今天胃胀、打嗝…」，默认当天
- **综合分析**：跨多条症状 + 化验/就诊记录做梳理（如「最近肠胃怎么回事」）
- **上传报告（可选）**：PDF / 文本化验单、处方
- 时间轴浏览；关键词检索 + LLM（OpenAI 兼容 API）

## 快速开始

```bash
cd health-archive
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入 LLM_API_KEY（通义/DeepSeek/OpenAI 等）

python -m app.main
```

浏览器打开：<http://127.0.0.1:8765>

## 数据存在哪

- 原始文件：`data/records/`
- 索引与正文：`data/health.db`（SQLite，本地）

**不要**把 `data/` 提交到 git；换电脑用备份整个 `health-archive/data` 目录。

## 典型用法

1. **不舒服时**：打开「记症状」，两三句话记下（比打开豆包强在：会存档、能跨天看）
2. **攒一周后**：点「最近症状梳理」，或问「胃相关症状出现过几次」
3. **看完病**：偶尔把 PDF/关键数值补进「上传报告」，分析时会和症状日记对照

## 后续（产品化前）

- [ ] 图片 OCR（繁简）
- [ ] 检验项结构化（项目名、数值、单位、参考范围）
- [ ] 港深单位换算表
- [ ] 导出复诊摘要 PDF
- [ ] 可选加密与同步（NAS / 私有云）

## 技术栈

FastAPI + SQLite + 单页 HTML，无前端构建。

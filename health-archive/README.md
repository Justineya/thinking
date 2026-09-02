# 个人健康档案（Phase 1）

本地优先的个人病历库：上传港深诊疗记录，按时间轴查看，用 AI 基于**你自己的档案**做摘要与对比。

> 仅供个人整理与健康咨询参考，不替代医生面诊。

## 功能（第一期）

- 上传 PDF / 文本 / 图片（图片 Phase 1 靠备注补关键信息，OCR 后续加）
- 按就诊日期、地区（港/深）、类型归档
- 时间轴浏览
- 关键词检索 + LLM 问答（OpenAI 兼容 API）

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

## 建议用法

1. 每次看完病，当天上传报告 PDF + 填就诊日期和地区
2. 化验单若扫图不清楚，在「备注」里手打关键数值
3. 复诊前问：「给消化科医生的摘要」「近两次肝功能对比」

## 后续（产品化前）

- [ ] 图片 OCR（繁简）
- [ ] 检验项结构化（项目名、数值、单位、参考范围）
- [ ] 港深单位换算表
- [ ] 导出复诊摘要 PDF
- [ ] 可选加密与同步（NAS / 私有云）

## 技术栈

FastAPI + SQLite + 单页 HTML，无前端构建。

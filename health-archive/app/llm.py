from openai import OpenAI

from app.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

SYSTEM_PROMPT = """你是个人健康档案助手，只根据用户提供的病历摘录回答问题。

规则：
1. 仅基于摘录内容回答；信息不足时明确说「档案里没有相关记录」。
2. 不做确诊、不开药、不替代医生面诊。
3. 涉及趋势对比时，列出日期和具体数值（若摘录中有）。
4. 港深两地报告单位可能不同，对比时提醒核对单位。
5. 回答简洁，用中文。"""


def build_context(records: list[dict]) -> str:
    if not records:
        return "（当前档案库为空）"

    blocks: list[str] = []
    for r in records:
        body = (r.get("extracted_text") or r.get("notes") or "").strip()
        if len(body) > 2500:
            body = body[:2500] + "\n…（截断）"
        blocks.append(
            f"""---
记录 #{r.get('id')}
就诊日期: {r.get('visit_date')}
地区: {r.get('region')}
机构: {r.get('institution') or '未填'}
类型: {r.get('record_type')}
标题: {r.get('title')}
内容:
{body or '（无正文，仅有标题/备注）'}
"""
        )
    return "\n".join(blocks)


def ask_llm(question: str, records: list[dict]) -> str:
    if not LLM_API_KEY:
        return (
            "未配置 LLM_API_KEY。请复制 .env.example 为 .env 并填入 API 密钥后重启服务。\n\n"
            f"已检索到 {len(records)} 条相关记录，可在时间轴中查看。"
        )

    client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    context = build_context(records)

    response = client.chat.completions.create(
        model=LLM_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"档案摘录：\n{context}\n\n用户问题：{question}",
            },
        ],
    )
    return response.choices[0].message.content or ""

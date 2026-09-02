const regionLabel = { HK: "香港", SZ: "深圳", OTHER: "其他" };
const typeLabel = {
  lab: "化验",
  imaging: "影像",
  prescription: "处方",
  visit: "门诊",
  other: "其他",
};

async function loadTimeline() {
  const list = document.getElementById("timeline");
  list.innerHTML = "<li>加载中…</li>";
  const res = await fetch("/api/records");
  const data = await res.json();
  if (!data.records.length) {
    list.innerHTML = "<li>暂无记录，先上传一份报告。</li>";
    return;
  }
  list.innerHTML = data.records
    .map(
      (r) => `
    <li>
      <div class="title">${escapeHtml(r.title)}</div>
      <div class="meta">${r.visit_date} · ${regionLabel[r.region] || r.region} · ${typeLabel[r.record_type] || r.record_type}${r.institution ? " · " + escapeHtml(r.institution) : ""}</div>
      ${r.text_preview ? `<div class="preview">${escapeHtml(r.text_preview)}</div>` : ""}
    </li>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

document.getElementById("upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("upload-msg");
  msg.textContent = "上传中…";
  const form = e.target;
  const body = new FormData(form);
  const res = await fetch("/api/records", { method: "POST", body });
  const data = await res.json();
  if (!res.ok) {
    msg.textContent = data.detail || "上传失败";
    return;
  }
  msg.textContent = `已保存 #${data.id}，提取 ${data.extracted_chars} 字`;
  form.reset();
  loadTimeline();
});

document.getElementById("ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const answerEl = document.getElementById("answer");
  const sourcesEl = document.getElementById("sources");
  answerEl.textContent = "分析中…";
  sourcesEl.innerHTML = "";
  const body = new FormData(e.target);
  const res = await fetch("/api/ask", { method: "POST", body });
  const data = await res.json();
  if (!res.ok) {
    answerEl.textContent = data.detail || "请求失败";
    return;
  }
  answerEl.textContent = data.answer;
  if (data.sources?.length) {
    sourcesEl.innerHTML = data.sources
      .map((s) => `<li>#${s.id} ${s.visit_date} ${escapeHtml(s.title)} (${s.region})</li>`)
      .join("");
  }
});

document.getElementById("refresh-btn").addEventListener("click", loadTimeline);
loadTimeline();

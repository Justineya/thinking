const $ = (sel, root = document) => root.querySelector(sel);

const pinnedRules = $("#pinned-rules");
const pitList = $("#pit-list");
const statsLine = $("#stats-line");
const pitDialog = $("#pit-dialog");
const pitForm = $("#pit-form");
const reviewDialog = $("#review-dialog");
const reviewCard = $("#review-card");
const reviewProgress = $("#review-progress");
const toastEl = $("#toast");

let pits = [];
let reviewQueue = [];
let reviewIndex = 0;
let reviewAcked = [];

function toast(msg) {
  toastEl.hidden = false;
  toastEl.textContent = msg;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

function severityLabel(n) {
  return `痛感 ${"●".repeat(n)}${"○".repeat(5 - n)}`;
}

function renderRules() {
  const pinned = pits.filter((p) => p.pinned);
  const source = pinned.length ? pinned : pits.slice(0, 5);
  if (!source.length) {
    pinnedRules.innerHTML = `<p class="empty">还没有铁律。亏过一次就记一条，别靠脑子。</p>`;
    return;
  }
  pinnedRules.innerHTML = source
    .map(
      (p, i) => `
      <article class="rule-banner" style="animation-delay:${i * 0.05}s">
        <div class="idx">RULE ${String(i + 1).padStart(2, "0")}</div>
        <p class="text">${escapeHtml(p.rule)}</p>
        <div class="sev">${severityLabel(p.severity)} · 再犯 ${p.repeat_count}</div>
      </article>`
    )
    .join("");
}

function renderPits() {
  if (!pits.length) {
    pitList.innerHTML = `<p class="empty">账本是空的。去记你第一口坑。</p>`;
    return;
  }
  pitList.innerHTML = pits
    .map(
      (p) => `
    <article class="pit" data-id="${p.id}">
      <div class="pit-top">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="badges">
          ${p.pinned ? `<span class="badge hot">钉墙</span>` : ""}
          <span class="badge hot">再犯 ×${p.repeat_count}</span>
          <span class="badge">${severityLabel(p.severity)}</span>
          ${
            p.tags
              ? p.tags
                  .split(",")
                  .filter(Boolean)
                  .map((t) => `<span class="badge">${escapeHtml(t.trim())}</span>`)
                  .join("")
              : ""
          }
        </div>
      </div>
      <p>${escapeHtml(p.what_happened)}</p>
      ${p.cost_note ? `<p>代价：${escapeHtml(p.cost_note)}</p>` : ""}
      <p class="iron"><span>铁律</span>${escapeHtml(p.rule)}</p>
      <div class="pit-actions">
        <button type="button" class="ghost" data-act="again">又踩了一次</button>
        <button type="button" class="ghost" data-act="pin">${p.pinned ? "取消钉墙" : "钉上铁律墙"}</button>
        <button type="button" class="ghost" data-act="ack">今日已读</button>
        <button type="button" class="ghost" data-act="del">删除</button>
      </div>
    </article>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function refresh() {
  const [list, stats] = await Promise.all([api("/api/pits"), api("/api/stats")]);
  pits = list;
  renderRules();
  renderPits();
  const latest = stats.latest_review?.reviewed_at
    ? `上次诵读 ${stats.latest_review.reviewed_at.replace("T", " ").slice(0, 16)}`
    : "尚未做过开盘前诵读";
  statsLine.textContent = `铁律 ${stats.pinned} · 坑位 ${stats.total} · 累计再犯 ${stats.repeats} · 确认 ${stats.acknowledged} · ${latest}`;
}

function openDialog(el) {
  if (!el) return;
  if (typeof el.showModal === "function") {
    if (!el.open) el.showModal();
  } else {
    el.setAttribute("open", "");
  }
}

function closeDialog(el) {
  if (!el) return;
  if (typeof el.close === "function") el.close();
  else el.removeAttribute("open");
}

$("#btn-new").addEventListener("click", (e) => {
  e.preventDefault();
  pitForm.reset();
  pitForm.pinned.checked = true;
  pitForm.severity.value = 4;
  openDialog(pitDialog);
  requestAnimationFrame(() => pitForm.title.focus());
});

$("#pit-cancel").addEventListener("click", (e) => {
  e.preventDefault();
  closeDialog(pitDialog);
});

pitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(pitForm);
  const rule = String(fd.get("rule") || "").trim();
  if (rule.length < 4) {
    toast("铁律太短，写到自己下次能照做。");
    return;
  }
  const payload = {
    title: String(fd.get("title") || "").trim(),
    what_happened: String(fd.get("what_happened") || "").trim(),
    cost_note: String(fd.get("cost_note") || "").trim(),
    rule,
    tags: String(fd.get("tags") || "").trim(),
    severity: Number(fd.get("severity") || 3),
    pinned: Boolean(fd.get("pinned")),
  };
  await api("/api/pits", { method: "POST", body: JSON.stringify(payload) });
  closeDialog(pitDialog);
  toast("已盖章。这条会钉在开盘前。");
  await refresh();
});

pitList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".pit");
  const id = Number(card.dataset.id);
  const act = btn.dataset.act;
  if (act === "again") {
    await api(`/api/pits/${id}/again`, { method: "POST", body: "{}" });
    toast("再犯已记账，痛感加重，重新钉墙。");
  } else if (act === "pin") {
    const pit = pits.find((p) => p.id === id);
    await api(`/api/pits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: !pit.pinned }),
    });
  } else if (act === "ack") {
    await api(`/api/pits/${id}/ack`, { method: "POST", body: "{}" });
    toast("记下了。别只点按钮，进场时真照做。");
  } else if (act === "del") {
    if (!confirm("确定删掉这个坑？删了就少一条提醒。")) return;
    await api(`/api/pits/${id}`, { method: "DELETE" });
  }
  await refresh();
});

function startReview() {
  const pinned = pits.filter((p) => p.pinned);
  reviewQueue = pinned.length ? pinned : pits.slice(0, 8);
  if (!reviewQueue.length) {
    toast("没有可诵读的铁律。");
    return;
  }
  reviewIndex = 0;
  reviewAcked = [];
  showReviewCard();
  openDialog(reviewDialog);
}

function showReviewCard() {
  const p = reviewQueue[reviewIndex];
  reviewProgress.textContent = `第 ${reviewIndex + 1} / ${reviewQueue.length} 条 · 跳过等于没看`;
  reviewCard.innerHTML = `
    <div class="kicker">OPEN BELL · 谨记</div>
    <p class="rule">${escapeHtml(p.rule)}</p>
    <p class="title">来自坑：${escapeHtml(p.title)} · 再犯 ×${p.repeat_count}</p>
  `;
}

$("#btn-review").addEventListener("click", (e) => {
  e.preventDefault();
  startReview();
});
$("#review-skip").addEventListener("click", (e) => {
  e.preventDefault();
  closeDialog(reviewDialog);
});

$("#review-ack").addEventListener("click", async (e) => {
  e.preventDefault();
  const current = reviewQueue[reviewIndex];
  reviewAcked.push(current.id);
  if (reviewIndex < reviewQueue.length - 1) {
    reviewIndex += 1;
    showReviewCard();
    return;
  }
  await api("/api/review/complete", {
    method: "POST",
    body: JSON.stringify({ pit_ids: reviewAcked, note: "开盘前诵读" }),
  });
  closeDialog(reviewDialog);
  toast(`今日诵读完成：${reviewAcked.length} 条铁律`);
  await refresh();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (pitDialog.open) closeDialog(pitDialog);
  if (reviewDialog.open) closeDialog(reviewDialog);
});

refresh().catch((err) => {
  console.error(err);
  toast("加载失败，确认本地服务已启动");
});

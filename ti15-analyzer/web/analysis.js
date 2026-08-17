const EIGHT = new Set([
  "TEAM VISION",
  "Team Liquid",
  "Nigma Galaxy",
  "Team Spirit",
  "Iron Wing",
  "Team Falcons",
  "BoomBoys",
  "Team Yandex",
]);

const pct = (n) => `${Math.round(n * 100)}%`;
const mmss = (s) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

function gameCard(g) {
  const f = g.f10k || {};
  const f10kTag = g.f10k_by_mid ? "中单收刀" : "非中单收刀";
  return `<article class="game">
    <div class="game-top">
      <div>
        <strong>${g.radiant}</strong> ${g.score?.[0] ?? ""} — ${g.score?.[1] ?? ""} <strong>${g.dire}</strong>
        <div class="foot-note">胜者 ${g.winner} · ${Math.floor(g.duration / 60)} 分钟 · ${g.pace} / ${g.stance}</div>
      </div>
      <div>
        <span class="tag ${g.f10k_by_mid ? "hot" : ""}">${f10kTag}</span>
        <a href="${g.opendota}" target="_blank" rel="noopener">OpenDota</a>
      </div>
    </div>
    <div class="lenses">
      <div><h4>BP 思路</h4><p>天辉：${g.blurb.bp.radiant}<br>夜魇：${g.blurb.bp.dire}</p></div>
      <div><h4>节奏 · 前中期攻防</h4><p>${g.blurb.pace}<br>攻防标签：${g.blurb.stance}。15分钟经济差 ${g.gold?.m15 ?? "?"}。一塔 ${g.first_tower ? mmss(g.first_tower.time) + " 由" + (g.first_tower.taker === "radiant" ? "天辉" : "夜魇") + "拆掉" : "未见T1记录"}。</p></div>
      <div><h4>F10K · 盯中单</h4><p>${g.blurb.f10k}<br>第10杀 ${f.killer || "?"} / ${f.killer_hero || "?"} · ${mmss(f.time)} · 比分 ${f.split ? f.split.radiant + "-" + f.split.dire : "?"}<br>中单前10杀出手：${g.sides.radiant.mid.player} ${g.sides.radiant.mid.hero} ${g.sides.radiant.mid.kills_before_10} 刀；${g.sides.dire.mid.player} ${g.sides.dire.mid.hero} ${g.sides.dire.mid.kills_before_10} 刀。</p></div>
      <div><h4>中辅联动</h4><p>${g.blurb.mid_support}</p></div>
    </div>
  </article>`;
}

function profileBox(p) {
  const mids = (p.mids || []).map((x) => x[0]).slice(0, 3).join(" / ");
  return `<div class="profile">
    <h3>${p.name}</h3>
    <p>本届 ${p.wins}/${p.games}（${pct(p.winrate)}）· 场均 ${p.avg_duration_min} 分钟</p>
    <p>拿到 F10K <b>${pct(p.f10k_rate)}</b>，其中中单收刀 ${p.f10k_by_mid}/${p.f10k_got}</p>
    <p>中单前10杀场均 <b>${p.avg_mid_kills_in_first10}</b> · 中辅合计 <b>${p.avg_mid_sup_kills_in_first10}</b> · 中辅驱动 ${pct(p.mid_sup_driven_rate)}</p>
    <p>中单常用 ${mids || "—"}</p>
  </div>`;
}

function polyLine(s) {
  if (!s.poly) return "暂无市场快照";
  const [a, b] = s.poly.prices;
  return `Polymarket 系列 ${s.poly.outcomes[0]} ${pct(a)} / ${s.poly.outcomes[1]} ${pct(b)}`;
}

function render(data, mode) {
  const app = document.getElementById("app");
  const byId = Object.fromEntries(data.games.map((g) => [g.match_id, g]));

  if (mode === "series") {
    app.innerHTML = data.series
      .map((s) => {
        const h2h = (s.h2hIds || []).map((id) => byId[id]).filter(Boolean);
        return `<section class="series-block">
          <div class="series-head">
            <h2>${s.teamA} vs ${s.teamB}</h2>
            <div class="poly">${s.when} · ${polyLine(s)}</div>
          </div>
          <p class="insight">${s.insight}</p>
          <div class="compare">${profileBox(s.profileA)}${profileBox(s.profileB)}</div>
          <h3>本届直接交手</h3>
          ${h2h.length ? h2h.map(gameCard).join("") : '<p class="empty">本届无直接交手，上面是各自 80 局里的中单/F10K 画像。</p>'}
        </section>`;
      })
      .join("");
    return;
  }

  let list = data.games;
  if (EIGHT.has(mode)) {
    list = data.games.filter((g) => g.radiant === mode || g.dire === mode);
  }
  list = [...list].sort((a, b) => b.start_time - a.start_time);
  app.innerHTML = `<p class="section-lead">${list.length} 局 · 按时间倒序</p>` + list.map(gameCard).join("");
}

function setup(data) {
  const filters = document.getElementById("filters");
  const buttons = [
    ["series", "8/20 四场"],
    ["all", "全部 80 局"],
    ...Object.keys(data.teams).map((n) => [n, n]),
  ];
  let mode = "series";
  const paint = () => {
    for (const btn of filters.querySelectorAll("button")) {
      btn.classList.toggle("on", btn.dataset.mode === mode);
    }
    render(data, mode === "all" ? "all" : mode);
  };
  filters.innerHTML = buttons
    .map(([id, label]) => `<button type="button" data-mode="${id}">${label}</button>`)
    .join("");
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    mode = btn.dataset.mode;
    paint();
  });
  paint();
}

fetch("./data/bundle.json")
  .then((r) => r.json())
  .then(setup)
  .catch((err) => {
    document.getElementById("app").textContent = "无法加载 bundle.json，请从 web/ 目录启动本地服务。 " + err;
  });

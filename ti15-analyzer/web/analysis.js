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
  const f10kTag = g.f10k ? `先到10杀 ${g.f10k.side === "radiant" ? g.radiant : g.dire}` : "未到10杀";
  const score = g.f10k?.score;
  return `<article class="game">
    <div class="game-top">
      <div>
        <strong>${g.radiant}</strong> ${g.score?.[0] ?? ""} — ${g.score?.[1] ?? ""} <strong>${g.dire}</strong>
        <div class="foot-note">胜者 ${g.winner} · ${Math.floor(g.duration / 60)} 分钟 · ${g.pace} / ${g.stance}</div>
      </div>
      <div>
        <span class="tag ${g.f10k ? "hot" : ""}">${f10kTag}</span>
        <a href="${g.opendota}" target="_blank" rel="noopener">OpenDota</a>
      </div>
    </div>
    <div class="lenses">
      <div><h4>BP 思路</h4><p>天辉：${g.blurb.bp.radiant}<br>夜魇：${g.blurb.bp.dire}</p></div>
      <div><h4>节奏 · 前中期攻防</h4><p>${g.blurb.pace}<br>攻防标签：${g.blurb.stance}。15分钟经济差 ${g.gold?.m15 ?? "?"}。一塔 ${g.first_tower ? mmss(g.first_tower.time) + " 由" + (g.first_tower.taker === "radiant" ? "天辉" : "夜魇") + "拆掉" : "未见T1记录"}。</p></div>
      <div><h4>先到 10 杀 · 盯中单</h4><p>${g.blurb.f10k}<br>${score ? "当时比分 " + score.radiant + "-" + score.dire + " · " : ""}${mmss(f.time)}<br>中单在先到10杀时点出：${g.sides.radiant.mid.player} ${g.sides.radiant.mid.hero} ${g.sides.radiant.mid.kills_before_10} 刀；${g.sides.dire.mid.player} ${g.sides.dire.mid.hero} ${g.sides.dire.mid.kills_before_10} 刀。</p></div>
      <div><h4>中辅联动</h4><p>${g.blurb.mid_support}</p></div>
    </div>
  </article>`;
}

function profileBox(p) {
  const mids = (p.mids || []).map((x) => x[0]).slice(0, 3).join(" / ");
  return `<div class="profile">
    <h3>${p.name}</h3>
    <p>本届 ${p.wins}/${p.games}（${pct(p.winrate)}）· 场均 ${p.avg_duration_min} 分钟</p>
    <p>先到 10 杀 <b>${pct(p.f10k_rate)}</b>；先到时中单场均 ${p.avg_mid_kills_when_first_to_10 ?? "—"} 刀，其中中单≥3刀 ${p.f10k_mid_ge3}/${p.f10k_got}</p>
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

if (window.TI15_DATA) {
  setup(window.TI15_DATA);
} else {
  document.getElementById("app").innerHTML =
    "数据文件没加载到。请直接打开 <code>ti15-analyzer/web/analysis.html</code>，不要打开 GitHub 的源码预览页。";
}

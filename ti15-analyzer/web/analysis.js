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

const pct = (n) => (n == null || Number.isNaN(n) ? "—" : `${Math.round(n * 100)}%`);
const mmss = (s) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};
const TAG = {
  "TEAM VISION": "VSN",
  "Team Liquid": "Liquid",
  "Nigma Galaxy": "NGX",
  "Team Spirit": "Spirit",
  "Iron Wing": "IW",
  "Team Falcons": "FLCN",
  "BoomBoys": "BB",
  "Team Yandex": "TY",
};

const slotName = (slot) => {
  if (!slot) return "待定";
  if (typeof slot === "string") return slot;
  const who = slot.as === "winner" ? "胜者" : "败者";
  return `${slot.from} ${who}`;
};

function whenShort(dt) {
  const m = String(dt || "").match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
  if (!m) return dt || "";
  return `${Number(m[2])}/${Number(m[3])} ${m[4]}`;
}

function resolveSide(slot, byId) {
  if (typeof slot === "string") {
    return { tag: TAG[slot] || slot.slice(0, 4), name: slot, tbd: false, drop: "" };
  }
  const src = byId[slot?.from];
  const kind = slot?.as === "winner" ? "胜者" : "败者";
  const fromUpper = src && String(src.round || "").includes("胜者组") && slot?.as === "loser";
  if (!src) return { tag: "TBD", name: kind, tbd: true, drop: "" };
  if (typeof src.teamA === "string" && typeof src.teamB === "string") {
    const pair = `${TAG[src.teamA] || src.teamA}/${TAG[src.teamB] || src.teamB}`;
    return {
      tag: kind === "胜者" ? "胜" : "败",
      name: `${pair} ${kind}`,
      tbd: true,
      drop: fromUpper ? "从胜者组掉下来" : "",
    };
  }
  return {
    tag: kind === "胜者" ? "胜" : "败",
    name: `${src.round}${kind}`,
    tbd: true,
    drop: fromUpper ? "从胜者组掉下来" : "",
  };
}

function teamRow(t) {
  return `<div class="ladder-team ${t.tbd ? "tbd" : ""}">
    <span class="ladder-tag">${t.tag}</span>
    <span class="ladder-name">${t.name}</span>
    ${t.drop ? `<span class="ladder-drop">${t.drop}</span>` : ""}
  </div>`;
}

function ladderMatch(id, byId, known) {
  const m = byId[id];
  if (!m) return "";
  const a = resolveSide(m.teamA, byId);
  const b = resolveSide(m.teamB, byId);
  const sim = known[id];
  const odds = sim ? `模型 ${pct(sim.series.pSeriesA)} / ${pct(sim.series.pSeriesB)}` : "";
  return `<div class="ladder-match ${m.status || ""}">
    <div class="ladder-meta"><span>${whenShort(m.datetime)}</span><span>${m.format}</span></div>
    ${teamRow(a)}${teamRow(b)}
    ${odds ? `<div class="ladder-odds">${odds}</div>` : '<div class="ladder-odds mute">待填</div>'}
  </div>`;
}

function roundCol(title, ids, byId, known) {
  return `<div class="ladder-round n${ids.length}">
    <div class="ladder-round-title">${title}</div>
    <div class="ladder-round-body">${ids
      .map((id) => `<div class="ladder-slot">${ladderMatch(id, byId, known)}</div>`)
      .join("")}</div>
  </div>`;
}

function joinCol(pairs, kind) {
  const inner = Array.from({ length: pairs }, () => `<div class="ladder-elbow"></div>`).join("");
  return `<div class="ladder-join ${kind || "pair"}" aria-hidden="true">${inner}</div>`;
}

function kaLine(unit) {
  if (!unit) return "—";
  const k = unit.kills_before_10 ?? 0;
  const a = unit.assists_before_10 ?? 0;
  const p = unit.participate_before_10 ?? k + a;
  return `参与 ${p} 次（击杀 ${k} + 助攻 ${a}）`;
}

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
      <div><h4>先到 10 杀 · 中单参与</h4><p>${g.blurb.f10k}<br>${score ? "当时比分 " + score.radiant + "-" + score.dire + " · " : ""}${mmss(f.time)}<br>中单 ${g.sides.radiant.mid.player} ${g.sides.radiant.mid.hero} ${kaLine(g.sides.radiant.mid)}；${g.sides.dire.mid.player} ${g.sides.dire.mid.hero} ${kaLine(g.sides.dire.mid)}。</p></div>
      <div><h4>中辅联动</h4><p>${g.blurb.mid_support}</p></div>
    </div>
  </article>`;
}

function profileBox(p) {
  const mids = (p.mids || []).map((x) => x[0]).slice(0, 3).join(" / ");
  const midKa = p.avg_mid_ka_when_first_to_10 ?? p.avg_mid_kills_when_first_to_10;
  const midAll = p.avg_mid_ka_in_first10 ?? p.avg_mid_kills_in_first10;
  const ms = p.avg_mid_sup_ka_in_first10 ?? p.avg_mid_sup_kills_in_first10;
  return `<div class="profile">
    <h3>${p.name}</h3>
    <p>本届 ${p.wins}/${p.games}（${pct(p.winrate)}）· 场均 ${p.avg_duration_min} 分钟</p>
    <p>先到 10 杀 <b>${pct(p.f10k_rate)}</b>；先到时中单场均参与 ${midKa ?? "—"} 次，其中参与≥3 次 ${p.f10k_mid_ge3}/${p.f10k_got}</p>
    <p>中单前10杀场均参与 <b>${midAll}</b> · 中辅合计 <b>${ms}</b> · 中辅驱动 ${pct(p.mid_sup_driven_rate)}</p>
    <p>中单常用 ${mids || "—"}</p>
  </div>`;
}

function polyLine(s) {
  if (!s.poly) return "暂无市场快照";
  const [a, b] = s.poly.prices;
  return `Polymarket 系列 ${s.poly.outcomes[0]} ${pct(a)} / ${s.poly.outcomes[1]} ${pct(b)}`;
}

function draftBlock(sim) {
  const d = sim.draft;
  if (d) {
    return `<div class="draft">
      <div><b>${d.teamA.name}</b> 选 ${d.teamA.picks.join("、")}<br>禁 ${d.teamA.bans.join("、")}</div>
      <div><b>${d.teamB.name}</b> 选 ${d.teamB.picks.join("、")}<br>禁 ${d.teamB.bans.join("、")}</div>
    </div>
    <p class="foot-note">先手 ${d.firstPick} · 这套阵容下 ${d.teamA.name} 胜率 ${pct(sim.pWinA)} · 先到10杀 ${pct(sim.pF10A)}</p>`;
  }
  return `<p>选：${(sim.picksA || []).join("、")} vs ${(sim.picksB || []).join("、")} · 胜率 ${pct(sim.pWinA)} · 先到10杀 ${pct(sim.pF10A)}</p>`;
}

function mapSims(map) {
  return `<div class="map-sim">
    <h4>第 ${map.game} 局 · 5 次 BP 平均：胜率 ${pct(map.pWinA)} / ${pct(map.pWinB)} · 先到10杀 ${pct(map.pF10A)} / ${pct(map.pF10B)}</h4>
    ${(map.sims || [])
      .map(
        (sim) => `<article class="sim-card"><div class="sim-tag">模拟 ${sim.sim}</div>${draftBlock(sim)}</article>`
      )
      .join("")}
  </div>`;
}

function betTable(betting) {
  if (!betting) return "";
  const rows = (betting.rows || [])
    .map((r) => {
      const roi = r.roi == null ? "—" : `${r.roi >= 0 ? "+" : ""}${Math.round(r.roi * 100)}%`;
      const mkt = r.marketP == null ? "无盘" : pct(r.marketP);
      return `<tr>
        <td>${r.market}</td>
        <td>${r.pick}</td>
        <td>${pct(r.modelP)}</td>
        <td>${mkt}</td>
        <td>${roi}</td>
        <td>${r.action}</td>
      </tr>`;
    })
    .join("");
  return `<div class="bet">
    <h3>押注方案（模型 vs Polymarket）</h3>
    <p class="insight">${betting.plan}</p>
    <table class="src-table">
      <thead><tr><th>盘口</th><th>买谁</th><th>模型</th><th>市场</th><th>期望回报率</th><th>建议</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="foot-note">期望回报率 = 模型概率 ÷ 市场价格 − 1。按 $1 买 YES 计。不是稳胆，样本只有本届 80 局。</p>
  </div>`;
}

function simPanel(sim) {
  if (!sim) return '<p class="empty">还没有模拟。</p>';
  return `<div class="sim-wrap">
    <p class="insight">${sim.why || ""} 系列 ${sim.teamA} ${pct(sim.series?.pSeriesA)} / ${sim.teamB} ${pct(sim.series?.pSeriesB)}。先到10杀 ${pct(sim.pF10A)} / ${pct(sim.pF10B)}。</p>
    ${betTable(sim.betting)}
    ${(sim.maps || []).map(mapSims).join("")}
  </div>`;
}

function renderBracket(data) {
  const matches = data.playoffs?.matches || [];
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const known = Object.fromEntries((data.simulations?.known || []).map((s) => [s.id, s]));
  const upper = [
    roundCol("胜者组首轮 · 8/20", ["ubqf1", "ubqf2", "ubqf3", "ubqf4"], byId, known),
    joinCol(2, "pair"),
    roundCol("胜者组半决赛 · 8/21", ["ubsf1", "ubsf2"], byId, known),
    joinCol(1, "pair"),
    roundCol("胜者组决赛 · 8/22", ["ubf"], byId, known),
    joinCol(1, "line"),
    roundCol("总决赛 Bo5 · 8/23", ["gf"], byId, known),
  ].join("");
  const lower = [
    roundCol("败者组首轮 · 8/21", ["lbr1a", "lbr1b"], byId, known),
    joinCol(2, "line"),
    roundCol("败者组四分之一 · 8/22", ["lbqf1", "lbqf2"], byId, known),
    joinCol(1, "pair"),
    roundCol("败者组半决赛 · 8/22", ["lbsf"], byId, known),
    joinCol(1, "line"),
    roundCol("败者组决赛 · 8/23", ["lbf"], byId, known),
  ].join("");
  return `<section class="series-block">
    <div class="series-head"><h2>淘汰赛对阵图</h2><div class="poly">双败 · 总决赛 Bo5 · 其余 Bo3</div></div>
    <p class="section-lead">和液体百科同一张阶梯：上面胜者组往右晋级，下面败者组接住掉下来的队。金标是已排好的队，灰标是「谁赢谁进」。</p>
    <div class="ladder-legend">
      <span><i class="lg gold"></i>已排对阵</span>
      <span><i class="lg mute"></i>待填 / 情景</span>
      <span><i class="lg drop"></i>从胜者组掉进败者组</span>
    </div>
    <div class="ladder-scroll">
      <div class="ladder-block">
        <div class="ladder-kicker">胜者组 Upper</div>
        <div class="ladder upper">${upper}</div>
      </div>
      <div class="ladder-block">
        <div class="ladder-kicker">败者组 Lower</div>
        <div class="ladder lower">${lower}</div>
      </div>
    </div>
  </section>`;
}

function renderPredictions(data) {
  const known = data.simulations?.known || [];
  const scenarios = data.simulations?.scenarios || [];
  const bySlot = {};
  for (const s of scenarios) {
    (bySlot[s.slot] ||= []).push(s);
  }
  const po = data.playoffs || {};
  const upcoming = (po.matches || []).filter((m) => m.status === "awaiting");
  const knownHtml = known
    .map((sim) => {
      const series = (data.series || []).find((s) => s.id === sim.id);
      return `<section class="series-block" id="sim-${sim.id}">
        <div class="series-head">
          <h2>${sim.round} · ${sim.teamA} vs ${sim.teamB}</h2>
          <div class="poly">${sim.when || ""} CST</div>
        </div>
        ${series ? `<p class="insight">${series.insight}</p>` : ""}
        ${simPanel(sim)}
      </section>`;
    })
    .join("");
  const nextIds = new Set(["lbr1a", "lbr1b", "ubsf1", "ubsf2"]);
  const nextHtml = upcoming
    .filter((m) => nextIds.has(m.id))
    .map((m) => {
      const list = bySlot[m.id] || [];
      if (!list.length) return "";
      const rows = list
        .map((s) => {
          const plan = s.betting?.plan || "";
          return `<article class="game">
            <div class="game-top"><strong>${s.if}</strong><span class="tag">${pct(s.series.pSeriesA)} / ${pct(s.series.pSeriesB)}</span></div>
            <p>地图 ${pct(s.pMapA)} · 先到10杀 ${pct(s.pF10A)} / ${pct(s.pF10B)}</p>
            <p class="foot-note">${plan}</p>
            ${s.maps?.[0] ? mapSims(s.maps[0]) : ""}
          </article>`;
        })
        .join("");
      return `<section class="series-block">
        <div class="series-head"><h2>${m.round} · 情景预测</h2><div class="poly">${m.datetime} CST · ${m.format}</div></div>
        <p class="section-lead">${slotName(m.teamA)} vs ${slotName(m.teamB)}。下面每一种可能对阵都已经跑过模拟，出线后对上号即可。</p>
        ${rows}
      </section>`;
    })
    .join("");
  return knownHtml + nextHtml;
}

function render(data, mode) {
  const app = document.getElementById("app");
  const byId = Object.fromEntries(data.games.map((g) => [g.match_id, g]));

  if (mode === "bracket") {
    app.innerHTML = renderBracket(data);
    return;
  }
  if (mode === "predict") {
    app.innerHTML = renderPredictions(data);
    return;
  }
  if (mode === "series") {
    app.innerHTML = data.series
      .map((s) => {
        const h2h = (s.h2hIds || []).map((id) => byId[id]).filter(Boolean);
        const sim = (data.simulations?.known || []).find((x) => x.id === s.id) || s.sim;
        return `<section class="series-block" id="sim-${s.id}">
          <div class="series-head">
            <h2>${s.teamA} vs ${s.teamB}</h2>
            <div class="poly">${s.when} · ${polyLine(s)}</div>
          </div>
          <p class="insight">${s.insight}</p>
          <div class="compare">${profileBox(s.profileA)}${profileBox(s.profileB)}</div>
          ${simPanel(sim)}
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
  app.innerHTML = `<p class="section-lead">${list.length} 局 · 按时间倒序 · 参与次数 = 击杀 + 助攻</p>` + list.map(gameCard).join("");
}

function setup(data) {
  const filters = document.getElementById("filters");
  const buttons = [
    ["bracket", "对阵图"],
    ["predict", "预测与押注"],
    ["series", "8/20 四场"],
    ["all", "全部 80 局"],
    ...Object.keys(data.teams).map((n) => [n, n]),
  ];
  let mode = "bracket";
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
    "数据文件没加载到。请直接打开 <code>ti15-analyzer/web/index.html</code>，不要打开 GitHub 的源码预览页。";
}

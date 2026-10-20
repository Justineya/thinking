const L = 13.4;
const W = 5.18;
const NET = L / 2;

const SHOTS = [
  { id: 'clear', name: '高远', hang: 1.35, peak: 7.2, speed: 5.1, prefer: 'back' },
  { id: 'drop', name: '吊球', hang: 1.05, peak: 2.4, speed: 4.8, prefer: 'front' },
  { id: 'smash', name: '杀球', hang: 0.52, peak: 2.6, speed: 5.4, prefer: 'mid' },
  { id: 'net', name: '搓球', hang: 0.72, peak: 1.15, speed: 4.4, prefer: 'front' },
  { id: 'lift', name: '挑球', hang: 1.28, peak: 6.4, speed: 5.0, prefer: 'back' },
  { id: 'drive', name: '平抽', hang: 0.48, peak: 1.55, speed: 5.2, prefer: 'mid' },
];

const STYLES = [
  { id: 'balanced', name: '均衡' },
  { id: 'defend', name: '防守' },
  { id: 'attack', name: '抢攻' },
];

const YOU_HOME = { x: W / 2, y: 4.55 };
const OPP_HOME = { x: W / 2, y: L - 4.55 };

const state = {
  you: { ...YOU_HOME },
  opp: { ...OPP_HOME },
  shotId: 'clear',
  style: 'balanced',
  phase: 'serve',
  youScore: 0,
  oppScore: 0,
  rally: 1,
  log: [],
  strokes: [],
  incoming: null,
  recs: [],
  recPick: 0,
  lastReview: null,
  history: [],
  showReplay: false,
  ghost: null,
  shuttle: null,
  trail: [],
  lastCall: '先选球种，点对面半场发球。',
  lastArc: null,
};

const $ = (s) => document.querySelector(s);
const court = $('#court');
const ctx = court.getContext('2d');
const hCanvas = $('#heightView');
const hctx = hCanvas.getContext('2d');

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function inCourt(p) {
  return p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= L;
}
function onOppHalf(p) {
  return inCourt(p) && p.y > NET + 0.12;
}
function zoneOf(p, forOpp) {
  const yFromNet = forOpp ? p.y - NET : NET - p.y;
  if (yFromNet < 1.9) return 'front';
  if (yFromNet < 4.3) return 'mid';
  return 'back';
}
function sideOf(p, facingDown) {
  const left = facingDown ? p.x > W / 2 : p.x < W / 2;
  return left ? 'backhand' : 'forehand';
}
function getShot(id) {
  return SHOTS.find((s) => s.id === id) || SHOTS[0];
}
function zoneName(z) {
  return z === 'front' ? '前场' : z === 'mid' ? '中场' : '后场';
}
function sideName(s) {
  return s === 'backhand' ? '反手' : '正手';
}
function placeLabel(p, forOpp) {
  return `${sideName(sideOf(p, forOpp))}${zoneName(zoneOf(p, forOpp))}`;
}
function oppOpenCorner() {
  const leftOpen = state.opp.x > W / 2;
  return {
    back: { x: leftOpen ? 0.7 : W - 0.7, y: L - 1.15 },
    front: { x: leftOpen ? 0.75 : W - 0.75, y: NET + 0.7 },
  };
}

function layout() {
  const margin = 36;
  const availW = court.width - margin * 2;
  const availH = court.height - margin * 2;
  const aspect = W / L;
  let h = availH;
  let w = h * aspect;
  if (w > availW) {
    w = availW;
    h = w / aspect;
  }
  return { x: (court.width - w) / 2, y: (court.height - h) / 2, w, h };
}
function toPx(p) {
  const { x, y, w, h } = layout();
  return { x: x + (p.x / W) * w, y: y + (1 - p.y / L) * h };
}
function toM(px, py) {
  const { x, y, w, h } = layout();
  return { x: ((px - x) / w) * W, y: (1 - (py - y) / h) * L };
}

function drawCourt() {
  const box = layout();
  ctx.clearRect(0, 0, court.width, court.height);
  ctx.fillStyle = '#0b1f12';
  ctx.fillRect(0, 0, court.width, court.height);
  ctx.fillStyle = '#24824a';
  ctx.fillRect(box.x, box.y, box.w, box.h);

  const line = (x1, y1, x2, y2, width = 2.2) => {
    const a = toPx({ x: x1, y: y1 });
    const b = toPx({ x: x2, y: y2 });
    ctx.strokeStyle = '#f4fff6';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  line(0, 0, W, 0, 3);
  line(0, L, W, L, 3);
  line(0, 0, 0, L, 3);
  line(W, 0, W, L, 3);
  line(0, NET, W, NET, 4);
  line(0, 1.98, W, 1.98);
  line(0, L - 1.98, W, L - 1.98);
  line(0, 4.68, W, 4.68);
  line(0, L - 4.68, W, L - 4.68);
  line(W / 2, 0, W / 2, 4.68);
  line(W / 2, L - 4.68, W / 2, L);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 13px "Noto Sans SC"';
  const youLab = toPx({ x: 0.18, y: 0.35 });
  const oppLab = toPx({ x: 0.18, y: L - 0.15 });
  ctx.fillText('你', youLab.x, youLab.y);
  ctx.fillText('对方', oppLab.x, oppLab.y);
}

function drawPlayer(p, color, label) {
  const s = toPx(p);
  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.ellipse(s.x, s.y + 10, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 11px "Noto Sans SC"';
  ctx.textAlign = 'center';
  ctx.fillText(label, s.x, s.y + 4);
  ctx.textAlign = 'start';
}

function drawTrail() {
  if (state.trail.length < 2) return;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 1; i < state.trail.length; i++) {
    const a = toPx(state.trail[i - 1]);
    const b = toPx(state.trail[i]);
    ctx.strokeStyle = `rgba(255,255,210,${0.15 + (i / state.trail.length) * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function heightAt(t, peak, endH) {
  const rise = 4 * t * (1 - t);
  return Math.max(0.08, peak * rise + endH * t * 0.15);
}

function drawShuttle() {
  const sh = state.shuttle;
  if (!sh) return;
  const p = toPx(sh.pos);
  const shadow = toPx(sh.pos);
  const lift = sh.h * 4.2;
  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.ellipse(shadow.x, shadow.y + 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = '#fff8d6';
  ctx.arc(p.x, p.y - lift, 5.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawReplay() {
  if (!state.showReplay || !state.strokes.length) return;
  state.strokes.forEach((st, i) => {
    const a = toPx(st.from);
    const b = toPx(st.to);
    ctx.strokeStyle = st.who === 'you' ? 'rgba(47,107,255,0.75)' : 'rgba(232,93,42,0.75)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash(st.who === 'you' ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = st.who === 'you' ? '#2f6bff' : '#e85d2a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 10px "Noto Sans SC"';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), b.x, b.y - 8);
    ctx.textAlign = 'start';
  });
}

function drawGhost() {
  if (!state.ghost || (state.phase !== 'your' && state.phase !== 'serve')) return;
  const p = toPx(state.ghost);
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,236,140,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,236,140,0.85)';
  ctx.font = '700 11px "Noto Sans SC"';
  ctx.fillText('推荐落点', p.x + 12, p.y + 4);
}

function render() {
  drawCourt();
  drawReplay();
  drawTrail();
  drawGhost();
  drawPlayer(state.you, '#2f6bff', '你');
  drawPlayer(state.opp, '#e85d2a', '对');
  drawShuttle();
  drawHeight();
}

function drawHeight() {
  hctx.clearRect(0, 0, hCanvas.width, hCanvas.height);
  hctx.fillStyle = '#0c1a10';
  hctx.fillRect(0, 0, hCanvas.width, hCanvas.height);
  const arc = state.lastArc || state.shuttle;
  const maxH = 8;
  const plot = (t, h) => ({
    x: 12 + t * (hCanvas.width - 24),
    y: hCanvas.height - 16 - (h / maxH) * (hCanvas.height - 28),
  });
  hctx.strokeStyle = '#355c40';
  hctx.beginPath();
  hctx.moveTo(10, hCanvas.height - 16);
  hctx.lineTo(hCanvas.width - 8, hCanvas.height - 16);
  hctx.stroke();
  if (!arc) return;
  hctx.strokeStyle = '#f3e27a';
  hctx.lineWidth = 2;
  hctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const h = heightAt(t, arc.peak, 0.15);
    const p = plot(t, h);
    if (i === 0) hctx.moveTo(p.x, p.y);
    else hctx.lineTo(p.x, p.y);
  }
  hctx.stroke();
  if (state.shuttle) {
    const t = state.shuttle.t;
    const p = plot(t, state.shuttle.h);
    hctx.fillStyle = '#fff';
    hctx.beginPath();
    hctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    hctx.fill();
  }
}

function setCall(text) {
  state.lastCall = text;
  $('#callout').textContent = text;
}

function recommendPlay() {
  const open = oppOpenCorner();
  const incoming = state.incoming;
  const style = state.style;
  if (state.phase === 'serve') {
    if (style === 'attack') {
      return [
        { shotId: 'drop', title: '发吊反手网前', why: '抢攻型会扑网，先看他起动。不到位下一拍就能压后场。', ghost: open.front },
        { shotId: 'clear', title: '发高远压反手底线', why: '即使他抢攻，先把他逼回底线再找空当。', ghost: open.back },
      ];
    }
    if (style === 'defend') {
      return [
        { shotId: 'clear', title: '连续压反手底线', why: '防守型爱回高远，落点单一就压同一角，下一拍再吊。', ghost: open.back },
        { shotId: 'drop', title: '高吊结合：先吊网前', why: '他习惯待在后场，吊网前逼他前后跑。', ghost: open.front },
      ];
    }
    return [
      { shotId: 'clear', title: '发高远到反手底线', why: '最稳的开局。看回球质量再决定杀还是吊。', ghost: open.back },
      { shotId: 'drop', title: '发网前试探', why: '对方在中场，网前是空的，看他是否跟上。', ghost: open.front },
    ];
  }
  if (state.phase !== 'your' || !incoming) {
    return [{ shotId: state.shotId, title: '等球落地', why: '这一拍飞完再选。', ghost: null }];
  }
  const z = zoneOf(state.you, false);
  const oppZ = zoneOf(state.opp, true);
  if (incoming.id === 'smash') {
    return [
      { shotId: 'net', title: '挡对角网前', why: '杀球质量高，先挡网不给连续进攻。', ghost: open.front },
      { shotId: 'lift', title: '被动挑反手底线', why: '来不及挡就挑高，把节奏拉慢。', ghost: open.back },
    ];
  }
  if (incoming.id === 'drop' || incoming.id === 'net') {
    if (oppZ === 'back') {
      return [
        { shotId: 'net', title: '跟上搓对角', why: '对方还在底线，网前空了，别挑高给他杀。', ghost: open.front },
        { shotId: 'drive', title: '推后场空当', why: '他扑网来不及，推直线后场。用平抽打深。', ghost: open.back },
      ];
    }
    return [
      { shotId: 'lift', title: '挑反手底线', why: '对方已经贴网，搓容易被扑，挑远角。', ghost: open.back },
      { shotId: 'net', title: '软搓另一边', why: '他贴网但偏一侧，搓空当还能抢网。', ghost: open.front },
    ];
  }
  if (incoming.id === 'clear' || incoming.id === 'lift') {
    if (z === 'back') {
      return [
        { shotId: 'drop', title: '假动作吊对角', why: '对方以为你杀，吊网前最能拉开。', ghost: open.front },
        { shotId: 'smash', title: '下压中路/追身', why: '到位了可以杀。别杀太深，落点靠近他身前。', ghost: { x: clamp(state.opp.x, 0.8, W - 0.8), y: NET + 2.6 } },
      ];
    }
    return [
      { shotId: 'clear', title: '先过渡回高远', why: '你不在后场，强杀质量差，先压反手底线。', ghost: open.back },
      { shotId: 'drive', title: '平抽抢节奏', why: '中场来球可以抽对角，不给对方架拍。', ghost: { x: open.front.x, y: NET + 2.2 } },
    ];
  }
  if (incoming.id === 'drive') {
    return [
      { shotId: 'drive', title: '对抽空当一侧', why: '平抽要对压，打他拉开的那一边。', ghost: { x: open.front.x, y: NET + 2.4 } },
      { shotId: 'lift', title: '挑高摆脱', why: '对抽吃亏就挑高，重新组织。', ghost: open.back },
    ];
  }
  return [{ shotId: 'clear', title: '回高远稳住', why: '先把球抬起来再找空当。', ghost: open.back }];
}

function gradeYourStroke(st, oppThen) {
  const howFar = dist(oppThen, st.to);
  const z = zoneOf(st.to, true);
  if (st.shot.id === 'smash' && z === 'back') {
    return { mark: 'mid', text: '杀球落点太深，对方更好借力回高远。' };
  }
  if (st.shot.id === 'net' && z === 'back') {
    return { mark: 'mid', text: '搓球打深了，变成半场高球，对方能抢攻。' };
  }
  if (howFar > 3.2) return { mark: 'good', text: `拉开明显，落点在${placeLabel(st.to, true)}，对方要跑超过 3 米。` };
  if (howFar > 1.8) return { mark: 'mid', text: '落点一般，对方能赶到，但已经离开中心。' };
  return { mark: 'bad', text: '几乎打到人身上，对方原地就能接，下一拍你会被动。' };
}

function buildReview(winner, reason) {
  const yours = state.strokes.filter((s) => s.who === 'you');
  const notes = yours.map((st) => {
    const g = gradeYourStroke(st, st.oppAtHit);
    return { ...g, title: `${st.shot.name} → ${placeLabel(st.to, true)}` };
  });
  const backhandHits = yours.filter((s) => sideOf(s.to, true) === 'backhand').length;
  const frontHits = yours.filter((s) => zoneOf(s.to, true) === 'front').length;
  const sameSide = yours.length >= 3 && (backhandHits === 0 || backhandHits === yours.length);
  const lessons = [];
  if (sameSide) lessons.push('落点太集中同一侧，对方不用左右移动。下一分左右拉开。');
  if (yours.length && frontHits === 0 && winner !== 'you') lessons.push('整分都在后场对拉，没有吊网前，对方站着就能防。');
  if (yours.length && frontHits === yours.length && winner !== 'you') lessons.push('一直打网前，对方跟上之后你没有后场变化。');
  if (winner === 'you') lessons.push('这分赢在把对方拉出位置。下一分继续先拉开再下压。');
  else lessons.push('丢分前一拍没有把对方调开，回位也慢。先打空当，再准备下一拍。');

  const next = recommendPlayAfter(winner);
  return { winner, reason, notes, lessons, next, strokes: state.strokes.map((s) => ({ ...s })) };
}

function recommendPlayAfter(winner) {
  const style = STYLES.find((s) => s.id === state.style)?.name || '均衡';
  if (winner === 'you') {
    return `对方是「${style}」。重复刚才能得分的套路：先压反手底线，再吊对角网前。`;
  }
  if (state.style === 'attack') {
    return '对方抢攻。少给高球到他正手后场；多发网前和推追身，逼他起高再打。';
  }
  if (state.style === 'defend') {
    return '对方防守。不要跟他对拉高远，第二拍必须吊或杀，让他前后跑。';
  }
  return '下一分按「后场反手 → 对角网前」两点控制，看他回球质量再决定是否下压。';
}

function renderRecs() {
  state.recs = recommendPlay();
  if (state.phase === 'your' || state.phase === 'serve') {
    const pick = state.recs[state.recPick] || state.recs[0];
    state.ghost = pick?.ghost || null;
  } else {
    state.ghost = null;
  }
  $('#recList').innerHTML = state.recs
    .map((r, i) => {
      const shot = getShot(r.shotId);
      return `<button type="button" class="rec${i === state.recPick ? ' is-on' : ''}" data-rec="${i}">
        <span class="tag">${shot.name}</span>
        <b>${r.title}</b>
        <span>${r.why}</span>
      </button>`;
    })
    .join('');
}

function renderReview() {
  const box = $('#reviewBox');
  const r = state.lastReview;
  if (!r) {
    box.innerHTML = '还没打完。结束后看这一分怎么丢、下一分怎么打。';
    return;
  }
  const who = r.winner === 'you' ? '你得分' : '对方得分';
  const notes = r.notes
    .map((n) => `<div><span class="mark-${n.mark}">${n.mark === 'good' ? '好' : n.mark === 'mid' ? '一般' : '弱'}</span> ${n.title} — ${n.text}</div>`)
    .join('');
  const lessons = r.lessons.map((x) => `<div>${x}</div>`).join('');
  box.innerHTML = `<b>${who}。</b> ${r.reason}<div style="margin-top:6px">${notes || '没有你的击球记录。'}</div>
    <div style="margin-top:8px"><b>下一分推荐</b><br />${r.next}</div>
    <div style="margin-top:6px">${lessons}</div>`;
}

function renderHud() {
  $('#youScore').textContent = String(state.youScore);
  $('#oppScore').textContent = String(state.oppScore);
  $('#rallyN').textContent = String(state.rally);
  $('#hint').textContent =
    state.phase === 'serve'
      ? '发球：点推荐，或自己选球种再点对面。'
      : state.phase === 'your'
        ? '轮到你。推荐在右侧，点一下会帮你选好球种和落点提示。'
        : state.phase === 'fly'
          ? '球在飞，看对方怎么移动。'
          : '回合结束。先看复盘，再点重新发球。';
  $('#log').innerHTML = state.log
    .slice()
    .reverse()
    .map((row) => `<li class="${row.who}">${row.text}</li>`)
    .join('');
  renderRecs();
  renderReview();
}

function pushLog(who, text) {
  state.log.push({ who, text });
  if (state.log.length > 24) state.log.shift();
}

function endRally(winner, reason) {
  state.phase = 'over';
  if (winner === 'you') state.youScore += 1;
  else state.oppScore += 1;
  setCall(reason);
  pushLog(winner === 'you' ? 'you' : 'opp', reason);
  state.shuttle = null;
  state.lastReview = buildReview(winner, reason);
  state.history.unshift(state.lastReview);
  state.history = state.history.slice(0, 8);
  state.showReplay = true;
  state.incoming = null;
  renderHud();
  render();
}

function startServe() {
  state.you = { ...YOU_HOME };
  state.opp = { ...OPP_HOME };
  state.phase = 'serve';
  state.trail = [];
  state.shuttle = null;
  state.lastArc = null;
  state.log = [];
  state.strokes = [];
  state.incoming = null;
  state.recPick = 0;
  state.showReplay = false;
  setCall('发球。先看推荐，或自己点落点。');
  renderHud();
  render();
}

function newRallyKeepScore() {
  state.you = { ...YOU_HOME };
  state.opp = { ...OPP_HOME };
  state.phase = 'serve';
  state.trail = [];
  state.shuttle = null;
  state.lastArc = null;
  state.log = [];
  state.strokes = [];
  state.incoming = null;
  state.recPick = 0;
  state.showReplay = !!state.lastReview;
  state.rally += 1;
  setCall('下一回合，你发球。上一分复盘还在右侧。');
  renderHud();
  render();
}

function qualityFor(shot, dest) {
  const z = zoneOf(dest, true);
  if (shot.prefer === z) return 1;
  if (shot.id === 'smash' && z === 'front') return 0.85;
  if (shot.id === 'clear' && z === 'mid') return 0.7;
  if (shot.id === 'lift' && z === 'mid') return 0.65;
  return 0.45;
}

function moveToward(who, dest, dt, speed) {
  const d = dist(who, dest);
  if (d < 0.04) {
    who.x = dest.x;
    who.y = dest.y;
    return;
  }
  const step = speed * dt;
  const k = Math.min(1, step / d);
  who.x += (dest.x - who.x) * k;
  who.y += (dest.y - who.y) * k;
}

function pickOppReply(incoming, dest, reach) {
  const z = zoneOf(dest, true);
  const side = sideOf(dest, true);
  const style = state.style;
  const late = reach.late;
  const ready = !late && reach.reach;

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  if (!reach.reach) return null;

  if (incoming.id === 'smash') {
    if (late) return { shot: getShot('lift'), aim: 'deep-cross', why: '杀球来得急，只能被动挑高' };
    return { shot: getShot('net'), aim: 'net-cross', why: '到位接下手，挡对角网前' };
  }
  if (incoming.id === 'net' || (incoming.id === 'drop' && z === 'front')) {
    if (late) return { shot: getShot('lift'), aim: 'deep-straight', why: '上网慢了，只能挑后场过渡' };
    if (style === 'attack') return { shot: getShot('net'), aim: 'net-cross', why: '跟上网前，搓对角抢节奏' };
    return pick([
      { shot: getShot('net'), aim: 'net-cross', why: '网前搓对角，不给对方进攻' },
      { shot: getShot('lift'), aim: 'deep-cross', why: '挑反手底线，把对方逼回去' },
    ]);
  }
  if (incoming.id === 'clear' || incoming.id === 'lift') {
    if (z === 'back' && ready && style === 'attack') {
      return pick([
        { shot: getShot('smash'), aim: 'body', why: '后场够得到，下压杀直线' },
        { shot: getShot('drop'), aim: 'net-cross', why: '假动作吊对角，拉开空当' },
      ]);
    }
    if (style === 'defend' || late) {
      return { shot: getShot('clear'), aim: 'deep-cross', why: '防守回高远到反手底线' };
    }
    return pick([
      { shot: getShot('clear'), aim: 'deep-straight', why: '压后场，不给对方前场' },
      { shot: getShot('drop'), aim: 'net-straight', why: '高吊结合，看你是否起动' },
    ]);
  }
  if (incoming.id === 'drive') {
    return ready
      ? { shot: getShot('drive'), aim: 'mid-cross', why: '平抽对压，打你空出来的一侧' }
      : { shot: getShot('lift'), aim: 'deep-straight', why: '抽球来不及，挑高摆脱' };
  }
  if (side === 'backhand' && style !== 'attack') {
    return { shot: getShot('clear'), aim: 'deep-cross', why: '反手位先回高远稳住' };
  }
  return { shot: getShot('drop'), aim: 'net-cross', why: '中场过渡，吊网前' };
}

function aimPoint(kind, fromOpp) {
  const jitter = () => (Math.random() - 0.5) * 0.35;
  const deepY = fromOpp ? 1.1 + Math.random() * 0.7 : L - 1.1 - Math.random() * 0.7;
  const netY = fromOpp ? NET - 0.55 - Math.random() * 0.45 : NET + 0.55 + Math.random() * 0.45;
  const midY = fromOpp ? 3.4 + Math.random() : L - 3.4 - Math.random();
  const left = 0.55 + Math.random() * 0.7;
  const right = W - 0.55 - Math.random() * 0.7;
  const cx = W / 2 + jitter();
  const map = {
    'deep-cross': { x: fromOpp ? left : right, y: deepY },
    'deep-straight': { x: fromOpp ? state.you.x * 0.35 + cx * 0.65 : state.opp.x * 0.35 + cx * 0.65, y: deepY },
    'net-cross': { x: fromOpp ? (state.you.x < W / 2 ? right : left) : state.opp.x < W / 2 ? right : left, y: netY },
    'net-straight': { x: clamp((fromOpp ? state.you.x : state.opp.x) + jitter(), 0.4, W - 0.4), y: netY },
    body: { x: clamp((fromOpp ? state.you.x : state.opp.x) + jitter() * 0.5, 0.5, W - 0.5), y: midY },
    'mid-cross': { x: fromOpp ? (state.you.x < W / 2 ? right : left) : state.opp.x < W / 2 ? right : left, y: midY },
  };
  const p = map[kind] || map['deep-cross'];
  p.x = clamp(p.x, 0.25, W - 0.25);
  p.y = clamp(p.y, 0.25, L - 0.25);
  return p;
}

function launch({ from, to, shot, who, startH = 1.55 }) {
  const hang = shot.hang * (0.92 + qualityFor(shot, to) * 0.16);
  state.shuttle = {
    from: { ...from },
    to: { ...to },
    pos: { ...from },
    shot,
    who,
    t: 0,
    hang,
    peak: shot.peak,
    h: startH,
    startH,
  };
  state.lastArc = { peak: shot.peak, hang };
  state.trail = [{ ...from }];
  state.phase = 'fly';
  state.strokes.push({
    who,
    shot,
    from: { ...from },
    to: { ...to },
    oppAtHit: { ...state.opp },
    youAtHit: { ...state.you },
  });
  pushLog(who, `${who === 'you' ? '你' : '对方'} ${shot.name} → ${placeLabel(to, who === 'you')}`);
  renderHud();
}

let lastTs = 0;
function tick(ts) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  const sh = state.shuttle;
  if (sh && state.phase === 'fly') {
    sh.t = Math.min(1, sh.t + dt / sh.hang);
    sh.pos.x = sh.from.x + (sh.to.x - sh.from.x) * sh.t;
    sh.pos.y = sh.from.y + (sh.to.y - sh.from.y) * sh.t;
    sh.h = heightAt(sh.t, sh.peak, 0.12);
    if (state.trail.length === 0 || dist(state.trail[state.trail.length - 1], sh.pos) > 0.18) {
      state.trail.push({ ...sh.pos });
    }
    const mover = sh.who === 'you' ? state.opp : state.you;
    const home = sh.who === 'you' ? YOU_HOME : OPP_HOME;
    moveToward(mover, sh.to, dt, sh.who === 'you' ? 4.7 : 4.5);
    moveToward(sh.who === 'you' ? state.you : state.opp, home, dt, 2.4);

    if (sh.t >= 1) finishFlight(sh);
  }
  render();
  requestAnimationFrame(tick);
}

function finishFlight(sh) {
  const receiver = sh.who === 'you' ? state.opp : state.you;
  const reach = (() => {
    const d = dist(receiver, sh.to);
    const need = d / (sh.who === 'you' ? 4.7 : 4.4);
    const slack = sh.shot.id === 'smash' ? 0.04 : 0.18;
    return { reach: need <= sh.hang + slack, late: need > sh.hang * 0.78, need };
  })();

  if (sh.who === 'you') {
    const reply = pickOppReply(sh.shot, sh.to, reach);
    if (!reply) {
      endRally('you', `对方没接到这拍${sh.shot.name}，你得分。`);
      return;
    }
    const dest = aimPoint(reply.aim, true);
    setCall(`对方：${reply.why} → ${reply.shot.name}`);
    state.phase = 'fly';
    launch({ from: { ...state.opp }, to: dest, shot: reply.shot, who: 'opp', startH: 1.4 });
    return;
  }

  const d = dist(state.you, sh.to);
  const need = d / 4.4;
  if (need > sh.hang + 0.2) {
    endRally('opp', `你没赶到，对方这拍${sh.shot.name}得分。`);
    return;
  }
  state.you.x = sh.to.x;
  state.you.y = sh.to.y;
  state.shuttle = null;
  state.phase = 'your';
  state.incoming = sh.shot;
  state.recPick = 0;
  setCall(`球到你这边了。对方打的是${sh.shot.name}，先看推荐再回。`);
  renderHud();
}

function tryHit(dest) {
  if (state.phase !== 'your' && state.phase !== 'serve') return;
  if (!onOppHalf(dest)) {
    setCall('点对面半场。网前也算对面。');
    return;
  }
  dest.x = clamp(dest.x, 0.2, W - 0.2);
  dest.y = clamp(dest.y, NET + 0.2, L - 0.2);
  const shot = getShot(state.shotId);
  const from = state.phase === 'serve' ? { x: state.you.x, y: 1.2 } : { ...state.you };
  if (shot.id === 'net' && dest.y > NET + 2.4) {
    setCall('搓球太深了，会变成推后场。仍按你点的落点打。');
  }
  launch({ from, to: dest, shot, who: 'you', startH: state.phase === 'serve' ? 1.7 : 1.45 });
}

function bindUi() {
  const shotBar = $('#shotBar');
  shotBar.innerHTML = SHOTS.map(
    (s) => `<button type="button" class="chip${s.id === state.shotId ? ' is-on' : ''}" data-shot="${s.id}">${s.name}</button>`
  ).join('');
  shotBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shot]');
    if (!btn) return;
    state.shotId = btn.dataset.shot;
    shotBar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.shot === state.shotId));
  });

  function syncShotChips() {
    shotBar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.shot === state.shotId));
  }

  $('#recList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rec]');
    if (!btn) return;
    state.recPick = Number(btn.dataset.rec);
    const rec = state.recs[state.recPick];
    if (!rec) return;
    state.shotId = rec.shotId;
    state.ghost = rec.ghost;
    syncShotChips();
    renderHud();
  });

  $('#replayBtn').addEventListener('click', () => {
    const src = state.strokes.length ? state.strokes : state.lastReview?.strokes;
    if (!src?.length) {
      setCall('这一分还没有球路可看。');
      return;
    }
    if (!state.strokes.length && state.lastReview?.strokes) state.strokes = state.lastReview.strokes.map((s) => ({ ...s }));
    state.showReplay = !state.showReplay;
    setCall(state.showReplay ? '场上蓝线是你，橙线是对方。数字是落点顺序。' : '复盘路线已关。');
    render();
  });

  const styleBar = $('#styleBar');
  styleBar.innerHTML = STYLES.map(
    (s) => `<button type="button" class="chip style${s.id === state.style ? ' is-on' : ''}" data-style="${s.id}">${s.name}</button>`
  ).join('');
  styleBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-style]');
    if (!btn) return;
    state.style = btn.dataset.style;
    styleBar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.style === state.style));
    setCall(`对方改成「${STYLES.find((x) => x.id === state.style).name}」：防守多挑高远，抢攻会杀和上网。`);
    renderHud();
  });

  court.addEventListener('click', (e) => {
    const r = court.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * court.width;
    const sy = ((e.clientY - r.top) / r.height) * court.height;
    tryHit(toM(sx, sy));
  });

  $('#serveBtn').addEventListener('click', () => {
    if (state.phase === 'over') newRallyKeepScore();
    else startServe();
  });
  $('#resetBtn').addEventListener('click', () => {
    state.youScore = 0;
    state.oppScore = 0;
    state.rally = 1;
    startServe();
  });
}

bindUi();
startServe();
renderHud();
requestAnimationFrame(tick);

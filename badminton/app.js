const L = 13.4;
const W = 5.18;
const NET = L / 2;

const SHOTS = [
  { id: 'smash', name: '杀球', hang: 0.52, peak: 2.6, speed: 5.4, prefer: 'mid' },
  { id: 'net', name: '放网', hang: 0.72, peak: 1.15, speed: 4.4, prefer: 'front' },
  { id: 'push', name: '推后场', hang: 0.64, peak: 1.85, speed: 5.0, prefer: 'back' },
  { id: 'lift', name: '挑后场', hang: 1.28, peak: 6.4, speed: 5.0, prefer: 'back' },
  { id: 'hook', name: '勾对角', hang: 0.76, peak: 1.22, speed: 4.5, prefer: 'front' },
  { id: 'drop', name: '吊球', hang: 1.05, peak: 2.4, speed: 4.8, prefer: 'front' },
  { id: 'clear', name: '高远', hang: 1.35, peak: 7.2, speed: 5.1, prefer: 'back' },
  { id: 'drive', name: '平抽', hang: 0.48, peak: 1.55, speed: 5.2, prefer: 'mid' },
];

/** 按你的自述：杀精通；放网/推/挑可用；勾对角简单；吊球偶尔到位；反手侧身不到位。 */
const YOU = {
  smash: 0.92,
  net: 0.72,
  push: 0.7,
  lift: 0.68,
  hook: 0.6,
  drop: 0.3,
  clear: 0.55,
  drive: 0.5,
  backhand: 0.28,
  speed: 3.45,
  bhSpeed: 2.85,
  reach: 0.92,
  bhReach: 0.72,
  recover: 1.65,
};

const PLAN = {
  title: '先补短板，别加杀球',
  intro: '训练能碰到反手，比赛回不出质量：多球慢、高、你知道球来；实战快、平、杀完才侧身。碰到≠到位。',
  steps: [
    '回位：每拍杀完先回T。训练里你是准备好再接，比赛里你是杀完才找球。',
    '反手只挑高、深：侧身没转完就出手，球会又短又高，对面直接杀。先求到位。',
    '多球要加难度：喂球加快、压平、往反手髋。能回10个高远，再算练到了。',
    '两点控制：推反手底线 + 放网。他起高再杀。反手侧身吊对角很帅，等侧身能转完再练。',
  ],
};

const SKILL_LABELS = [
  { id: 'smash', name: '杀球精通', cls: 'good' },
  { id: 'net', name: '放网正常', cls: 'ok' },
  { id: 'push', name: '推后场正常', cls: 'ok' },
  { id: 'lift', name: '挑后场还可以', cls: 'ok' },
  { id: 'hook', name: '简单勾对角', cls: 'ok' },
  { id: 'drop', name: '吊球一般', cls: 'weak' },
  { id: 'backhand', name: '反手侧身不到位', cls: 'weak' },
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
  shotId: 'push',
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
  forcedWeak: false,
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
function youOnBackhand() {
  return sideOf(state.you, false) === 'backhand';
}
function incomingOnBackhand(p) {
  return sideOf(p, false) === 'backhand';
}
function skillOf(shot, from) {
  let s = YOU[shot.id] ?? 0.55;
  if (sideOf(from, false) === 'backhand') {
    s *= 0.42 + YOU.backhand * 0.5;
  }
  return clamp(s, 0.08, 0.98);
}
function recFit(shotId) {
  const s = skillOf(getShot(shotId), state.you);
  if (s >= 0.66) return { tag: '你稳', cls: '' };
  if (s >= 0.45) return { tag: '勉强', cls: 'warn' };
  return { tag: '你打不准', cls: 'hard' };
}
function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function executeYouShot(shot, intended, from) {
  let skill = skillOf(shot, from);
  if (shot.id === 'drop' && Math.random() < 0.18) skill = Math.min(0.86, skill + 0.45);
  const spread = (1 - skill) * 2.15;
  const dest = {
    x: intended.x + gauss() * spread * 0.55,
    y: intended.y + gauss() * spread * 0.7,
  };
  const bhDrop = shot.id === 'drop' && sideOf(from, false) === 'backhand';
  if (bhDrop) {
    const roll = Math.random();
    if (roll < 0.42) {
      return { ok: false, reason: '反手侧身吊对角下网。帅是帅，侧身没转完拍面就打开了。', dest };
    }
    if (roll < 0.62) {
      return { ok: false, reason: '反手吊对角出边线。角度够帅，落点你现在锁不住。', dest };
    }
    dest.x += (Math.random() - 0.5) * 1.8;
    dest.y = NET + 1.6 + Math.random() * 2.2;
  }
  if (shot.id === 'drop' && !bhDrop && skill < 0.5 && Math.random() < 0.28) {
    return { ok: false, reason: '吊球下网。这拍你本来就不稳。', dest };
  }
  if (shot.id === 'hook' && skill < 0.55 && Math.random() < 0.16) {
    return { ok: false, reason: '勾对角出边线。简单勾可以，但现在角度够呛。', dest };
  }
  if (sideOf(from, false) === 'backhand' && skill < 0.4 && Math.random() < 0.22) {
    dest.x += (from.x < W / 2 ? -1 : 1) * (0.8 + Math.random());
    dest.y += (Math.random() - 0.2) * 1.4;
  }
  dest.x = clamp(dest.x, -0.4, W + 0.4);
  dest.y = clamp(dest.y, NET - 0.4, L + 0.45);
  if (dest.y < NET + 0.08 && !['net', 'hook', 'drop'].includes(shot.id)) {
    return { ok: false, reason: `${shot.name}下网了。`, dest };
  }
  if (dest.y < NET + 0.05) {
    return { ok: false, reason: `${shot.name}下网了。`, dest };
  }
  if (dest.x < 0 || dest.x > W || dest.y > L) {
    return { ok: false, reason: `${shot.name}出界。反手侧身时落点更容易飞。`, dest };
  }
  dest.x = clamp(dest.x, 0.15, W - 0.15);
  dest.y = clamp(dest.y, NET + 0.12, L - 0.12);
  return { ok: true, dest, skill, spread };
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
  const bh = youOnBackhand();
  if (state.forcedWeak) {
    return [
      {
        shotId: 'lift',
        title: '已经被动了',
        why: '你碰到了，但侧身没转完。这种球在比赛里就是给对方杀。下一拍先回T。',
        ghost: null,
      },
    ];
  }
  if (state.phase === 'serve') {
    return [
      { shotId: 'push', title: '推后场反手', why: '你推后场稳。先把人逼回去，下一拍再找杀。', ghost: open.back },
      { shotId: 'net', title: '发放网', why: '放网你正常。别发吊，吊球你偶尔才到位。', ghost: open.front },
    ];
  }
  if (state.phase !== 'your' || !incoming) {
    return [{ shotId: state.shotId, title: '等球落地', why: '这一拍飞完再选。', ghost: null }];
  }
  const z = zoneOf(state.you, false);
  const oppZ = zoneOf(state.opp, true);
  if (bh) {
    return [
      { shotId: 'lift', title: '反手先挑后场', why: '你反手侧身回球不到位。别吊、别勾，先挑高保住。', ghost: open.back },
      {
        shotId: 'drop',
        title: '反手侧身吊对角（帅）',
        why: '这拍看起来最帅。按你现在的吊球和侧身，十次里多数下网、出界或变成半场高球。',
        ghost: open.front,
      },
    ];
  }
  if (incoming.id === 'smash') {
    return [
      { shotId: 'net', title: '挡放网', why: '杀球你接得紧。能挡就放网，别想反吊。', ghost: open.front },
      { shotId: 'lift', title: '挑后场过渡', why: '来不及挡就挑，这拍你还可以。', ghost: open.back },
    ];
  }
  if (['drop', 'net', 'hook'].includes(incoming.id)) {
    if (oppZ === 'back') {
      return [
        { shotId: 'net', title: '跟上放网', why: '对方还在底线。放网你正常，别改吊。', ghost: open.front },
        { shotId: 'push', title: '推后场空当', why: '他扑网来不及，推后场是你的稳球。', ghost: open.back },
      ];
    }
    return [
      { shotId: 'lift', title: '挑后场', why: '对方已贴网，放网容易被扑。挑是你能打出来的。', ghost: open.back },
      { shotId: 'hook', title: '简单勾对角', why: '他偏一侧可以勾。别勾太尖。', ghost: open.front },
    ];
  }
  if (incoming.id === 'clear' || incoming.id === 'lift' || incoming.id === 'push') {
    if (z === 'back') {
      return [
        { shotId: 'smash', title: '杀追身/中前场', why: '杀球你精通。别杀底线，落点靠近他身前。', ghost: { x: clamp(state.opp.x, 0.8, W - 0.8), y: NET + 2.55 } },
        { shotId: 'push', title: '再推一个反手底线', why: '不到位别硬吊。你吊球一般，推更稳。', ghost: open.back },
      ];
    }
    return [
      { shotId: 'push', title: '中场推后场', why: '不在后场就别杀。推后场你打得出效果。', ghost: open.back },
      { shotId: 'lift', title: '挑高重新组织', why: '节奏乱了先挑，再等杀的机会。', ghost: open.back },
    ];
  }
  if (incoming.id === 'drive') {
    return [
      { shotId: 'lift', title: '挑后场摆脱', why: '对抽不是你的强项，挑高更稳。', ghost: open.back },
      { shotId: 'push', title: '推对角后场', why: '能推就推空当，别改吊。', ghost: open.back },
    ];
  }
  return [
    { shotId: 'lift', title: '挑后场稳住', why: '先把球抬起来。按你的技术，挑比吊靠谱。', ghost: open.back },
  ];
}

function gradeYourStroke(st, oppThen) {
  const howFar = dist(oppThen, st.to);
  const z = zoneOf(st.to, true);
  if (st.shot.id === 'smash' && z === 'back') {
    return { mark: 'mid', text: '杀球落点太深，对方更好借力回高远。' };
  }
  if (st.shot.id === 'drop') {
    return { mark: 'mid', text: '吊球按你的技术本来就不稳，落点漂了也正常。' };
  }
  if (sideOf(st.from, false) === 'backhand') {
    return { mark: 'mid', text: '反手侧身回球不到位，这拍落点很难准。' };
  }
  if (st.shot.id === 'net' && z === 'back') {
    return { mark: 'mid', text: '放网打深了，变成半场高球，对方能抢攻。' };
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
  if (winner === 'you') lessons.push('这分赢在拉开再杀。继续推/挑拉开，到位再杀。');
  else lessons.push('按提升计划：先回T，反手只挑，不要用吊球救场。');

  const next = recommendPlayAfter(winner);
  return { winner, reason, notes, lessons, next, strokes: state.strokes.map((s) => ({ ...s })) };
}

function recommendPlayAfter(winner) {
  const style = STYLES.find((s) => s.id === state.style)?.name || '均衡';
  if (winner === 'you') {
    return `按你的技术复用：推/挑拉开，到位就杀。不要用吊球当战术轴心。对方是「${style}」。`;
  }
  if (state.style === 'attack') {
    return '对方抢攻。你少给高球；用放网和推后场，逼他起高再杀。吊球别指望。';
  }
  if (state.style === 'defend') {
    return '对方防守。用推后场把人钉住，第二拍杀。别跟他对拉高远，也别连续吊。';
  }
  return '下一分：推反手底线 → 放网或勾对角 → 他起高再杀。反手侧身只挑不吊。';
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
      const fit = r.title === '等球落地' ? { tag: '等', cls: '' } : recFit(r.shotId);
      return `<button type="button" class="rec${i === state.recPick ? ' is-on' : ''}" data-rec="${i}">
        <span class="tag">${shot.name}</span>
        <span class="tag ${fit.cls}">${fit.tag}</span>
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
  const skillEl = $('#skillCard');
  if (skillEl) {
    skillEl.innerHTML = SKILL_LABELS.map((s) => `<span class="sk ${s.cls}">${s.name}</span>`).join('');
  }
  const planEl = $('#planBox');
  if (planEl) {
    planEl.innerHTML = `<b>${PLAN.title}</b><div>${PLAN.intro}</div><ol>${PLAN.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  }
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
  state.forcedWeak = false;
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
  state.forcedWeak = false;
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
  if (incoming.id === 'drive' || incoming.id === 'push') {
    return ready
      ? { shot: getShot('drive'), aim: 'mid-cross', why: '平抽对压，打你空出来的一侧' }
      : { shot: getShot('lift'), aim: 'deep-straight', why: '抽球来不及，挑高摆脱' };
  }
  if (incoming.id === 'hook') {
    if (late) return { shot: getShot('lift'), aim: 'deep-straight', why: '勾过来上网慢了，挑后场' };
    return { shot: getShot('net'), aim: 'net-cross', why: '跟上放网' };
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
    if (sh.who === 'you') {
      moveToward(state.opp, sh.to, dt, 4.7);
      moveToward(state.you, home, dt, YOU.recover);
    } else {
      const youSpd = incomingOnBackhand(sh.to) ? YOU.bhSpeed : YOU.speed;
      moveToward(state.you, sh.to, dt, youSpd);
      moveToward(state.opp, home, dt, 2.4);
    }

    if (sh.t >= 1) finishFlight(sh);
  }
  render();
  requestAnimationFrame(tick);
}

function finishFlight(sh) {
  const receiver = sh.who === 'you' ? state.opp : state.you;
  const reach = (() => {
    const d = dist(receiver, sh.to);
    if (sh.who === 'you') {
      const limit = sh.shot.id === 'smash' ? 1.05 : 1.35;
      return { reach: d <= limit, late: d > 0.72, need: d };
    }
    const limit = incomingOnBackhand(sh.to) ? YOU.bhReach : YOU.reach;
    const smashIn = sh.shot.id === 'smash' ? 0.78 : 1;
    return { reach: d <= limit * smashIn, late: d > limit * 0.62, need: d };
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
  const youLimit = (incomingOnBackhand(sh.to) ? YOU.bhReach : YOU.reach) * (sh.shot.id === 'smash' ? 0.78 : 1);
  if (d > youLimit) {
    const why = incomingOnBackhand(sh.to) ? '反手侧那一侧你更慢，' : '';
    endRally('opp', `${why}你没赶到，对方这拍${sh.shot.name}得分。`);
    return;
  }
  state.you.x = sh.to.x;
  state.you.y = sh.to.y;
  state.shuttle = null;
  const bh = incomingOnBackhand(sh.to);
  const fast = ['smash', 'drive', 'push'].includes(sh.shot.id);
  const noQuality = bh && (reach.late || (fast && d > 0.4) || d > 0.5);
  if (noQuality) {
    const sit = {
      x: clamp(W / 2 + (Math.random() - 0.5) * 1.1, 0.9, W - 0.9),
      y: clamp(NET + 2.1 + Math.random() * 1.6, NET + 1.8, NET + 4.2),
    };
    state.forcedWeak = true;
    state.incoming = sh.shot;
    setCall('你碰到了。反手侧身没转完，过渡又短又高——训练能过网，比赛就是给对方杀。');
    launch({ from: { ...state.you }, to: sit, shot: getShot('lift'), who: 'you', startH: 1.2 });
    return;
  }
  state.forcedWeak = false;
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
  const hit = executeYouShot(shot, dest, from);
  if (!hit.ok) {
    endRally('opp', hit.reason);
    return;
  }
  const drift = dist(dest, hit.dest);
  if (drift > 1.1) {
    setCall(`你想打${placeLabel(dest, true)}，实际落到${placeLabel(hit.dest, true)}。`);
  } else if (shot.id === 'drop' && sideOf(from, false) === 'backhand') {
    setCall('反手吊对角很帅。这拍碰巧过网了，落点多半偏浅，对方能抢。');
  } else if (shot.id === 'drop') {
    setCall(hit.skill > 0.7 ? '这拍吊球偶尔到位了。' : '吊球你一般，落点会漂。');
  }
  launch({ from, to: hit.dest, shot, who: 'you', startH: state.phase === 'serve' ? 1.7 : 1.45 });
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

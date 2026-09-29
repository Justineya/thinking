import {
  PORTRAITS,
  JOBS,
  pickFirm,
  firmHint,
  INITIAL_FAMILY,
  SCHOOL_STAGES,
  TOKEN_COST,
  JOB_CHOICES,
  JOB_SPECIAL,
  SOCIAL_ELITES,
  LOVE_CHOICES,
  LOVE_SPECIAL,
  LOVE_ULTRA,
  SHOP_ITEMS,
  CASH_LUXURIES,
  WEDDING_TIERS,
  INDUSTRIES,
} from './data/game-data.js';
import { calcSalary, canTryPromote, RANK_NAMES, yearsOnJob, PROMOTE_OPTIONS, promoteCashCost } from './data/economy.js';
import { pickRandomEvent, pickTarget } from './data/events.js';
import { randomBabyName, randomAdultName } from './data/names.js';

const TICK_MS = 3000;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const QUEUE_ORDER = { promote: 0, school: 1, work: 2, love: 3, marry: 4, baby: 5 };
const STAT_LABELS = { iq: '智商', mood: '心情', charm: '魅力', stamina: '体力' };

let state = JSON.parse(JSON.stringify(INITIAL_FAMILY));
let tickTimer = null;
let queue = [];
let currentEvent = null;
let tab = 'family';

const $ = (sel) => document.querySelector(sel);

function formatMoney(n) {
  const s = n < 0;
  const a = Math.abs(n);
  const core = a >= 10000 ? `${(a / 10000).toFixed(a >= 100000 ? 1 : 2).replace(/\.0+$/, '')}万` : `${Math.round(a)}`;
  return `${s ? '-' : ''}${core}`;
}

function getPerson(id) {
  return state.people.find((p) => p.id === id);
}
function getJob(jobId) {
  return JOBS.find((j) => j.id === jobId) || JOBS[0];
}
function jobLine(person) {
  const job = getJob(person.jobId);
  if (!person.company) return job.name;
  return `${job.name} · ${person.company}`;
}
function allSchools() {
  return SCHOOL_STAGES.flatMap((s) => [...s.choices, s.special, s.luxury].filter(Boolean));
}
function getSchoolById(schoolId) {
  return allSchools().find((s) => s.id === schoolId) || null;
}
function isModalOpen() {
  return $('#choiceModal').open;
}
function countChildren(person) {
  const ids = new Set([person.id, person.spouseId].filter(Boolean));
  return state.people.filter((p) => ids.has(p.parentId)).length;
}
function nextPersonId() {
  state.nextPersonNum = (state.nextPersonNum || 10) + 1;
  return `n${state.nextPersonNum}`;
}
function monthsSince(year, month) {
  if (!year) return 0;
  return (state.year - year) * 12 + (state.month - month);
}
function nextSchoolStage(person) {
  const idx = SCHOOL_STAGES.findIndex((s) => s.key === person.schoolStage);
  const from = idx < 0 ? 0 : idx + 1;
  for (let i = from; i < SCHOOL_STAGES.length; i++) {
    if (person.age >= SCHOOL_STAGES[i].age) return SCHOOL_STAGES[i];
  }
  return null;
}
function hasUni(person) {
  return (person.education || '').includes('大学') || (person.education || '').includes('贵族');
}
function eliteForJob(jobId) {
  return SOCIAL_ELITES.find((e) => e.jobId === jobId);
}
function jobAllowed(person, job) {
  const elite = eliteForJob(job.id);
  if (elite) return !!state[elite.once] && hasUni(person);
  if (job.id === 'civil' || job.id === 'engineer') return hasUni(person);
  if (job.id === 'didi' || job.id === 'factory') {
    return person.education.includes('高中') || hasUni(person);
  }
  return false;
}
function normalizePerson(p) {
  if (p.jobMonths == null) {
    const working = p.jobId && p.jobId !== 'student' && p.jobId !== 'retired';
    p.jobMonths = working ? Math.max(0, (p.age - 22) * 12) : 0;
  }
  p.jobRank = p.jobRank || 0;
  p.tempBonus = p.tempBonus || 0;
  if (!p.company && p.jobId && p.jobId !== 'student' && p.jobId !== 'retired') {
    p.company = pickFirm(p.jobId);
  }
  return p;
}

function logEvent(kind, title, text) {
  state.eventLog = state.eventLog || [];
  state.eventLog.unshift({
    year: state.year,
    month: state.month,
    kind,
    title,
    text,
  });
  state.eventLog = state.eventLog.slice(0, 80);
}

function personFlow(p) {
  if (p.jobId === 'student') {
    const s = getSchoolById(p.schoolId);
    return s ? -s.tuition : 0;
  }
  return calcSalary(p, getJob(p.jobId));
}
function industryIncome() {
  return INDUSTRIES.filter((i) => state.ownedIndustries.includes(i.id)).reduce((s, i) => s + i.income, 0);
}
function familyDelta() {
  return state.people.reduce((s, p) => s + personFlow(p), 0) + industryIncome();
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 1800);
}

function enqueue(item) {
  const key = `${item.type}:${item.personId}:${item.stage?.key || ''}`;
  const same = (q) => `${q.type}:${q.personId}:${q.stage?.key || ''}` === key;
  if (queue.some(same) || (currentEvent && same(currentEvent))) return;
  queue.push(item);
}

function lifeHint(person) {
  if (person.dating && !person.spouseId) {
    const left = Math.max(0, 6 - monthsSince(person.datingYear, person.datingMonth));
    return left ? `恋爱中（${person.dating.name}），约 ${left} 个月后结婚。` : '可以结婚了。';
  }
  if (person.jobId === 'student') {
    const stage = nextSchoolStage(person);
    if (stage) return `${stage.age}岁会弹出选${stage.label}。`;
    if (person.age >= 22) return '该找工作了。';
    return '在上学。';
  }
  if (!person.loveDrawn && person.age >= 22) return '有工作后会弹出对象列表。';
  return '人生节点到了会自动弹窗。';
}

function renderHud() {
  $('#cashLabel').textContent = formatMoney(state.cash);
  const d = familyDelta();
  $('#monthDelta').textContent = `${d >= 0 ? '+' : ''}${formatMoney(d)}/月`;
  $('#monthDelta').style.color = d >= 0 ? '#1a9d4a' : '#ff5b6e';
  $('#tokenLabel').textContent = String(state.tokens);
  $('#yearLabel').textContent = `${state.year}年`;
  $('#monthLabel').textContent = MONTHS[state.month - 1];
  $('#pauseIcon').textContent = state.paused ? '▶' : '⏸';
}

function renderTree() {
  const gens = new Map();
  for (const p of state.people) {
    if (!gens.has(p.generation)) gens.set(p.generation, []);
    gens.get(p.generation).push(p);
  }
  const rows = [...gens.entries()].sort((a, b) => a[0] - b[0]);
  $('#familyTree').innerHTML = rows
    .map(([gen, people], idx) => {
      const paired = new Set();
      const units = [];
      for (const p of people) {
        if (paired.has(p.id)) continue;
        if (p.spouseId) {
          const sp = getPerson(p.spouseId);
          if (sp && sp.generation === gen) {
            units.push(`<div class="couple">${nodeHtml(p)}${nodeHtml(sp)}</div>`);
            paired.add(p.id);
            paired.add(sp.id);
            continue;
          }
        }
        units.push(`<div class="couple">${nodeHtml(p)}</div>`);
        paired.add(p.id);
      }
      return `<div class="gen">${idx ? '<div class="gen-line"></div>' : ''}<div class="gen-kids">${units.join('')}</div></div>`;
    })
    .join('');
  $('#familyTree').querySelectorAll('.node').forEach((n) => {
    n.addEventListener('click', () => selectPerson(n.dataset.id));
  });
}

function nodeHtml(p) {
  const flow = personFlow(p);
  const pay =
    flow === 0
      ? '<div class="node__pay">0/月</div>'
      : `<div class="node__pay ${flow > 0 ? 'pos' : 'neg'}">${flow > 0 ? '+' : ''}${formatMoney(flow)}/月</div>`;
  const on = p.id === state.selectedId ? ' node--on' : '';
  return `
    <button type="button" class="node${on}" data-id="${p.id}">
      <img src="${PORTRAITS[p.portrait]}" alt="${p.name}" />
      <div class="node__name">${p.name}</div>
      ${pay}
    </button>`;
}

function isWide() {
  return window.matchMedia('(min-width: 960px)').matches;
}

function showSheetEmpty() {
  const sheet = $('#personSheet');
  sheet.hidden = false;
  $('#sheetEmpty').hidden = false;
  $('#sheetBody').hidden = true;
}

function hideSheet() {
  $('#personSheet').hidden = true;
}

function syncSheetLayout() {
  $('#app').dataset.tab = tab;
  if (tab !== 'family') {
    hideSheet();
    return;
  }
  if (state.selectedId && getPerson(state.selectedId)) {
    selectPerson(state.selectedId);
    return;
  }
  if (isWide()) showSheetEmpty();
  else hideSheet();
}

function selectPerson(id) {
  state.selectedId = id;
  const p = getPerson(id);
  if (!p) return;
  renderTree();
  const sheet = $('#personSheet');
  sheet.hidden = false;
  $('#sheetEmpty').hidden = true;
  $('#sheetBody').hidden = false;
  $('#sheetPortrait').src = PORTRAITS[p.portrait];
  $('#sheetName').textContent = p.name;
  $('#sheetMeta').textContent = `${p.age}岁 · ${p.role} · ${jobLine(p)}`;
  const school = getSchoolById(p.schoolId);
  const rel = p.spouseId
    ? `已婚 · ${getPerson(p.spouseId)?.name || ''}`
    : p.dating
      ? `恋爱中 · ${p.dating.name}`
      : '单身';
  const rank = getJob(p.jobId).id === 'student' || getJob(p.jobId).id === 'retired'
    ? '—'
    : `${RANK_NAMES[p.jobRank || 0]} · 工龄 ${yearsOnJob(p)}年`;
  $('#sheetFacts').innerHTML = `
    <div><dt>学历</dt><dd>${p.education}</dd></div>
    <div><dt>学校</dt><dd>${school ? school.name : '—'}</dd></div>
    <div><dt>职级</dt><dd>${rank}</dd></div>
    <div><dt>单位</dt><dd>${p.company || '—'}</dd></div>
    <div><dt>月流水</dt><dd>${formatMoney(personFlow(p))}</dd></div>
    <div><dt>感情</dt><dd>${rel}</dd></div>`;
  $('#sheetStats').innerHTML = Object.entries(p.stats)
    .map(
      ([k, v]) =>
        `<div class="stat-item"><span class="stat-item__label">${STAT_LABELS[k]}</span><span>${v}</span></div>`
    )
    .join('');
  $('#sheetHint').textContent = lifeHint(p);
}

function renderShop() {
  $('#shopList').innerHTML = SHOP_ITEMS.map((it) => {
    const ok = state.tokens >= it.cost;
    return `<button class="shop-row" data-id="${it.id}" ${ok ? '' : 'disabled'}>
      <div class="shop-row__txt"><b>${it.name}</b><span>${it.desc}</span></div>
      <span class="cost-pill">灵感 ${it.cost}</span>
    </button>`;
  }).join('');
  $('#shopList').querySelectorAll('.shop-row').forEach((btn) => {
    btn.addEventListener('click', () => buyShop(btn.dataset.id));
  });
  $('#jobRules').innerHTML = JOBS.map((j) => {
    const firms = firmHint(j.id);
    return `<div class="rule-row"><b>${j.name}</b><span>底薪 ${formatMoney(j.base ?? j.income)} · ${j.req}${firms ? ` · ${firms}` : ''} · ${j.desc}</span></div>`;
  }).join('');
  const lux = $('#luxList');
  if (lux) {
    lux.innerHTML = CASH_LUXURIES.map((it) => {
      const owned = it.once && state[it.once];
      const ok = !owned && state.cash >= it.cash;
      return `<button class="shop-row" data-lux="${it.id}" ${ok ? '' : 'disabled'}>
        <div class="shop-row__txt"><b>${it.name}</b><span>${it.desc}</span></div>
        <span class="cost-pill">${owned ? '已完成' : formatMoney(it.cash)}</span>
      </button>`;
    }).join('');
    lux.querySelectorAll('.shop-row').forEach((btn) => {
      btn.addEventListener('click', () => buyLuxury(btn.dataset.lux));
    });
  }
  const elites = $('#eliteList');
  if (elites) {
    elites.innerHTML = SOCIAL_ELITES.map((it) => {
      const owned = it.once && state[it.once];
      const ok = !owned && state.cash >= it.cash;
      return `<button class="shop-row" data-elite="${it.id}" ${ok ? '' : 'disabled'}>
        <div class="shop-row__txt"><b>${it.name}</b><span>${it.desc}</span></div>
        <span class="cost-pill">${owned ? '已完成' : formatMoney(it.cash)}</span>
      </button>`;
    }).join('');
    elites.querySelectorAll('.shop-row').forEach((btn) => {
      btn.addEventListener('click', () => buyLuxury(btn.dataset.elite));
    });
  }
}

function renderLog() {
  const rows = state.eventLog || [];
  $('#eventList').innerHTML = rows.length
    ? rows
        .map(
          (e) =>
            `<div class="log-row"><time>${e.year}年${e.month}月 · ${e.kind}</time><b>${e.title}</b><div>${e.text}</div></div>`
        )
        .join('')
    : '<p class="log-empty">还没有事件。走几个月就会出现随机事件或升职。</p>';
}

function buyShop(id) {
  const it = SHOP_ITEMS.find((x) => x.id === id);
  if (!it || state.tokens < it.cost) return toast('灵感不够');
  state.tokens -= it.cost;
  if (it.cash) state.cash += it.cash;
  if (it.stat) {
    for (const p of state.people) {
      p.stats[it.stat] = Math.min(100, p.stats[it.stat] + it.amount);
    }
  }
  if (it.tempBonus) {
    for (const p of state.people) {
      p.tempBonus = (p.tempBonus || 0) + it.tempBonus;
    }
  }
  logEvent('shop', it.name, `花 ${it.cost} 灵感：${it.desc}`);
  toast('兑换成功');
  renderAll();
}

function bumpStats(p, boost = {}) {
  for (const [k, v] of Object.entries(boost)) {
    if (p.stats[k] == null) continue;
    p.stats[k] = Math.max(5, Math.min(100, p.stats[k] + v));
  }
}

function buyLuxury(id) {
  const it = CASH_LUXURIES.find((x) => x.id === id) || SOCIAL_ELITES.find((x) => x.id === id);
  if (!it) return;
  if (it.once && state[it.once]) return toast('已经做过了');
  if (state.cash < it.cash) return toast('现金不够');
  state.cash -= it.cash;
  if (it.once) state[it.once] = true;
  if (it.stat) {
    for (const p of state.people) {
      p.stats[it.stat] = Math.min(100, p.stats[it.stat] + it.amount);
    }
  }
  if (it.boost) {
    const pool = state.people.filter((p) => p.jobId !== 'retired');
    const p = pool[Math.floor(Math.random() * pool.length)] || state.people[0];
    bumpStats(p, it.boost);
    const jobBit = it.jobId ? `解锁岗位：${getJob(it.jobId).name}。` : '';
    logEvent('shop', it.name, `${p.name} 见到了${it.who || it.name}。${jobBit}`.trim());
    toast(`${p.name} · ${it.name}`);
  } else if (it.studentIq) {
    const stu = state.people.filter((p) => p.jobId === 'student');
    const p = stu[Math.floor(Math.random() * stu.length)];
    if (p) {
      p.stats.iq = Math.min(100, p.stats.iq + it.studentIq);
      logEvent('shop', it.name, `${p.name} 智商 +${it.studentIq}`);
    } else logEvent('shop', it.name, '家里暂时没有在读学生。');
    toast(it.name);
  } else {
    logEvent('shop', it.name, `花 ${formatMoney(it.cash)}：${it.desc}`);
    toast(it.name);
  }
  renderAll();
}

function renderIndustry() {
  $('#industryGrid').innerHTML = INDUSTRIES.map((ind) => {
    const owned = state.ownedIndustries.includes(ind.id);
    return `<button class="plot" data-id="${ind.id}" ${owned ? 'disabled' : ''}>
      <div class="plot__emoji">${ind.emoji}</div>
      <b>${ind.name}</b>
      <small>${owned ? `已持有 · ${ind.income ? '+' + formatMoney(ind.income) + '/月' : '自住'}` : `购买 ${formatMoney(ind.cost)}`}</small>
    </button>`;
  }).join('');
  $('#industryGrid').querySelectorAll('.plot:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => buyIndustry(btn.dataset.id));
  });
}

function buyIndustry(id) {
  const ind = INDUSTRIES.find((x) => x.id === id);
  if (!ind || state.ownedIndustries.includes(id)) return;
  if (state.cash < ind.cost) return toast('现金不够');
  state.cash -= ind.cost;
  state.ownedIndustries.push(id);
  if (id === 'lab') {
    for (const p of state.people) p.stats.iq = Math.min(100, p.stats.iq + 4);
    logEvent('shop', '私人实验室', `砸下 ${formatMoney(ind.cost)}，全族智商 +4。`);
  }
  toast(`买下${ind.name}`);
  renderAll();
}

function setTab(name) {
  tab = name;
  $('#viewFamily').hidden = name !== 'family';
  $('#viewShop').hidden = name !== 'shop';
  $('#viewLog').hidden = name !== 'log';
  $('#viewIndustry').hidden = name !== 'industry';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.view === name));
  syncSheetLayout();
}

function openChoice(item) {
  const person = getPerson(item.personId);
  if (!person) {
    currentEvent = null;
    processQueue();
    return;
  }
  currentEvent = item;
  state.paused = true;
  stopTick();
  renderHud();
  const modal = $('#choiceModal');
  const list = $('#choiceList');
  $('#choicePortrait').src = PORTRAITS[person.portrait];
  $('#choiceAge').textContent = String(person.age);
  $('#choiceWho').textContent = person.name;
  const flow = personFlow(person);
  $('#choiceFlow').textContent = `${flow > 0 ? '+' : ''}${formatMoney(flow)}/月`;
  $('#choiceFlow').style.color = flow >= 0 ? '#1a9d4a' : '#ff5b6e';

  if (item.type === 'school') {
    $('#choiceStage').textContent = item.stage.label;
    $('#choiceTip').textContent = `${person.name} 到了上${item.stage.label}的年龄（${item.stage.tip}）`;
    list.innerHTML = item.stage.choices
      .map(
        (s) =>
          `<button type="button" class="opt" data-id="${s.id}">选择${s.name} <small>-${formatMoney(s.enroll)}</small></button>`
      )
      .join('') +
      `<button type="button" class="opt opt--green" data-special="1">选择${item.stage.special.name} <small>灵感 ${TOKEN_COST}</small></button>` +
      (item.stage.luxury
        ? `<button type="button" class="opt opt--gold" data-luxury="1">选择${item.stage.luxury.name} <small>-${formatMoney(item.stage.luxury.enroll)}</small></button>`
        : '');
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.special) {
          if (state.tokens < TOKEN_COST) return toast('灵感不够');
          state.tokens -= TOKEN_COST;
          applySchool(person, item.stage.special, item.stage);
          finishEvent();
          return;
        }
        if (btn.dataset.luxury) {
          const school = item.stage.luxury;
          if (state.cash < school.enroll) return toast('现金不够，先赚钱再上贵族');
          state.cash -= school.enroll;
          applySchool(person, school, item.stage);
          finishEvent();
          return;
        }
        const school = item.stage.choices.find((s) => s.id === btn.dataset.id);
        if (state.cash < school.enroll) return toast('现金不够');
        state.cash -= school.enroll;
        applySchool(person, school, item.stage);
        finishEvent();
      });
    });
  } else if (item.type === 'work') {
    $('#choiceStage').textContent = '工作';
    $('#choiceTip').textContent = `${person.name} 该找工作了。普通岗看学历；网红花灵感；名流局解锁的岗在金色按钮。`;
    const extraJobs = SOCIAL_ELITES.filter((e) => e.jobId && state[e.once])
      .map((e) => {
        const job = getJob(e.jobId);
        const sample = { ...person, jobId: job.id, jobMonths: 0, jobRank: 0, tempBonus: 0 };
        const ok = jobAllowed(person, job);
        return `<button type="button" class="opt opt--gold" data-elite-job="${job.id}" ${ok ? '' : 'disabled'}>${job.name} · ${firmHint(job.id)} <small>+${formatMoney(calcSalary(sample, job))}/月起</small></button>`;
      })
      .join('');
    list.innerHTML =
      JOB_CHOICES.map((id) => {
        const job = getJob(id);
        const ok = jobAllowed(person, job);
        const sample = { ...person, jobId: job.id, jobMonths: 0, jobRank: 0, tempBonus: 0 };
        return `<button type="button" class="opt" data-id="${job.id}" ${ok ? '' : 'disabled'}>${job.name} · ${firmHint(job.id)} <small>+${formatMoney(calcSalary(sample, job))}/月起</small></button>`;
      }).join('') +
      `<button type="button" class="opt opt--green" data-special="1">走网红路线 <small>灵感 ${TOKEN_COST}</small></button>` +
      extraJobs;
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (btn.dataset.special) {
          if (state.tokens < TOKEN_COST) return toast('灵感不够');
          state.tokens -= TOKEN_COST;
          applyJob(person, getJob(JOB_SPECIAL));
        } else if (btn.dataset.eliteJob) {
          const job = getJob(btn.dataset.eliteJob);
          if (!jobAllowed(person, job)) return toast('还没结识对应名流，或学历不够');
          applyJob(person, job);
        } else applyJob(person, getJob(btn.dataset.id));
        finishEvent();
      });
    });
  } else if (item.type === 'love') {
    const loves = (person.gender === 'male' ? LOVE_CHOICES.female : LOVE_CHOICES.male).map((s) => ({
      ...s,
      name: randomAdultName(s.gender, state.people),
    }));
    $('#choiceStage').textContent = '恋爱';
    $('#choiceTip').textContent = `${person.name} 可以谈恋爱了。普通人现金；高净值花灵感；硅谷投资人要百万现金。`;
    list.innerHTML =
      loves
        .map(
          (s, i) =>
            `<button type="button" class="opt" data-i="${i}">${s.name} · ${getJob(s.jobId).name}${firmHint(s.jobId) ? ' · ' + firmHint(s.jobId).split(' / ')[0] : ''} <small>${formatMoney(s.income)}/月</small></button>`
        )
        .join('') +
      `<button type="button" class="opt opt--green" data-special="1">接触高净值 <small>灵感 ${TOKEN_COST}</small></button>` +
      `<button type="button" class="opt opt--gold" data-ultra="1">结识硅谷投资人 <small>-${formatMoney(1280000)}</small></button>`;
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.special) {
          if (state.tokens < TOKEN_COST) return toast('灵感不够');
          state.tokens -= TOKEN_COST;
          const pack = person.gender === 'male' ? { ...LOVE_SPECIAL.female } : { ...LOVE_SPECIAL.male };
          pack.name = randomAdultName(pack.gender, state.people);
          startDating(person, pack);
        } else if (btn.dataset.ultra) {
          const pack = person.gender === 'male' ? { ...LOVE_ULTRA.female } : { ...LOVE_ULTRA.male };
          if (state.cash < pack.cost) return toast('现金不够，先去挥霍页攒钱');
          state.cash -= pack.cost;
          pack.name = randomAdultName(pack.gender, state.people);
          startDating(person, pack);
        } else startDating(person, loves[Number(btn.dataset.i)]);
        finishEvent();
      });
    });
  } else if (item.type === 'marry') {
    const partner = person.dating;
    $('#choiceStage').textContent = '结婚';
    $('#choiceTip').textContent = `和 ${partner?.name || ''} 办婚礼入谱。有钱可以把场面做大。`;
    const base = partner?.cost || 0;
    list.innerHTML = WEDDING_TIERS.map(
      (w) =>
        `<button type="button" class="opt${w.id === 'sat' ? ' opt--gold' : w.id === 'simple' ? ' opt--green' : ''}" data-wed="${w.id}">${w.name} <small>-${formatMoney(base + w.extra)}</small></button>`
    ).join('');
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = WEDDING_TIERS.find((x) => x.id === btn.dataset.wed);
        const total = base + (w?.extra || 0);
        if (state.cash < total) return toast('现金不够');
        if (partner) marryPerson(person, partner, w);
        finishEvent();
      });
    });
  } else if (item.type === 'baby') {
    $('#choiceStage').textContent = '孩子';
    $('#choiceTip').textContent = '结婚满一年（上一胎也要隔一年），可以生一个。名字从库里随机。';
    list.innerHTML = `<button type="button" class="opt opt--green">生孩子 <small>-8,000</small></button>`;
    list.querySelector('.opt').addEventListener('click', () => {
      haveChild(person);
      person.babyPending = false;
      finishEvent();
    });
  } else if (item.type === 'promote') {
    const next = RANK_NAMES[Math.min(2, (person.jobRank || 0) + 1)];
    $('#choiceStage').textContent = '升职';
    $('#choiceTip').textContent = `${person.name} 工龄 ${yearsOnJob(person)} 年，争取升为${next}。选方式，看概率，失败下次再来。`;
    list.innerHTML =
      PROMOTE_OPTIONS.map((opt) => {
        const cash = promoteCashCost(person, opt);
        const pay = cash ? `-${formatMoney(cash)}` : opt.tokens ? `灵感 ${opt.tokens}` : '免费';
        return `<button type="button" class="opt${opt.id === 'token' ? ' opt--green' : opt.id === 'gift' ? ' opt--gold' : ''}" data-pro="${opt.id}">${opt.name} · ${opt.hint} <small>${pay}</small></button>`;
      }).join('') + `<button type="button" class="opt" data-skip="1">先不升</button>`;
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.skip) {
          logEvent('special', '放弃升职', `${person.name} 暂时不升。`);
          finishEvent();
          return;
        }
        const opt = PROMOTE_OPTIONS.find((x) => x.id === btn.dataset.pro);
        if (!opt) return;
        const cash = promoteCashCost(person, opt);
        if (cash && state.cash < cash) return toast('现金不够');
        if (opt.tokens && state.tokens < opt.tokens) return toast('灵感不够');
        if (cash) state.cash -= cash;
        if (opt.tokens) state.tokens -= opt.tokens;
        const ok = Math.random() < opt.chance;
        if (ok) {
          person.jobRank = Math.min(2, (person.jobRank || 0) + 1);
          logEvent('special', '升职成功', `${person.name} 靠「${opt.name}」升为${RANK_NAMES[person.jobRank]}。`);
          toast(`${person.name} 升为${RANK_NAMES[person.jobRank]}`);
        } else {
          person.stats.mood = Math.max(20, person.stats.mood - 6);
          logEvent('special', '升职失败', `${person.name}「${opt.name}」没过，心情 -6。`);
          toast('这次没升上去');
        }
        finishEvent();
      });
    });
  }

  if (!modal.open) modal.showModal();
}

function applySchool(person, school, stage) {
  person.schoolId = school.id;
  person.schoolStage = stage.key;
  person.education = school.education || stage.education;
  person.jobId = 'student';
  person.income = 0;
  person.stats.iq = Math.min(100, person.stats.iq + (school.iqBonus || 0));
  person.stats.mood = Math.min(100, Math.max(0, person.stats.mood + (school.moodBonus || 0)));
  logEvent('special', `升学 · ${stage.label}`, `${person.name} 进入${school.name}。`);
}

function applyJob(person, job) {
  person.jobId = job.id;
  person.workDrawn = true;
  person.schoolId = null;
  person.jobMonths = 0;
  person.jobRank = 0;
  person.tempBonus = 0;
  person.company = pickFirm(job.id);
  person.income = calcSalary(person, job);
  logEvent('special', '入职', `${person.name} 入职${person.company || ''}，成为${job.name}。`);
}

function startDating(person, suitor) {
  person.loveDrawn = true;
  person.dating = { ...suitor, company: suitor.company || pickFirm(suitor.jobId) };
  person.datingYear = state.year;
  person.datingMonth = state.month;
  person.stats.mood = Math.min(100, person.stats.mood + 5);
}

function marryPerson(person, suitor, wedding) {
  const total = (suitor.cost || 0) + (wedding?.extra || 0);
  state.cash = Math.max(0, state.cash - total);
  person.dating = null;
  const spouseId = nextPersonId();
  state.people.push({
    id: spouseId,
    name: suitor.name,
    gender: suitor.gender,
    portrait: suitor.portrait,
    age: suitor.age,
    generation: person.generation,
    role: suitor.gender === 'female' ? '儿媳' : '女婿',
    parentId: null,
    spouseId: person.id,
    jobId: suitor.jobId,
    schoolId: null,
    schoolStage: 'uni',
    education: suitor.education,
    stats: { ...suitor.stats },
    income: suitor.income,
    jobMonths: Math.max(0, (suitor.age - 22) * 12),
    jobRank: 0,
    tempBonus: 0,
    loveDrawn: true,
    workDrawn: true,
    company: suitor.company || pickFirm(suitor.jobId),
  });
  person.spouseId = spouseId;
  person.marriedYear = state.year;
  person.marriedMonth = state.month;
  const bump = wedding?.mood || 0;
  person.stats.mood = Math.min(100, person.stats.mood + bump);
  logEvent('special', wedding?.name || '结婚', `${person.name} 与 ${suitor.name} ${wedding?.name || '结婚'}，花 ${formatMoney(total)}。`);
}

function haveChild(person) {
  const spouse = getPerson(person.spouseId);
  if (!spouse || countChildren(person) >= 2) return;
  const girl = Math.random() < 0.5;
  const gender = girl ? 'female' : 'male';
  const name = randomBabyName(gender, state.people);
  state.cash = Math.max(0, state.cash - 8000);
  state.people.push({
    id: nextPersonId(),
    name,
    gender,
    portrait: girl ? 'child_female' : 'child_male',
    age: 0,
    generation: person.generation + 1,
    role: girl ? '女儿' : '儿子',
    parentId: person.parentId ? person.id : spouse.id,
    spouseId: null,
    jobId: 'student',
    schoolId: null,
    schoolStage: null,
    education: '学前',
    stats: {
      iq: Math.min(100, Math.max(35, Math.round((person.stats.iq + spouse.stats.iq) / 2))),
      mood: 80,
      charm: Math.min(100, Math.max(35, Math.round((person.stats.charm + spouse.stats.charm) / 2))),
      stamina: 90,
    },
    income: 0,
    jobMonths: 0,
    jobRank: 0,
    tempBonus: 0,
  });
  person.lastBirthYear = state.year;
  person.lastBirthMonth = state.month;
  logEvent('special', '孩子', `${person.name} 家添了${name}。`);
}

function finishEvent() {
  currentEvent = null;
  $('#choiceModal').close();
  collectAgeEvents();
  renderAll();
  processQueue();
}

function processQueue() {
  if (isModalOpen() && currentEvent) return;
  if (!queue.length) {
    currentEvent = null;
    state.paused = false;
    renderHud();
    startTick();
    return;
  }
  queue.sort((a, b) => (QUEUE_ORDER[a.type] ?? 9) - (QUEUE_ORDER[b.type] ?? 9));
  openChoice(queue.shift());
}

function maybeRandomEvent() {
  if (Math.random() > 0.35) return;
  const ev = pickRandomEvent(state.people);
  if (!ev) return;
  const p = pickTarget(state.people, ev);
  if (!p) return;
  const extra = ev.apply(state, p) || '';
  logEvent('random', ev.title, `${ev.text(p)} ${extra}`.trim());
  toast(ev.title);
}

function maybePromote() {
  for (const p of state.people) {
    if (!canTryPromote(p)) continue;
    if ((p.jobMonths || 0) % 12 !== 0) continue;
    if (Math.random() > 0.22) continue;
    enqueue({ type: 'promote', personId: p.id });
  }
}

function collectAgeEvents() {
  for (const p of state.people) {
    if (p.jobId === 'retired') continue;
    const stage = nextSchoolStage(p);
    if (stage && p.jobId === 'student') enqueue({ type: 'school', personId: p.id, stage });
    if (!p.workDrawn && p.age >= 22 && p.jobId === 'student') enqueue({ type: 'work', personId: p.id });
    if (p.workDrawn && p.jobId !== 'student' && !p.spouseId && !p.dating && !p.loveDrawn && p.age >= 22) {
      enqueue({ type: 'love', personId: p.id });
    }
    if (p.dating && !p.spouseId && monthsSince(p.datingYear, p.datingMonth) >= 6) enqueue({ type: 'marry', personId: p.id });
    if (
      p.spouseId &&
      !p.babyPending &&
      monthsSince(p.marriedYear, p.marriedMonth) >= 12 &&
      (!p.lastBirthYear || monthsSince(p.lastBirthYear, p.lastBirthMonth) >= 12) &&
      countChildren(p) < 2 &&
      p.age <= 42 &&
      p.parentId
    ) {
      p.babyPending = true;
      enqueue({ type: 'baby', personId: p.id });
    }
  }
}

function advanceMonth() {
  state.month += 1;
  if (state.month > 12) {
    state.month = 1;
    state.year += 1;
    state.tokens += 1;
    for (const p of state.people) {
      p.age += 1;
      if (p.age === 60 && p.jobId !== 'retired') {
        p.jobId = 'retired';
        p.jobMonths = 0;
        p.company = '';
        p.income = getJob('retired').income;
        p.workDrawn = true;
        logEvent('special', '退休', `${p.name} 退休领养老金。`);
      }
    }
  }
  for (const p of state.people) {
    if (p.jobId !== 'student' && p.jobId !== 'retired') p.jobMonths = (p.jobMonths || 0) + 1;
  }
  maybeRandomEvent();
  for (const p of state.people) p.income = personFlow(p);
  state.cash += familyDelta();
  for (const p of state.people) p.tempBonus = 0;
  maybePromote();
  collectAgeEvents();
}

function tick() {
  if (state.paused || isModalOpen() || queue.length) return;
  advanceMonth();
  renderAll();
  if (queue.length) processQueue();
}
function startTick() {
  stopTick();
  if (!state.paused) tickTimer = setInterval(tick, TICK_MS);
}
function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function renderAll() {
  renderHud();
  renderTree();
  renderShop();
  renderLog();
  renderIndustry();
  if (state.selectedId && getPerson(state.selectedId) && !$('#personSheet').hidden && !$('#sheetBody').hidden) {
    selectPerson(state.selectedId);
  }
}

function bindUI() {
  $('#pauseBtn').addEventListener('click', () => {
    if (isModalOpen()) return;
    state.paused = !state.paused;
    renderHud();
    if (state.paused) stopTick();
    else startTick();
  });
  $('#closeSheet').addEventListener('click', () => {
    state.selectedId = null;
    renderTree();
    syncSheetLayout();
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.view)));
  $('#choiceModal').addEventListener('cancel', (e) => e.preventDefault());
  window.addEventListener('resize', () => syncSheetLayout());
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (isModalOpen()) return;
      state.paused = !state.paused;
      renderHud();
      if (state.paused) stopTick();
      else startTick();
    }
    if (e.key === 'Escape' && !isModalOpen()) {
      state.selectedId = null;
      renderTree();
      syncSheetLayout();
    }
  });
  $('#gmBar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.add) {
      state.tokens += Number(btn.dataset.add);
      toast(`灵感 ${state.tokens}`);
    }
    if (btn.dataset.set) {
      state.tokens = Number(btn.dataset.set);
      toast(`灵感 ${state.tokens}`);
    }
    if (btn.dataset.cash) {
      state.cash += Number(btn.dataset.cash);
      toast(`现金 ${formatMoney(state.cash)}`);
    }
    if (btn.dataset.event) {
      const ev = pickRandomEvent(state.people);
      const p = ev && pickTarget(state.people, ev);
      if (!ev || !p) return toast('没有可抽的事件');
      const extra = ev.apply(state, p) || '';
      logEvent('random', ev.title, `${ev.text(p)} ${extra}`.trim());
      toast(ev.title);
    }
    if (btn.dataset.promote) {
      const p = state.people.find((x) => x.jobId !== 'student' && x.jobId !== 'retired' && (x.jobRank || 0) < 2);
      if (!p) return toast('没人能升');
      p.jobMonths = Math.max(p.jobMonths || 0, 24);
      enqueue({ type: 'promote', personId: p.id });
      processQueue();
      return;
    }
    renderAll();
  });
}

function init() {
  state.people.forEach(normalizePerson);
  bindUI();
  renderAll();
  syncSheetLayout();
  collectAgeEvents();
  processQueue();
}

init();

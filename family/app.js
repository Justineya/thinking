import {
  PORTRAITS,
  JOBS,
  INITIAL_FAMILY,
  SCHOOL_STAGES,
  TOKEN_COST,
  JOB_CHOICES,
  JOB_SPECIAL,
  LOVE_CHOICES,
  LOVE_SPECIAL,
  BABY_NAMES,
  SHOP_ITEMS,
  INDUSTRIES,
} from './data/game-data.js';

const TICK_MS = 3000;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const QUEUE_ORDER = { school: 0, work: 1, love: 2, marry: 3, baby: 4 };
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
function allSchools() {
  return SCHOOL_STAGES.flatMap((s) => [...s.choices, s.special]);
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
function jobAllowed(person, job) {
  if (job.id === 'civil' || job.id === 'engineer') return person.education.includes('大学');
  if (job.id === 'didi' || job.id === 'factory') {
    return person.education.includes('高中') || person.education.includes('大学');
  }
  return false;
}
function personFlow(p) {
  if (p.jobId === 'student') {
    const s = getSchoolById(p.schoolId);
    return s ? -s.tuition : 0;
  }
  return p.income || 0;
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

function selectPerson(id) {
  state.selectedId = id;
  const p = getPerson(id);
  if (!p) return;
  renderTree();
  const sheet = $('#personSheet');
  sheet.hidden = false;
  $('#sheetPortrait').src = PORTRAITS[p.portrait];
  $('#sheetName').textContent = p.name;
  $('#sheetMeta').textContent = `${p.age}岁 · ${p.role} · ${getJob(p.jobId).name}`;
  const school = getSchoolById(p.schoolId);
  const rel = p.spouseId
    ? `已婚 · ${getPerson(p.spouseId)?.name || ''}`
    : p.dating
      ? `恋爱中 · ${p.dating.name}`
      : '单身';
  $('#sheetFacts').innerHTML = `
    <div><dt>学历</dt><dd>${p.education}</dd></div>
    <div><dt>学校</dt><dd>${school ? school.name : '—'}</dd></div>
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
  toast('兑换成功');
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
  toast(`买下${ind.name}`);
  renderAll();
}

function setTab(name) {
  tab = name;
  $('#viewFamily').hidden = name !== 'family';
  $('#viewShop').hidden = name !== 'shop';
  $('#viewIndustry').hidden = name !== 'industry';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.view === name));
  if (name !== 'family') $('#personSheet').hidden = true;
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
      `<button type="button" class="opt opt--green" data-special="1">选择${item.stage.special.name} <small>灵感 ${TOKEN_COST}</small></button>`;
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.special) {
          if (state.tokens < TOKEN_COST) return toast('灵感不够');
          state.tokens -= TOKEN_COST;
          applySchool(person, item.stage.special, item.stage);
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
    $('#choiceTip').textContent = `${person.name} 该找工作了。按学历选；网红要花灵感。`;
    list.innerHTML =
      JOB_CHOICES.map((id) => {
        const job = getJob(id);
        const ok = jobAllowed(person, job);
        return `<button type="button" class="opt" data-id="${job.id}" ${ok ? '' : 'disabled'}>${job.name} <small>+${formatMoney(job.income)}/月</small></button>`;
      }).join('') +
      `<button type="button" class="opt opt--green" data-special="1">走网红路线 <small>灵感 ${TOKEN_COST}</small></button>`;
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (btn.dataset.special) {
          if (state.tokens < TOKEN_COST) return toast('灵感不够');
          state.tokens -= TOKEN_COST;
          applyJob(person, getJob(JOB_SPECIAL));
        } else applyJob(person, getJob(btn.dataset.id));
        finishEvent();
      });
    });
  } else if (item.type === 'love') {
    const loves = person.gender === 'male' ? LOVE_CHOICES.female : LOVE_CHOICES.male;
    $('#choiceStage').textContent = '恋爱';
    $('#choiceTip').textContent = `${person.name} 可以谈恋爱了。先恋爱，暂不结婚。高净值花灵感。`;
    list.innerHTML =
      loves
        .map(
          (s, i) =>
            `<button type="button" class="opt" data-i="${i}">${s.name} · ${getJob(s.jobId).name} <small>${formatMoney(s.income)}/月</small></button>`
        )
        .join('') +
      `<button type="button" class="opt opt--green" data-special="1">接触高净值 <small>灵感 ${TOKEN_COST}</small></button>`;
    list.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.special) {
          if (state.tokens < TOKEN_COST) return toast('灵感不够');
          state.tokens -= TOKEN_COST;
          startDating(person, person.gender === 'male' ? LOVE_SPECIAL.female : LOVE_SPECIAL.male);
        } else startDating(person, loves[Number(btn.dataset.i)]);
        finishEvent();
      });
    });
  } else if (item.type === 'marry') {
    const partner = person.dating;
    $('#choiceStage').textContent = '结婚';
    $('#choiceTip').textContent = `和 ${partner?.name || ''} 谈了一段时间，办婚礼入谱。`;
    list.innerHTML = `<button type="button" class="opt opt--green" data-yes="1">结婚 <small>-${formatMoney(partner?.cost || 0)}</small></button>`;
    list.querySelector('.opt').addEventListener('click', () => {
      if (partner) marryPerson(person, partner);
      finishEvent();
    });
  } else if (item.type === 'baby') {
    $('#choiceStage').textContent = '孩子';
    $('#choiceTip').textContent = '结婚满一年，可以生一个（¥8,000）。';
    list.innerHTML = `<button type="button" class="opt opt--green">生孩子 <small>-8,000</small></button>`;
    list.querySelector('.opt').addEventListener('click', () => {
      haveChild(person);
      person.babyPending = false;
      finishEvent();
    });
  }

  if (!modal.open) modal.showModal();
}

function applySchool(person, school, stage) {
  person.schoolId = school.id;
  person.schoolStage = stage.key;
  person.education = stage.education;
  person.jobId = 'student';
  person.income = 0;
  person.stats.iq = Math.min(100, person.stats.iq + (school.iqBonus || 0));
  person.stats.mood = Math.min(100, Math.max(0, person.stats.mood + (school.moodBonus || 0)));
}

function applyJob(person, job) {
  person.jobId = job.id;
  person.workDrawn = true;
  person.schoolId = null;
  person.income = job.incomeVariance
    ? Math.round(job.income * (1 + (Math.random() * 2 - 1) * job.incomeVariance))
    : job.income;
}

function startDating(person, suitor) {
  person.loveDrawn = true;
  person.dating = { ...suitor };
  person.datingYear = state.year;
  person.datingMonth = state.month;
  person.stats.mood = Math.min(100, person.stats.mood + 5);
}

function marryPerson(person, suitor) {
  state.cash = Math.max(0, state.cash - suitor.cost);
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
    loveDrawn: true,
    workDrawn: true,
  });
  person.spouseId = spouseId;
  person.marriedYear = state.year;
  person.marriedMonth = state.month;
}

function haveChild(person) {
  const spouse = getPerson(person.spouseId);
  if (!spouse || countChildren(person) >= 2) return;
  const girl = Math.random() < 0.5;
  const gender = girl ? 'female' : 'male';
  const used = new Set(state.people.map((p) => p.name));
  const names = BABY_NAMES[gender].filter((n) => !used.has(n));
  state.cash = Math.max(0, state.cash - 8000);
  state.people.push({
    id: nextPersonId(),
    name: names[0] || (girl ? '陈宝贝' : '陈小子'),
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
  });
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
        p.income = getJob('retired').income;
        p.workDrawn = true;
      }
    }
  }
  state.cash += familyDelta();
  collectAgeEvents();
}

function tick() {
  if (state.paused || isModalOpen() || queue.length) return;
  advanceMonth();
  renderHud();
  if (queue.length) {
    renderAll();
    processQueue();
  }
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
  renderIndustry();
  if (state.selectedId && getPerson(state.selectedId) && !$('#personSheet').hidden) selectPerson(state.selectedId);
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
    $('#personSheet').hidden = true;
    state.selectedId = null;
    renderTree();
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.view)));
  $('#choiceModal').addEventListener('cancel', (e) => e.preventDefault());
}

function init() {
  bindUI();
  renderAll();
  collectAgeEvents();
  processQueue();
}

init();

import {
  PORTRAITS,
  JOBS,
  INITIAL_FAMILY,
  SCHOOL_STAGES,
  GACHA_RATES,
  LOVE_POOLS,
  JOB_POOLS,
  BABY_NAMES,
} from './data/game-data.js';

const TICK_MS = 3000;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** @type {typeof INITIAL_FAMILY} */
let state = JSON.parse(JSON.stringify(INITIAL_FAMILY));
let tickTimer = null;
/** @type {Array<{type: string, personId: string, stage?: object}>} */
let queue = [];
/** @type {null | {type: string, personId: string, stage?: object, rarity?: string, payload?: object}} */
let currentDraw = null;

const $ = (sel) => document.querySelector(sel);

const dateLabel = $('#dateLabel');
const cashLabel = $('#cashLabel');
const assetsLabel = $('#assetsLabel');
const pauseBtn = $('#pauseBtn');
const pauseIcon = $('#pauseIcon');
const familyTree = $('#familyTree');
const detailPanel = $('#detailPanel');
const detailName = $('#detailName');
const detailPortrait = $('#detailPortrait');
const detailAge = $('#detailAge');
const detailRole = $('#detailRole');
const detailStats = $('#detailStats');
const closeDetail = $('#closeDetail');
const gachaModal = $('#gachaModal');
const gachaBadge = $('#gachaBadge');
const gachaTitle = $('#gachaTitle');
const gachaBody = $('#gachaBody');
const gachaCard = $('#gachaCard');
const gachaRarity = $('#gachaRarity');
const gachaCardName = $('#gachaCardName');
const gachaCardDesc = $('#gachaCardDesc');
const gachaCardMeta = $('#gachaCardMeta');
const gachaDrawBtn = $('#gachaDrawBtn');
const gachaAcceptBtn = $('#gachaAcceptBtn');

function formatMoney(n) {
  return `¥${Math.round(n).toLocaleString('zh-CN')}`;
}

function getPerson(id) {
  return state.people.find((p) => p.id === id);
}

function getJob(jobId) {
  return JOBS.find((j) => j.id === jobId) || JOBS[0];
}

function getSchoolById(schoolId) {
  for (const stage of SCHOOL_STAGES) {
    for (const school of Object.values(stage.pools)) {
      if (school.id === schoolId) return school;
    }
  }
  return null;
}

function isModalOpen() {
  return gachaModal.open;
}

function countChildren(person) {
  const ids = new Set([person.id, person.spouseId].filter(Boolean));
  return state.people.filter((p) => ids.has(p.parentId)).length;
}

function nextPersonId() {
  state.nextPersonNum = (state.nextPersonNum || 10) + 1;
  return `n${state.nextPersonNum}`;
}

function rollRarity() {
  const total = GACHA_RATES.reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * total;
  for (const row of GACHA_RATES) {
    n -= row.weight;
    if (n <= 0) return row.rarity;
  }
  return 'N';
}

function enqueue(item) {
  const key = `${item.type}:${item.personId}:${item.stage?.key || ''}`;
  if (queue.some((q) => `${q.type}:${q.personId}:${q.stage?.key || ''}` === key)) return;
  if (
    currentDraw &&
    `${currentDraw.type}:${currentDraw.personId}:${currentDraw.stage?.key || ''}` === key
  ) {
    return;
  }
  queue.push(item);
}

function renderTopBar() {
  dateLabel.textContent = `${state.year}年${MONTHS[state.month - 1]}`;
  cashLabel.textContent = formatMoney(state.cash);
  assetsLabel.textContent = formatMoney(state.assets);
  pauseIcon.textContent = state.paused ? '▶' : '⏸';
}

function buildGenerationRows() {
  const gens = new Map();
  for (const p of state.people) {
    if (!gens.has(p.generation)) gens.set(p.generation, []);
    gens.get(p.generation).push(p);
  }
  return [...gens.entries()].sort((a, b) => a[0] - b[0]);
}

function renderPersonCard(person) {
  const job = getJob(person.jobId);
  const incomeText = person.income > 0 ? `${formatMoney(person.income)}/月` : '暂无收入';
  const pending = queue.some((q) => q.personId === person.id) || currentDraw?.personId === person.id;
  const pulse = pending ? ' person-card--pulse' : '';
  const selected = person.id === state.selectedId ? ' person-card--selected' : '';

  return `
    <article class="person-card${selected}${pulse}" data-id="${person.id}" role="button" tabindex="0" aria-label="${person.name}">
      <img class="person-card__portrait" src="${PORTRAITS[person.portrait]}" alt="${person.name}" loading="lazy" />
      <div class="person-card__name">${person.name}</div>
      <div class="person-card__info">${person.age}岁 · ${job.name}</div>
      <div class="person-card__income">${incomeText}</div>
    </article>
  `;
}

function renderCouple(personA, personB) {
  const cards = [personA, personB].filter(Boolean).map(renderPersonCard).join('');
  return `<div class="couple-wrap">${cards}</div>`;
}

function renderFamilyTree() {
  const rows = buildGenerationRows();
  const genNames = ['祖辈', '父母辈', '子女辈', '孙辈'];

  familyTree.innerHTML = rows
    .map(([gen, people], idx) => {
      const label = genNames[gen] || `第${gen + 1}代`;
      const isLast = idx === rows.length - 1;
      return `
        <section class="gen-row${isLast ? ' gen-row--last' : ''}">
          <div class="gen-label">${label}</div>
          ${renderGeneration(people)}
        </section>
      `;
    })
    .join('');

  familyTree.querySelectorAll('.person-card').forEach((card) => {
    card.addEventListener('click', () => selectPerson(card.dataset.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPerson(card.dataset.id);
      }
    });
  });
}

function renderGeneration(people) {
  const paired = new Set();
  const units = [];

  for (const p of people) {
    if (paired.has(p.id)) continue;
    if (p.spouseId) {
      const spouse = getPerson(p.spouseId);
      if (spouse && spouse.generation === p.generation) {
        units.push(renderCouple(p, spouse));
        paired.add(p.id);
        paired.add(spouse.id);
        continue;
      }
    }
    units.push(`<div class="couple-wrap">${renderPersonCard(p)}</div>`);
    paired.add(p.id);
  }

  if (units.length > 1) return `<div class="gen-units">${units.join('')}</div>`;
  return units.join('');
}

function renderStats(person) {
  const labels = { iq: '智商', mood: '心情', charm: '魅力', stamina: '体力' };
  detailStats.innerHTML = Object.entries(person.stats)
    .map(
      ([key, val]) => `
      <div class="stat-item">
        <span class="stat-item__label">${labels[key]}</span>
        <span class="stat-item__value">${val}</span>
      </div>
    `
    )
    .join('');
}

function selectPerson(id) {
  state.selectedId = id;
  const person = getPerson(id);
  if (!person) return;

  renderFamilyTree();
  detailPanel.hidden = false;
  detailName.textContent = person.name;
  detailPortrait.src = PORTRAITS[person.portrait];
  detailPortrait.alt = person.name;
  detailAge.textContent = `${person.age}岁 · ${person.education}`;
  detailRole.textContent = `${person.role} · ${getJob(person.jobId).name}`;
  renderStats(person);
}

function pauseForDialog() {
  state.paused = true;
  stopTick();
  renderTopBar();
}

function resumeIfIdle() {
  if (isModalOpen() || queue.length) return;
  state.paused = false;
  renderTopBar();
  startTick();
}

function openGachaPrompt(item) {
  const person = getPerson(item.personId);
  if (!person) {
    currentDraw = null;
    processQueue();
    return;
  }
  currentDraw = { ...item, rarity: null, payload: null };
  pauseForDialog();
  gachaCard.hidden = true;
  gachaAcceptBtn.hidden = true;
  gachaDrawBtn.hidden = false;

  if (item.type === 'school') {
    gachaBadge.textContent = `${item.stage.label}升学`;
    gachaTitle.textContent = `${person.name}满${item.stage.age}岁`;
    gachaBody.textContent = `该选${item.stage.label}了。抽一次录取：N 普通，SSR 破格进名校。`;
    gachaDrawBtn.textContent = '抽录取';
  } else if (item.type === 'love') {
    gachaBadge.textContent = '恋爱';
    gachaTitle.textContent = `${person.name}到了适婚年龄`;
    gachaBody.textContent = '抽一次对象：N 普通，SSR 高净值网红。抽中即结婚入谱。';
    gachaDrawBtn.textContent = '抽恋爱';
  } else if (item.type === 'work') {
    gachaBadge.textContent = '就业';
    gachaTitle.textContent = `${person.name}该工作了`;
    gachaBody.textContent = '抽一次职业：N 网约车，SSR 网红。';
    gachaDrawBtn.textContent = '抽职业';
  } else if (item.type === 'baby') {
    gachaBadge.textContent = '下一代';
    gachaTitle.textContent = `${person.name}想要孩子`;
    gachaBody.textContent = '结婚满一年。生一个（¥8,000）或再等一等。';
    gachaDrawBtn.hidden = true;
    gachaAcceptBtn.hidden = false;
    gachaAcceptBtn.textContent = '生孩子';
    gachaCard.hidden = true;
  }

  if (!gachaModal.open) gachaModal.showModal();
  renderFamilyTree();
}

function processQueue() {
  if (isModalOpen() && currentDraw) return;
  if (!queue.length) {
    currentDraw = null;
    resumeIfIdle();
    return;
  }
  openGachaPrompt(queue.shift());
}

function revealDraw() {
  if (!currentDraw) return;
  const person = getPerson(currentDraw.personId);
  if (!person) return;
  const rarity = rollRarity();
  currentDraw.rarity = rarity;

  if (currentDraw.type === 'school') {
    const school = currentDraw.stage.pools[rarity];
    currentDraw.payload = school;
    gachaCardName.textContent = school.name;
    gachaCardDesc.textContent = school.desc;
    gachaCardMeta.textContent =
      school.tuition > 0 ? `学费 ${formatMoney(school.tuition)}/月` : '免学费 · 破格录取';
  } else if (currentDraw.type === 'love') {
    const pool = person.gender === 'male' ? LOVE_POOLS.female : LOVE_POOLS.male;
    const suitor = pool[rarity];
    currentDraw.payload = suitor;
    const job = getJob(suitor.jobId);
    gachaCardName.textContent = `${suitor.name} · ${job.name}`;
    gachaCardDesc.textContent = suitor.desc;
    gachaCardMeta.textContent = `婚礼 ${formatMoney(suitor.cost)} · ${formatMoney(suitor.income)}/月`;
  } else if (currentDraw.type === 'work') {
    const job = getJob(JOB_POOLS[rarity].jobId);
    currentDraw.payload = job;
    gachaCardName.textContent = job.name;
    gachaCardDesc.textContent = job.desc;
    gachaCardMeta.textContent = job.income ? `${formatMoney(job.income)}/月` : '无收入';
  }

  gachaRarity.textContent = rarity === 'SSR' ? 'SSR 传说' : rarity;
  gachaCard.hidden = false;
  gachaCard.dataset.rarity = rarity;
  gachaDrawBtn.hidden = true;
  gachaAcceptBtn.hidden = false;
  gachaAcceptBtn.textContent = '收下';
}

function applyDraw() {
  if (!currentDraw) return;
  const person = getPerson(currentDraw.personId);
  if (!person) {
    finishDraw();
    return;
  }

  if (currentDraw.type === 'school') {
    const school = currentDraw.payload;
    person.schoolId = school.id;
    person.schoolStage = currentDraw.stage.key;
    person.education = currentDraw.stage.education;
    person.jobId = 'student';
    person.income = 0;
    person.stats.iq = Math.min(100, person.stats.iq + (school.iqBonus || 0));
    person.stats.mood = Math.min(100, Math.max(0, person.stats.mood + (school.moodBonus || 0)));
    person.stats.charm = Math.min(100, person.stats.charm + (school.charmBonus || 0));
  } else if (currentDraw.type === 'love') {
    marryPerson(person, currentDraw.payload);
  } else if (currentDraw.type === 'work') {
    const job = currentDraw.payload;
    person.jobId = job.id;
    person.workDrawn = true;
    person.schoolId = null;
    if (job.incomeVariance) {
      const variance = 1 + (Math.random() * 2 - 1) * job.incomeVariance;
      person.income = Math.round(job.income * variance);
    } else {
      person.income = job.income;
    }
  } else if (currentDraw.type === 'baby') {
    haveChild(person);
    person.babyPending = false;
  }

  finishDraw();
}

function finishDraw() {
  currentDraw = null;
  gachaModal.close();
  renderAll();
  processQueue();
}

function marryPerson(person, suitor) {
  const cost = Math.min(state.cash, suitor.cost);
  state.cash -= cost;
  person.loveDrawn = true;
  const spouseId = nextPersonId();
  const spouse = {
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
  };
  person.spouseId = spouseId;
  person.marriedYear = state.year;
  person.marriedMonth = state.month;
  state.people.push(spouse);
  person.stats.mood = Math.min(100, person.stats.mood + 8);
}

function haveChild(person) {
  const spouse = getPerson(person.spouseId);
  if (!spouse) return;
  if (countChildren(person) >= 2) return;
  const girl = Math.random() < 0.5;
  const gender = girl ? 'female' : 'male';
  const used = new Set(state.people.map((p) => p.name));
  const names = BABY_NAMES[gender].filter((n) => !used.has(n));
  const name = names[0] || (girl ? '陈宝贝' : '陈小子');
  const bloodId = person.parentId ? person.id : spouse.id;
  const child = {
    id: nextPersonId(),
    name,
    gender,
    portrait: girl ? 'child_female' : 'child_male',
    age: 0,
    generation: person.generation + 1,
    role: girl ? '女儿' : '儿子',
    parentId: bloodId,
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
  };
  state.cash = Math.max(0, state.cash - 8000);
  state.people.push(child);
}

function monthsMarried(person) {
  if (!person.marriedYear) return 0;
  return (state.year - person.marriedYear) * 12 + (state.month - person.marriedMonth);
}

function collectAgeEvents() {
  for (const p of state.people) {
    for (const stage of SCHOOL_STAGES) {
      if (p.age === stage.age && p.schoolStage !== stage.key && p.jobId !== 'retired') {
        enqueue({ type: 'school', personId: p.id, stage });
      }
    }
    if (p.age === 18 && !p.spouseId && !p.loveDrawn && p.jobId !== 'retired') {
      enqueue({ type: 'love', personId: p.id });
    }
    if (p.age === 22 && !p.workDrawn && p.jobId === 'student') {
      enqueue({ type: 'work', personId: p.id });
    }
    if (p.spouseId && !p.babyPending && monthsMarried(p) >= 12 && countChildren(p) < 2 && p.age <= 42 && p.parentId) {
      p.babyPending = true;
      enqueue({ type: 'baby', personId: p.id });
    }
  }
}

function seedOpeningEvents() {
  const xiaoyu = getPerson('c1');
  if (xiaoyu) enqueue({ type: 'school', personId: 'c1', stage: SCHOOL_STAGES.find((s) => s.key === 'middle') });
  const xiaofeng = getPerson('c0');
  if (xiaofeng) enqueue({ type: 'love', personId: 'c0' });
}

function advanceMonth() {
  state.month += 1;
  if (state.month > 12) {
    state.month = 1;
    state.year += 1;
    for (const p of state.people) {
      p.age += 1;
      if (p.age === 60 && p.jobId !== 'retired') {
        p.jobId = 'retired';
        p.income = getJob('retired').income;
        p.workDrawn = true;
      }
    }
  }

  let monthlyIncome = 0;
  let monthlyTuition = 0;
  for (const p of state.people) {
    monthlyIncome += p.income || 0;
    if (p.schoolId && p.jobId === 'student') {
      const school = getSchoolById(p.schoolId);
      if (school) monthlyTuition += school.tuition;
    }
    if (p.jobId === 'student') {
      p.stats.stamina = Math.min(100, p.stats.stamina + 1);
    }
  }
  state.cash += monthlyIncome - monthlyTuition;

  collectAgeEvents();
}

function tick() {
  if (state.paused || isModalOpen() || queue.length) return;
  advanceMonth();
  renderTopBar();
  if (queue.length) {
    renderFamilyTree();
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
  renderTopBar();
  renderFamilyTree();
  if (state.selectedId && getPerson(state.selectedId)) selectPerson(state.selectedId);
}

function bindUI() {
  pauseBtn.addEventListener('click', () => {
    if (isModalOpen()) return;
    state.paused = !state.paused;
    renderTopBar();
    if (state.paused) stopTick();
    else startTick();
  });

  closeDetail.addEventListener('click', () => {
    detailPanel.hidden = true;
    state.selectedId = null;
    renderFamilyTree();
  });

  gachaDrawBtn.addEventListener('click', revealDraw);
  gachaAcceptBtn.addEventListener('click', applyDraw);
  gachaModal.addEventListener('cancel', (e) => e.preventDefault());
}

function init() {
  bindUI();
  renderAll();
  seedOpeningEvents();
  processQueue();
}

init();

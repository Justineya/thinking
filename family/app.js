import {
  PORTRAITS,
  SCHOOLS,
  JOBS,
  INITIAL_FAMILY,
  SAMPLE_EVENT,
} from './data/game-data.js';

const TICK_MS = 3000;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** @type {typeof INITIAL_FAMILY} */
let state = JSON.parse(JSON.stringify(INITIAL_FAMILY));
let tickTimer = null;
let eventShown = false;

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
const schoolBtn = $('#schoolBtn');
const workBtn = $('#workBtn');
const closeDetail = $('#closeDetail');
const schoolModal = $('#schoolModal');
const workModal = $('#workModal');
const eventModal = $('#eventModal');
const schoolList = $('#schoolList');
const workList = $('#workList');
const schoolModalSub = $('#schoolModalSub');
const workModalSub = $('#workModalSub');
const eventTitle = $('#eventTitle');
const eventBody = $('#eventBody');
const eventChoices = $('#eventChoices');

function formatMoney(n) {
  return `¥${Math.round(n).toLocaleString('zh-CN')}`;
}

function getPerson(id) {
  return state.people.find((p) => p.id === id);
}

function getJob(jobId) {
  return JOBS.find((j) => j.id === jobId) || JOBS[0];
}

function getSchool(schoolId) {
  return SCHOOLS.find((s) => s.id === schoolId);
}

function isModalOpen() {
  return schoolModal.open || workModal.open || eventModal.open;
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
  const pulse = person.needsSchoolChoice ? ' person-card--pulse' : '';
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
  const genNames = ['祖辈', '父母辈', '子女辈'];

  familyTree.innerHTML = rows
    .map(([gen, people], idx) => {
      const label = genNames[gen] || `第${gen + 1}代`;
      const isLast = idx === rows.length - 1;
      const rendered = renderGeneration(people);
      const connector = isLast ? '' : '<div class="connector-v"></div>';
      return `
        <section class="gen-row${isLast ? ' gen-row--last' : ''}">
          <div class="gen-label">${label}</div>
          ${rendered}
        </section>
        ${connector}
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

  if (units.length > 1) {
    return `<div style="display:flex;align-items:flex-start;gap:8px;justify-content:center;width:100%;">${units.join('<div class="connector-h"></div>')}</div>`;
  }
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
  document.getElementById('app').classList.add('is-detail-open');
  requestAnimationFrame(() => {
    familyTree
      .querySelector(`.person-card[data-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  detailName.textContent = person.name;
  detailPortrait.src = PORTRAITS[person.portrait];
  detailPortrait.alt = person.name;
  detailAge.textContent = `${person.age}岁 · ${person.education}`;
  detailRole.textContent = `${person.role} · ${getJob(person.jobId).name}`;
  renderStats(person);

  const isStudent = person.jobId === 'student' || person.age < 18;
  schoolBtn.disabled = !isStudent;
  workBtn.disabled = isStudent && person.age < 16;
}

function renderSchoolModal(person) {
  schoolModalSub.textContent = `为 ${person.name} 选择初中（当前：${getSchool(person.schoolId)?.name || '未入学'}）`;
  schoolList.innerHTML = SCHOOLS.map((school) => {
    const active = person.schoolId === school.id ? ' picker-item--active' : '';
    const affordable = state.cash >= school.tuition ? '' : ' picker-item--locked';
    const bonuses = [
      school.iqBonus ? `智商+${school.iqBonus}` : '',
      school.moodBonus ? `心情${school.moodBonus > 0 ? '+' : ''}${school.moodBonus}` : '',
      school.charmBonus ? `魅力+${school.charmBonus}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return `
      <button type="button" class="picker-item${active}${affordable}" data-school="${school.id}" ${affordable ? 'disabled' : ''}>
        <div class="picker-item__row">
          <span class="picker-item__name">${school.name}</span>
          <span class="picker-item__tier">${school.tier}</span>
        </div>
        <p class="picker-item__desc">${school.desc}</p>
        <div class="picker-item__meta">
          <span class="picker-item__tuition">学费 ${formatMoney(school.tuition)}/月</span>
          <span>${bonuses}</span>
        </div>
      </button>
    `;
  }).join('');

  schoolList.querySelectorAll('.picker-item:not(.picker-item--locked)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const school = getSchool(btn.dataset.school);
      if (!school || state.cash < school.tuition) return;
      person.schoolId = school.id;
      person.needsSchoolChoice = false;
      state.cash -= school.tuition;
      person.stats.iq += school.iqBonus || 0;
      person.stats.mood += school.moodBonus || 0;
      person.stats.charm += school.charmBonus || 0;
      schoolModal.close();
      renderAll();
      if (!state.paused) startTick();
    });
  });
}

function canTakeJob(person, job) {
  if (job.id === 'student') return person.age < 22;
  if (job.id === 'retired') return person.age >= 60;
  if (job.id === 'didi') return person.age >= 18;
  if (job.id === 'engineer') return person.education.includes('大学') && person.age >= 22;
  if (job.id === 'civil') return person.education.includes('大学') && person.age >= 22;
  if (job.id === 'influencer') return person.stats.charm >= 60 && person.age >= 16;
  return false;
}

function renderWorkModal(person) {
  workModalSub.textContent = `${person.name} · 学历 ${person.education}`;
  workList.innerHTML = JOBS.map((job) => {
    const active = person.jobId === job.id ? ' picker-item--active' : '';
    const locked = !canTakeJob(person, job) ? ' picker-item--locked' : '';
    const tierClass = job.type === 'variance' ? ' picker-item__tier--variance' : '';
    const incomeClass = job.type === 'variance' ? ' picker-item__income--variance' : '';
    const incomeText =
      job.income > 0
        ? job.incomeVariance
          ? `${formatMoney(job.income)}±${Math.round(job.incomeVariance * 100)}%`
          : `${formatMoney(job.income)}/月`
        : '无收入';

    return `
      <button type="button" class="picker-item${active}${locked}" data-job="${job.id}" ${locked ? 'disabled' : ''}>
        <div class="picker-item__row">
          <span class="picker-item__name">${job.name}</span>
          <span class="picker-item__tier${tierClass}">${job.type === 'variance' ? '高波动' : '稳定'}</span>
        </div>
        <p class="picker-item__desc">${job.desc}（要求：${job.req}）</p>
        <div class="picker-item__meta">
          <span class="picker-item__income${incomeClass}">${incomeText}</span>
        </div>
      </button>
    `;
  }).join('');

  workList.querySelectorAll('.picker-item:not(.picker-item--locked)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const job = getJob(btn.dataset.job);
      person.jobId = job.id;
      if (job.incomeVariance) {
        const variance = 1 + (Math.random() * 2 - 1) * job.incomeVariance;
        person.income = Math.round(job.income * variance);
      } else {
        person.income = job.income;
      }
      workModal.close();
      renderAll();
      if (!state.paused) startTick();
    });
  });
}

function showEvent() {
  if (eventShown) return;
  eventShown = true;
  state.paused = true;
  stopTick();
  renderTopBar();

  const ev = SAMPLE_EVENT;
  eventTitle.textContent = ev.title;
  eventBody.textContent = ev.body;
  eventChoices.innerHTML = ev.choices
    .map(
      (c, i) => `
      <button type="button" class="event-choice${i > 0 ? ' event-choice--alt' : ''}" data-choice="${c.id}">
        ${c.label}
      </button>
    `
    )
    .join('');

  eventChoices.querySelectorAll('.event-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = ev.choices.find((c) => c.id === btn.dataset.choice);
      const target = getPerson(choice.targetId);
      if (choice.cashDelta) state.cash += choice.cashDelta;
      if (choice.moodDelta && target) target.stats.mood += choice.moodDelta;
      if (choice.charmDelta && target) target.stats.charm += choice.charmDelta;
      eventModal.close();
      state.paused = false;
      renderAll();
      startTick();
    });
  });

  eventModal.showModal();
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
      }
    }
  }

  let monthlyIncome = 0;
  let monthlyTuition = 0;
  for (const p of state.people) {
    monthlyIncome += p.income || 0;
    if (p.schoolId) {
      const school = getSchool(p.schoolId);
      if (school) monthlyTuition += school.tuition;
    }
    if (p.jobId === 'student') {
      p.stats.stamina = Math.min(100, p.stats.stamina + 1);
    }
  }
  state.cash += monthlyIncome - monthlyTuition;

  if (state.month === 6 && !eventShown) {
    showEvent();
    return;
  }
}

function tick() {
  if (state.paused || isModalOpen()) return;
  advanceMonth();
  renderTopBar();
}

function startTick() {
  stopTick();
  if (!state.paused) {
    tickTimer = setInterval(tick, TICK_MS);
  }
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
  if (state.selectedId) selectPerson(state.selectedId);
}

function bindUI() {
  pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    renderTopBar();
    if (state.paused) stopTick();
    else startTick();
  });

  closeDetail.addEventListener('click', () => {
    detailPanel.hidden = true;
    document.getElementById('app').classList.remove('is-detail-open');
  });

  schoolBtn.addEventListener('click', () => {
    const person = getPerson(state.selectedId);
    if (!person) return;
    state.paused = true;
    stopTick();
    renderSchoolModal(person);
    schoolModal.showModal();
  });

  workBtn.addEventListener('click', () => {
    const person = getPerson(state.selectedId);
    if (!person) return;
    state.paused = true;
    stopTick();
    renderWorkModal(person);
    workModal.showModal();
  });

  [schoolModal, workModal, eventModal].forEach((modal) => {
    modal.addEventListener('close', () => {
      if (!eventModal.open && !schoolModal.open && !workModal.open) {
        if (!eventShown || state.month !== 6) {
          state.paused = false;
          renderTopBar();
          startTick();
        }
      }
    });
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      document.getElementById(id)?.close();
    });
  });
}

function init() {
  bindUI();
  renderAll();
  selectPerson(state.selectedId);
  startTick();
}

init();

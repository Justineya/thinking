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
} from './data/game-data.js';

const TICK_MS = 3000;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const QUEUE_ORDER = { work: 0, love: 1, marry: 2, school: 3, baby: 4 };
const GEN_NAMES = ['祖辈', '父母辈', '子女辈', '孙辈'];
const STAT_LABELS = { iq: '智商', mood: '心情', charm: '魅力', stamina: '体力' };

let state = JSON.parse(JSON.stringify(INITIAL_FAMILY));
let tickTimer = null;
let queue = [];
let currentEvent = null;

const $ = (sel) => document.querySelector(sel);
const dateLabel = $('#dateLabel');
const cashLabel = $('#cashLabel');
const tokenLabel = $('#tokenLabel');
const assetsLabel = $('#assetsLabel');
const pauseBtn = $('#pauseBtn');
const pauseIcon = $('#pauseIcon');
const roster = $('#roster');
const familyTree = $('#familyTree');
const detailEmpty = $('#detailEmpty');
const detailBody = $('#detailBody');
const detailName = $('#detailName');
const detailPortrait = $('#detailPortrait');
const detailAge = $('#detailAge');
const detailRole = $('#detailRole');
const detailFacts = $('#detailFacts');
const detailStats = $('#detailStats');
const detailHint = $('#detailHint');
const choiceModal = $('#choiceModal');
const choiceBadge = $('#choiceBadge');
const choiceTitle = $('#choiceTitle');
const choiceBody = $('#choiceBody');
const choiceList = $('#choiceList');
const tokenBtn = $('#tokenBtn');

function formatMoney(n) {
  return `¥${Math.round(n).toLocaleString('zh-CN')}`;
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
  return choiceModal.open;
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

function enqueue(item) {
  const key = `${item.type}:${item.personId}:${item.stage?.key || ''}`;
  const same = (q) => `${q.type}:${q.personId}:${q.stage?.key || ''}` === key;
  if (queue.some(same)) return;
  if (currentEvent && same(currentEvent)) return;
  queue.push(item);
}

function lifeHint(person) {
  if (person.dating && !person.spouseId) {
    const left = Math.max(0, 6 - monthsSince(person.datingYear, person.datingMonth));
    return left ? `恋爱中（${person.dating.name}），大约 ${left} 个月后谈结婚。` : '可以结婚了。';
  }
  if (person.spouseId && countChildren(person) < 2 && person.age <= 42 && person.parentId) {
    const left = Math.max(0, 12 - monthsSince(person.marriedYear, person.marriedMonth));
    return left ? `已婚。大约 ${left} 个月后可能要孩子。` : '可以生孩子了。';
  }
  if (person.jobId === 'student') {
    const stage = nextSchoolStage(person);
    if (stage) return `${stage.age} 岁升${stage.label}，到点会弹出学校列表。`;
    if (person.age >= 22) return '大学读完了，该选工作。';
    return '在读书。到年龄会弹出升学。';
  }
  if (!person.loveDrawn && person.age >= 22 && !person.spouseId) {
    return '有工作后会弹出对象列表，可正常选人或花代币接触高净值对象。';
  }
  return '点家谱看这一支，人生节点到了会自动弹窗。';
}

function renderTop() {
  dateLabel.textContent = `${state.year}年${MONTHS[state.month - 1]}`;
  cashLabel.textContent = formatMoney(state.cash);
  tokenLabel.textContent = String(state.tokens);
  assetsLabel.textContent = formatMoney(state.assets);
  pauseIcon.textContent = state.paused ? '▶' : '⏸';
}

function renderRoster() {
  roster.innerHTML = state.people
    .slice()
    .sort((a, b) => a.generation - b.generation || a.age - b.age)
    .map((p) => {
      const on = p.id === state.selectedId ? ' roster-item--on' : '';
      return `
        <button type="button" class="roster-item${on}" data-id="${p.id}">
          <img src="${PORTRAITS[p.portrait]}" alt="" />
          <span>
            <div class="roster-item__name">${p.name}</div>
            <div class="roster-item__meta">${p.age}岁 · ${getJob(p.jobId).name}</div>
          </span>
        </button>
      `;
    })
    .join('');
  roster.querySelectorAll('.roster-item').forEach((btn) => {
    btn.addEventListener('click', () => selectPerson(btn.dataset.id));
  });
}

function renderPersonCard(person) {
  const job = getJob(person.jobId);
  const incomeText = person.income > 0 ? `${formatMoney(person.income)}/月` : '暂无收入';
  const selected = person.id === state.selectedId ? ' person-card--selected' : '';
  const dating = person.dating ? ' · 恋爱中' : '';
  return `
    <article class="person-card${selected}" data-id="${person.id}" role="button" tabindex="0">
      <img class="person-card__portrait" src="${PORTRAITS[person.portrait]}" alt="${person.name}" />
      <div class="person-card__name">${person.name}</div>
      <div class="person-card__info">${person.age}岁 · ${job.name}${dating}</div>
      <div class="person-card__income">${incomeText}</div>
    </article>
  `;
}

function renderGeneration(people) {
  const paired = new Set();
  const units = [];
  for (const p of people) {
    if (paired.has(p.id)) continue;
    if (p.spouseId) {
      const spouse = getPerson(p.spouseId);
      if (spouse && spouse.generation === p.generation) {
        units.push(`<div class="couple-wrap">${renderPersonCard(p)}${renderPersonCard(spouse)}</div>`);
        paired.add(p.id);
        paired.add(spouse.id);
        continue;
      }
    }
    units.push(`<div class="couple-wrap">${renderPersonCard(p)}</div>`);
    paired.add(p.id);
  }
  return units.length > 1 ? `<div class="gen-units">${units.join('')}</div>` : units.join('');
}

function renderFamilyTree() {
  const gens = new Map();
  for (const p of state.people) {
    if (!gens.has(p.generation)) gens.set(p.generation, []);
    gens.get(p.generation).push(p);
  }
  familyTree.innerHTML = [...gens.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([gen, people]) => `
        <section class="gen-row">
          <div class="gen-label">${GEN_NAMES[gen] || `第${gen + 1}代`}</div>
          ${renderGeneration(people)}
        </section>
      `
    )
    .join('');
  familyTree.querySelectorAll('.person-card').forEach((card) => {
    card.addEventListener('click', () => selectPerson(card.dataset.id));
  });
}

function selectPerson(id) {
  state.selectedId = id;
  const person = getPerson(id);
  if (!person) return;
  renderRoster();
  renderFamilyTree();
  detailEmpty.hidden = true;
  detailBody.hidden = false;
  detailName.textContent = person.name;
  detailPortrait.src = PORTRAITS[person.portrait];
  detailAge.textContent = `${person.age}岁 · ${person.role}`;
  detailRole.textContent = getJob(person.jobId).name;
  const school = getSchoolById(person.schoolId);
  const rel = person.spouseId
    ? `已婚 · ${getPerson(person.spouseId)?.name || ''}`
    : person.dating
      ? `恋爱中 · ${person.dating.name}`
      : '单身';
  detailFacts.innerHTML = `
    <div><dt>学历</dt><dd>${person.education}</dd></div>
    <div><dt>学校</dt><dd>${school ? school.name : '—'}</dd></div>
    <div><dt>月收入</dt><dd>${person.income ? formatMoney(person.income) : '无'}</dd></div>
    <div><dt>感情</dt><dd>${rel}</dd></div>
  `;
  detailStats.innerHTML = Object.entries(person.stats)
    .map(
      ([key, val]) => `
      <div class="stat-item">
        <span class="stat-item__label">${STAT_LABELS[key]}</span>
        <span class="stat-item__value">${val}</span>
      </div>`
    )
    .join('');
  detailHint.textContent = lifeHint(person);
}

function pickerItem({ name, tier, desc, meta, locked, key }) {
  return `
    <button type="button" class="picker-item${locked ? ' picker-item--locked' : ''}" data-key="${key}" ${locked ? 'disabled' : ''}>
      <div class="picker-item__row">
        <span class="picker-item__name">${name}</span>
        <span class="picker-item__tier">${tier}</span>
      </div>
      <p class="picker-item__desc">${desc}</p>
      <div class="picker-item__meta">${meta}</div>
    </button>
  `;
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
  renderTop();
  tokenBtn.hidden = true;
  tokenBtn.disabled = state.tokens < TOKEN_COST;
  tokenBtn.textContent = `花 ${TOKEN_COST} 代币走破格（剩余 ${state.tokens}）`;

  if (item.type === 'school') {
    choiceBadge.textContent = `${item.stage.label}升学`;
    choiceTitle.textContent = `${person.name}满${item.stage.age}岁，选${item.stage.label}`;
    choiceBody.textContent = '县级 / 市级 / 省级是正常入学。破格名额要花代币。';
    choiceList.innerHTML = item.stage.choices
      .map((s) =>
        pickerItem({
          name: s.name,
          tier: s.tier,
          desc: s.desc,
          meta: `学费 ${formatMoney(s.tuition)}/月`,
          locked: false,
          key: s.id,
        })
      )
      .join('');
    tokenBtn.hidden = false;
    choiceList.querySelectorAll('.picker-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const school = item.stage.choices.find((s) => s.id === btn.dataset.key);
        applySchool(person, school, item.stage);
        finishEvent();
      });
    });
  } else if (item.type === 'work') {
    choiceBadge.textContent = '找工作';
    choiceTitle.textContent = `${person.name}该工作了`;
    choiceBody.textContent = '按学历选岗位。头部网红不在列表里，要花代币接触这条路。';
    choiceList.innerHTML = JOB_CHOICES.map((id) => {
      const job = getJob(id);
      const ok = jobAllowed(person, job);
      return pickerItem({
        name: job.name,
        tier: ok ? '可选' : '学历不够',
        desc: job.desc,
        meta: `${formatMoney(job.income)}/月 · ${job.req}`,
        locked: !ok,
        key: job.id,
      });
    }).join('');
    tokenBtn.hidden = false;
    tokenBtn.textContent = `花 ${TOKEN_COST} 代币走网红（剩余 ${state.tokens}）`;
    choiceList.querySelectorAll('.picker-item:not(.picker-item--locked)').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyJob(person, getJob(btn.dataset.key));
        finishEvent();
      });
    });
  } else if (item.type === 'love') {
    const list = person.gender === 'male' ? LOVE_CHOICES.female : LOVE_CHOICES.male;
    choiceBadge.textContent = '恋爱';
    choiceTitle.textContent = `${person.name}想谈恋爱`;
    choiceBody.textContent = '先选一个正常认识的人。高净值对象要花代币。先恋爱，暂不结婚。';
    choiceList.innerHTML = list
      .map((s, i) =>
        pickerItem({
          name: `${s.name} · ${s.age}岁`,
          tier: getJob(s.jobId).name,
          desc: s.desc,
          meta: `${formatMoney(s.income)}/月 · 婚礼另算 ${formatMoney(s.cost)}`,
          locked: false,
          key: String(i),
        })
      )
      .join('');
    tokenBtn.hidden = false;
    tokenBtn.textContent = `花 ${TOKEN_COST} 代币接触高净值（剩余 ${state.tokens}）`;
    choiceList.querySelectorAll('.picker-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        startDating(person, list[Number(btn.dataset.key)]);
        finishEvent();
      });
    });
  } else if (item.type === 'marry') {
    const partner = person.dating;
    choiceBadge.textContent = '结婚';
    choiceTitle.textContent = `${person.name}求婚`;
    choiceBody.textContent = partner
      ? `和 ${partner.name} 谈了一段时间。办婚礼入谱，花费 ${formatMoney(partner.cost)}。`
      : '可以结婚了。';
    choiceList.innerHTML = pickerItem({
      name: `和 ${partner?.name || ''} 结婚`,
      tier: '婚礼',
      desc: '结婚后对方进入家族谱。',
      meta: formatMoney(partner?.cost || 0),
      locked: false,
      key: 'yes',
    });
    tokenBtn.hidden = true;
    choiceList.querySelector('.picker-item').addEventListener('click', () => {
      if (person.dating) marryPerson(person, person.dating);
      finishEvent();
    });
  } else if (item.type === 'baby') {
    choiceBadge.textContent = '下一代';
    choiceTitle.textContent = `${person.name}想要孩子`;
    choiceBody.textContent = '结婚满一年。生一个花费 ¥8,000。';
    choiceList.innerHTML = pickerItem({
      name: '生孩子',
      tier: '家族',
      desc: '每对最多两个孩子。',
      meta: '¥8,000',
      locked: false,
      key: 'yes',
    });
    tokenBtn.hidden = true;
    choiceList.querySelector('.picker-item').addEventListener('click', () => {
      haveChild(person);
      person.babyPending = false;
      finishEvent();
    });
  }

  if (!choiceModal.open) choiceModal.showModal();
  renderFamilyTree();
  renderRoster();
}

function spendToken() {
  if (!currentEvent || state.tokens < TOKEN_COST) return;
  const person = getPerson(currentEvent.personId);
  if (!person) return;
  state.tokens -= TOKEN_COST;
  if (currentEvent.type === 'school') {
    applySchool(person, currentEvent.stage.special, currentEvent.stage);
  } else if (currentEvent.type === 'work') {
    applyJob(person, getJob(JOB_SPECIAL));
  } else if (currentEvent.type === 'love') {
    const special = person.gender === 'male' ? LOVE_SPECIAL.female : LOVE_SPECIAL.male;
    startDating(person, special);
  } else {
    return;
  }
  finishEvent();
}

function applySchool(person, school, stage) {
  person.schoolId = school.id;
  person.schoolStage = stage.key;
  person.education = stage.education;
  person.jobId = 'student';
  person.income = 0;
  person.stats.iq = Math.min(100, person.stats.iq + (school.iqBonus || 0));
  person.stats.mood = Math.min(100, Math.max(0, person.stats.mood + (school.moodBonus || 0)));
  person.stats.charm = Math.min(100, person.stats.charm + (school.charmBonus || 0));
}

function applyJob(person, job) {
  person.jobId = job.id;
  person.workDrawn = true;
  person.schoolId = null;
  if (job.incomeVariance) {
    person.income = Math.round(job.income * (1 + (Math.random() * 2 - 1) * job.incomeVariance));
  } else {
    person.income = job.income;
  }
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
  person.loveDrawn = true;
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
  person.stats.mood = Math.min(100, person.stats.mood + 8);
}

function haveChild(person) {
  const spouse = getPerson(person.spouseId);
  if (!spouse || countChildren(person) >= 2) return;
  const girl = Math.random() < 0.5;
  const gender = girl ? 'female' : 'male';
  const used = new Set(state.people.map((p) => p.name));
  const names = BABY_NAMES[gender].filter((n) => !used.has(n));
  const bloodId = person.parentId ? person.id : spouse.id;
  state.cash = Math.max(0, state.cash - 8000);
  state.people.push({
    id: nextPersonId(),
    name: names[0] || (girl ? '陈宝贝' : '陈小子'),
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
  });
}

function finishEvent() {
  currentEvent = null;
  choiceModal.close();
  collectAgeEvents();
  renderAll();
  processQueue();
}

function processQueue() {
  if (isModalOpen() && currentEvent) return;
  if (!queue.length) {
    currentEvent = null;
    if (!isModalOpen()) {
      state.paused = false;
      renderTop();
      startTick();
    }
    return;
  }
  queue.sort((a, b) => (QUEUE_ORDER[a.type] ?? 9) - (QUEUE_ORDER[b.type] ?? 9));
  openChoice(queue.shift());
}

function collectAgeEvents() {
  for (const p of state.people) {
    if (p.jobId === 'retired') continue;
    if (!p.workDrawn && p.age >= 22 && p.jobId === 'student') enqueue({ type: 'work', personId: p.id });
    if (p.workDrawn && p.jobId !== 'student' && !p.spouseId && !p.dating && !p.loveDrawn && p.age >= 22) {
      enqueue({ type: 'love', personId: p.id });
    }
    if (p.dating && !p.spouseId && monthsSince(p.datingYear, p.datingMonth) >= 6) {
      enqueue({ type: 'marry', personId: p.id });
    }
    const stage = nextSchoolStage(p);
    if (stage && p.jobId === 'student') enqueue({ type: 'school', personId: p.id, stage });
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
  let monthlyIncome = 0;
  let monthlyTuition = 0;
  for (const p of state.people) {
    monthlyIncome += p.income || 0;
    if (p.schoolId && p.jobId === 'student') {
      const school = getSchoolById(p.schoolId);
      if (school) monthlyTuition += school.tuition;
    }
  }
  state.cash += monthlyIncome - monthlyTuition;
  collectAgeEvents();
}

function tick() {
  if (state.paused || isModalOpen() || queue.length) return;
  advanceMonth();
  renderTop();
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
  renderTop();
  renderRoster();
  renderFamilyTree();
  if (state.selectedId && getPerson(state.selectedId)) selectPerson(state.selectedId);
}

function bindUI() {
  pauseBtn.addEventListener('click', () => {
    if (isModalOpen()) return;
    state.paused = !state.paused;
    renderTop();
    if (state.paused) stopTick();
    else startTick();
  });
  tokenBtn.addEventListener('click', spendToken);
  choiceModal.addEventListener('cancel', (e) => e.preventDefault());
}

function init() {
  bindUI();
  renderAll();
  collectAgeEvents();
  processQueue();
}

init();

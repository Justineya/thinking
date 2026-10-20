/** 单人穷开局。刷新或点「重开」随机抽一条。不要工程师/公务员/有房开局。 */

import { JOBS, pickFirm } from './game-data.js';
import { calcSalary } from './economy.js';
import { randomFounderName, randomSurname } from './names.js';

export const START_SEEDS = [
  {
    id: 'line',
    title: '流水线',
    blurb: '高中进厂，卡里只剩几千块，租的床位不算资产。',
    cash: 4800,
    tokens: 0,
    person: {
      age: 20,
      jobId: 'factory',
      education: '高中',
      schoolStage: 'high',
      stats: { iq: 54, mood: 58, charm: 46, stamina: 84 },
      jobMonths: 2,
      workDrawn: true,
    },
  },
  {
    id: 'didi',
    title: '网约车',
    blurb: '车是租的。跑一晚油钱先垫上，现金见底。',
    cash: 3600,
    tokens: 0,
    person: {
      age: 24,
      jobId: 'didi',
      education: '高中',
      schoolStage: 'high',
      stats: { iq: 56, mood: 70, charm: 52, stamina: 80 },
      jobMonths: 3,
      workDrawn: true,
    },
  },
  {
    id: 'voc',
    title: '应届专科',
    blurb: '刚拿专科证，还没签合同，家里只塞了点生活费。',
    cash: 1800,
    tokens: 1,
    person: {
      age: 21,
      jobId: 'idle',
      education: '专科',
      schoolStage: 'uni',
      stats: { iq: 64, mood: 66, charm: 58, stamina: 68 },
      jobMonths: 0,
      workDrawn: false,
    },
  },
  {
    id: 'dropout',
    title: '辍学待业',
    blurb: '初中没念完就出来了。没有学历，也没有工作。',
    cash: 860,
    tokens: 0,
    person: {
      age: 18,
      jobId: 'idle',
      education: '初中',
      schoolStage: 'middle',
      stats: { iq: 48, mood: 52, charm: 50, stamina: 74 },
      jobMonths: 0,
      workDrawn: false,
    },
  },
  {
    id: 'apprentice',
    title: '学徒工',
    blurb: '镇上手艺铺打杂，包一顿晚饭，工资刚够吃饭。',
    cash: 1240,
    tokens: 0,
    person: {
      age: 19,
      jobId: 'apprentice',
      education: '初中',
      schoolStage: 'middle',
      stats: { iq: 50, mood: 60, charm: 48, stamina: 78 },
      jobMonths: 1,
      workDrawn: true,
    },
  },
];

export function pickSeed() {
  return START_SEEDS[Math.floor(Math.random() * START_SEEDS.length)];
}

export function buildState(seed = pickSeed()) {
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const surname = randomSurname();
  const name = randomFounderName(surname, gender);
  const portrait = gender === 'female' ? 'young_female' : 'young_male';
  const p = seed.person;
  const person = {
    id: 'p1',
    name,
    gender,
    portrait,
    age: p.age,
    generation: 0,
    role: '当家',
    parentId: null,
    spouseId: null,
    jobId: p.jobId,
    schoolId: null,
    schoolStage: p.schoolStage,
    education: p.education,
    stats: { ...p.stats },
    income: 0,
    jobMonths: p.jobMonths || 0,
    jobRank: 0,
    tempBonus: 0,
    loveDrawn: false,
    workDrawn: !!p.workDrawn,
    company: p.jobId && p.jobId !== 'idle' ? pickFirm(p.jobId) : '',
  };
  person.income = calcSalary(person, JOBS.find((j) => j.id === p.jobId));
  return {
    year: 2026,
    month: 3,
    cash: seed.cash,
    assets: 0,
    tokens: seed.tokens,
    ownedIndustries: [],
    metMusk: false,
    ownedJet: false,
    ownedFoundation: false,
    eventLog: [
      {
        year: 2026,
        month: 3,
        kind: 'special',
        title: `开局 · ${seed.title}`,
        text: `${name}，${p.age}岁，${p.education}。${seed.blurb}`,
      },
    ],
    paused: true,
    selectedId: null,
    nextPersonNum: 10,
    surname,
    seedId: seed.id,
    seedTitle: seed.title,
    seedBlurb: seed.blurb,
    people: [person],
  };
}

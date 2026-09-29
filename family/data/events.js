/**
 * 随机事件 / 特殊事件表（本仓库记载处）
 * type: random 每月抽签 | special 人生节点附带
 * 运行时每条结算都会 append 到 state.eventLog
 */

export const RANDOM_EVENTS = [
  {
    id: 'year_end_bonus',
    title: '年终奖',
    weight: 3,
    needJob: true,
    text: (p) => `${p.name} 拿到一笔年终奖。`,
    apply: (state, p) => {
      const n = 3000 + Math.round(Math.random() * 7000);
      state.cash += n;
      return `现金 +${n}`;
    },
  },
  {
    id: 'sick',
    title: '生病请假',
    weight: 2,
    needJob: true,
    text: (p) => `${p.name} 请了病假，这个月少拿一点。`,
    apply: (_state, p) => {
      p.tempBonus = -800;
      p.stats.stamina = Math.max(20, p.stats.stamina - 6);
      return '本月工资 -800，体力 -6';
    },
  },
  {
    id: 'praise',
    title: '领导表扬',
    weight: 2,
    needJob: true,
    text: (p) => `${p.name} 被点名表扬，心情变好。`,
    apply: (_state, p) => {
      p.stats.mood = Math.min(100, p.stats.mood + 8);
      p.tempBonus = 400;
      return '心情 +8，本月 +400';
    },
  },
  {
    id: 'small_raise',
    title: '绩效加薪',
    weight: 2,
    needJob: true,
    text: (p) => `${p.name} 绩效考核不错，临时加薪。`,
    apply: (_state, p) => {
      p.tempBonus = (p.tempBonus || 0) + 600;
      return '本月工资 +600';
    },
  },
  {
    id: 'scholarship',
    title: '奖学金',
    weight: 2,
    needStudent: true,
    text: (p) => `${p.name} 拿了奖学金。`,
    apply: (state, p) => {
      state.cash += 2000;
      p.stats.iq = Math.min(100, p.stats.iq + 1);
      return '现金 +2000，智商 +1';
    },
  },
];

export const SPECIAL_EVENTS = [
  {
    id: 'promote',
    title: '升职',
    text: (p, rankName) => `${p.name} 工龄到了，有机会升为${rankName}。`,
  },
];

export function pickRandomEvent(people) {
  const bag = [];
  for (const ev of RANDOM_EVENTS) {
    const ok = people.some((p) => {
      if (ev.needJob && (p.jobId === 'student' || p.jobId === 'retired' || p.jobId === 'idle' || !p.jobId)) return false;
      if (ev.needStudent && p.jobId !== 'student') return false;
      return true;
    });
    if (ok) for (let i = 0; i < ev.weight; i++) bag.push(ev);
  }
  if (!bag.length) return null;
  return bag[Math.floor(Math.random() * bag.length)];
}

export function pickTarget(people, ev) {
  const list = people.filter((p) => {
    if (ev.needJob && (p.jobId === 'student' || p.jobId === 'retired' || p.jobId === 'idle')) return false;
    if (ev.needStudent && p.jobId !== 'student') return false;
    return true;
  });
  return list[Math.floor(Math.random() * list.length)] || null;
}

/**
 * 经济公式（本仓库记载处，改这里就改全游戏）
 *
 * 月薪 = round( 岗位底薪 × 学历 × 智商 × 工龄 × 职级 ) + 临时加减
 * 工龄每年约 +2.5%，封顶 12 年
 * 职级：0 员工 / 1 主管 / 2 经理，每级 ×1.15
 */

export const EDU_MULT = {
  学前: 0.75,
  小学: 0.82,
  初中: 0.9,
  高中: 1,
  专科: 1.05,
  大学本科: 1.18,
  贵族本科: 1.38,
};

export const RANK_NAMES = ['员工', '主管', '经理'];

/** 升职弹窗选项：花钱/灵感提高成功率，仍可能失败 */
export const PROMOTE_OPTIONS = [
  { id: 'try', name: '自己争取', chance: 0.4, cash: 0, tokens: 0, hint: '四成把握' },
  { id: 'gift', name: '请客送礼', chance: 0.7, cashRank: [88000, 360000], tokens: 0, hint: '七成把握' },
  { id: 'token', name: '灵感运作', chance: 0.92, cash: 0, tokens: 1, hint: '九成把握' },
];

export function promoteCashCost(person, opt) {
  if (!opt.cashRank) return opt.cash || 0;
  return opt.cashRank[Math.min(opt.cashRank.length - 1, person.jobRank || 0)];
}

export function yearsOnJob(person) {
  return Math.floor((person.jobMonths || 0) / 12);
}

export function calcSalary(person, job, { variance = false } = {}) {
  if (!job || job.id === 'student' || job.id === 'idle') return 0;
  if (job.id === 'retired') return job.income || job.base || 4200;
  const base = job.base ?? job.income ?? 0;
  const edu = EDU_MULT[person.education] ?? 1;
  const iq = 1 + ((person.stats?.iq ?? 50) - 50) / 250;
  const seniority = 1 + 0.025 * Math.min(yearsOnJob(person), 12);
  const rank = 1 + 0.15 * (person.jobRank || 0);
  let pay = base * edu * iq * seniority * rank;
  if (variance && job.incomeVariance) {
    pay *= 1 + (Math.random() * 2 - 1) * job.incomeVariance;
  }
  pay += person.tempBonus || 0;
  return Math.max(0, Math.round(pay));
}

/** 工龄满 24 个月后，每年约 22% 触发升职（随机事件里也会升） */
export function canTryPromote(person) {
  if (person.jobId === 'student' || person.jobId === 'retired' || person.jobId === 'idle') return false;
  if ((person.jobRank || 0) >= 2) return false;
  return (person.jobMonths || 0) >= 24;
}

/** @typedef {'young_male'|'young_female'|'mid_male'|'mid_female'|'old_male'|'old_female'|'child_male'|'child_female'} PortraitKey */

export const PORTRAITS = {
  young_male: 'img/portrait_young_male.png',
  young_female: 'img/portrait_young_female.png',
  mid_male: 'img/portrait_mid_male.png',
  mid_female: 'img/portrait_mid_female.png',
  old_male: 'img/portrait_old_male.png',
  old_female: 'img/portrait_old_female.png',
  child_male: 'img/portrait_child_male.png',
  child_female: 'img/portrait_child_female.png',
};

export const TOKEN_COST = 1;

/** 乡镇/县城/市级花现金；省级花灵感（不做广告） */
export const SCHOOL_STAGES = [
  {
    age: 6,
    key: 'primary',
    label: '小学',
    education: '小学',
    tip: '学校越好，以后工资越高',
    choices: [
      { id: 'pri_town', name: '乡镇小学', enroll: 800, tuition: 180, iqBonus: 1 },
      { id: 'pri_county', name: '县城小学', enroll: 6800, tuition: 420, iqBonus: 3 },
      { id: 'pri_city', name: '市级小学', enroll: 28600, tuition: 980, iqBonus: 5 },
    ],
    special: { id: 'pri_prov', name: '省级小学', enroll: 0, tuition: 0, iqBonus: 8, moodBonus: 2 },
    luxury: { id: 'pri_noble', name: '贵族小学', enroll: 680000, tuition: 28000, iqBonus: 14, moodBonus: 6 },
  },
  {
    age: 12,
    key: 'middle',
    label: '初中',
    education: '初中',
    tip: '学校越好，大学毕业后工作的工资越高',
    choices: [
      { id: 'mid_town', name: '乡镇初中', enroll: 1662, tuition: 273, iqBonus: 2 },
      { id: 'mid_county', name: '县城初中', enroll: 61700, tuition: 820, iqBonus: 4 },
      { id: 'mid_city', name: '市级初中', enroll: 86000, tuition: 2680, iqBonus: 6 },
    ],
    special: { id: 'mid_prov', name: '省级初中', enroll: 0, tuition: 0, iqBonus: 9 },
    luxury: { id: 'mid_noble', name: '贵族初中', enroll: 1280000, tuition: 48000, iqBonus: 16, moodBonus: 5 },
  },
  {
    age: 15,
    key: 'high',
    label: '高中',
    education: '高中',
    tip: '高中档次会卡住能上的大学',
    choices: [
      { id: 'high_town', name: '乡镇高中', enroll: 2200, tuition: 360, iqBonus: 2 },
      { id: 'high_county', name: '县城高中', enroll: 28600, tuition: 1100, iqBonus: 5 },
      { id: 'high_city', name: '市级高中', enroll: 98000, tuition: 3200, iqBonus: 7 },
    ],
    special: { id: 'high_prov', name: '省级高中', enroll: 0, tuition: 0, iqBonus: 10 },
    luxury: { id: 'high_noble', name: '贵族高中', enroll: 2680000, tuition: 86000, iqBonus: 18, moodBonus: 6 },
  },
  {
    age: 18,
    key: 'uni',
    label: '大学',
    education: '大学本科',
    tip: '学历决定能选的工作；有钱可砸贵族本科',
    choices: [
      { id: 'uni_town', name: '专科', enroll: 8000, tuition: 1600, iqBonus: 1 },
      { id: 'uni_county', name: '普通本科', enroll: 22000, tuition: 2600, iqBonus: 4 },
      { id: 'uni_city', name: '重点大学', enroll: 48000, tuition: 3800, iqBonus: 7 },
    ],
    special: { id: 'uni_prov', name: '顶尖高校', enroll: 0, tuition: 0, iqBonus: 12 },
    luxury: {
      id: 'uni_noble',
      name: '贵族本科 / 常春藤',
      enroll: 4800000,
      tuition: 128000,
      iqBonus: 22,
      moodBonus: 8,
      education: '贵族本科',
    },
  },
];

export const CASH_LUXURIES = [
  { id: 'tutor', name: '私人贵族导师', desc: '全家族智商 +3', cash: 280000, stat: 'iq', amount: 3 },
  { id: 'island', name: '海岛度假月', desc: '全家族心情 +12', cash: 860000, stat: 'mood', amount: 12 },
  { id: 'ivy_seat', name: '常春藤交换名额', desc: '随机在读学生智商 +15', cash: 1800000, studentIq: 15 },
  { id: 'jet', name: '私人飞机', desc: '买断，全族心情 +10', cash: 8800000, once: 'ownedJet', stat: 'mood', amount: 10 },
  { id: 'foundation', name: '家族基金会', desc: '1500万；全族魅力 +20', cash: 15000000, once: 'ownedFoundation', stat: 'charm', amount: 20 },
];

/** 名流局：马斯克只是其中一例，越往后越贵，一次一个 */
export const SOCIAL_ELITES = [
  {
    id: 'miyazaki',
    name: '吉卜力工作室参访',
    desc: '168万一次。随机家人心情+12、魅力+8',
    cash: 1680000,
    once: 'metMiyazaki',
    boost: { mood: 12, charm: 8 },
    who: '宫崎骏',
  },
  {
    id: 'federer',
    name: '费德勒网球私教',
    desc: '240万一次。随机家人体力+16、魅力+6',
    cash: 2400000,
    once: 'metFederer',
    boost: { stamina: 16, charm: 6 },
    who: '费德勒',
  },
  {
    id: 'musk',
    name: '结识马斯克',
    desc: '360万一次。魅力+18、智商+8，解锁星链顾问',
    cash: 3600000,
    once: 'metMusk',
    boost: { charm: 18, iq: 8 },
    who: '马斯克',
    jobId: 'starlink',
  },
  {
    id: 'ren',
    name: '任正非座谈会',
    desc: '660万一次。智商+10、体力+8，解锁研发总监',
    cash: 6600000,
    once: 'metRen',
    boost: { iq: 10, stamina: 8 },
    who: '任正非',
    jobId: 'rd_director',
  },
  {
    id: 'oprah',
    name: '奥普拉访谈席',
    desc: '880万一次。魅力+20、心情+8，解锁谈话主持人',
    cash: 8800000,
    once: 'metOprah',
    boost: { charm: 20, mood: 8 },
    who: '奥普拉',
    jobId: 'media_host',
  },
  {
    id: 'davos',
    name: '达沃斯论坛席位',
    desc: '1280万一次。魅力+12、智商+8，解锁国际顾问',
    cash: 12800000,
    once: 'metDavos',
    boost: { charm: 12, iq: 8 },
    who: '达沃斯名流',
    jobId: 'diplomat',
  },
  {
    id: 'buffett',
    name: '巴菲特午餐',
    desc: '4280万一次。那顿全球拍卖的午餐。智商+16、魅力+10，解锁价值投资人',
    cash: 42800000,
    once: 'metBuffett',
    boost: { iq: 16, charm: 10 },
    who: '巴菲特',
    jobId: 'investor',
  },
  {
    id: 'space',
    name: '太空游客名额',
    desc: '6800万一次。心情+22、魅力+15，体力-8。去过就算巅峰',
    cash: 68000000,
    once: 'beenSpace',
    boost: { mood: 22, charm: 15, stamina: -8 },
    who: '轨道',
  },
];

export const WEDDING_TIERS = [
  { id: 'simple', name: '登记结婚', extra: 0, mood: 2 },
  { id: 'banquet', name: '酒楼婚宴', extra: 180000, mood: 8 },
  { id: 'island', name: '海岛婚礼', extra: 880000, mood: 14 },
  { id: 'sat', name: '卫星直播婚礼', extra: 4800000, mood: 20 },
];

export const SHOP_ITEMS = [
  { id: 'cash1', name: '兑换现金', desc: '立刻获得 10,000', cost: 1, cash: 10000 },
  { id: 'cash5', name: '大额兑换', desc: '立刻获得 50,000', cost: 3, cash: 50000 },
  { id: 'iq', name: '增加智商', desc: '全家族智商 +5', cost: 2, stat: 'iq', amount: 5 },
  { id: 'charm', name: '增加魅力', desc: '全家族魅力 +5', cost: 2, stat: 'charm', amount: 5 },
  { id: 'stamina', name: '增加体力', desc: '全家族体力 +5', cost: 2, stat: 'stamina', amount: 5 },
  { id: 'mood', name: '增加心情', desc: '全家族心情 +5', cost: 2, stat: 'mood', amount: 5 },
  { id: 'raise', name: '全员津贴', desc: '每人本月临时工资 +1,000', cost: 2, tempBonus: 1000 },
];

export const INDUSTRIES = [
  { id: 'house', name: '普通平房', cost: 128000, income: 0, cap: 5, emoji: '🏠', desc: '家人落脚处' },
  { id: 'gym', name: '健身房', cost: 88000, income: 2300, cap: 3, emoji: '🏋️', desc: '月租稳定' },
  { id: 'restaurant', name: '餐厅', cost: 96000, income: 2700, cap: 4, emoji: '🍜', desc: '晚饭高峰赚钱' },
  { id: 'shop', name: '汽修店', cost: 186000, income: 4100, cap: 2, emoji: '🔧', desc: '客单价高' },
  { id: 'hotel', name: '快捷酒店', cost: 3200000, income: 28000, cap: 8, emoji: '🏨', desc: '有钱再买' },
  { id: 'tower', name: '写字楼', cost: 12800000, income: 96000, cap: 20, emoji: '🏢', desc: '后期现金池' },
  { id: 'lab', name: '私人实验室', cost: 36000000, income: 0, cap: 4, emoji: '🧪', desc: '烧钱，全族智商氛围' },
];

export const JOBS = [
  { id: 'student', name: '学生', income: 0, type: 'normal', req: '在读', desc: '专心学业。', minEdu: null },
  { id: 'didi', name: '网约车司机', income: 6800, base: 6800, type: 'social', req: '高中及以上', desc: '时间灵活。', minEdu: '高中' },
  { id: 'factory', name: '工厂技工', income: 7500, base: 7500, type: 'social', req: '高中及以上', desc: '到手稳定。', minEdu: '高中' },
  { id: 'civil', name: '公务员', income: 9200, base: 9200, type: 'social', req: '大学本科', desc: '编制内。', minEdu: '大学' },
  { id: 'engineer', name: '软件工程师', income: 18500, base: 18500, type: 'social', req: '大学本科', desc: '技术岗。', minEdu: '大学' },
  { id: 'influencer', name: '头部网红', income: 42000, incomeVariance: 0.5, type: 'special', req: '花代币破格入行', desc: '收入高、波动大。', minEdu: null },
  { id: 'starlink', name: '星链顾问', income: 88000, base: 88000, type: 'special', req: '先结识马斯克', desc: '后期岗，底薪很高。', minEdu: '大学' },
  { id: 'rd_director', name: '研发总监', income: 76000, base: 76000, type: 'special', req: '先见任正非', desc: '工程体系岗。', minEdu: '大学' },
  { id: 'media_host', name: '谈话主持人', income: 69000, base: 69000, incomeVariance: 0.25, type: 'special', req: '先上奥普拉节目', desc: '曝光换收入。', minEdu: '大学' },
  { id: 'diplomat', name: '国际顾问', income: 82000, base: 82000, type: 'special', req: '先去发达沃斯', desc: '会籍比学历更重要。', minEdu: '大学' },
  { id: 'investor', name: '价值投资人', income: 126000, base: 126000, incomeVariance: 0.35, type: 'special', req: '先吃巴菲特午餐', desc: '波动大，上限高。', minEdu: '大学' },
  { id: 'retired', name: '退休', income: 4200, type: 'normal', req: '年满 60', desc: '领养老金。', minEdu: null },
];

/** 谐音公司/单位，不写原商标。入职时随机抽一家。 */
export const JOB_FIRMS = {
  didi: ['嘀嗒出行', '每团打车', '小黄车顺风'],
  factory: ['富仕康精密', '伪创力代工', '立讯达电子'],
  civil: ['县税务局', '市教育局', '街道办事处'],
  engineer: ['疼讯', '阿狸巴巴', '字跳科技', '微软件中国', '谷鸽研发'],
  influencer: ['快抖直播', '某书种草', '哔哩不哩'],
  starlink: ['星涟航天', '特事拉电动'],
  rd_director: ['滑为技术', '中兴味通信', '小迷生态链'],
  media_host: ['欧普拉传媒', '卫视假日档'],
  diplomat: ['达沃氏会务', '北海论坛秘书处'],
  investor: ['波克暇资本', '高剩投行', '桥水不相'],
};

export function pickFirm(jobId) {
  const list = JOB_FIRMS[jobId];
  if (!list?.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

export function firmHint(jobId) {
  const list = JOB_FIRMS[jobId];
  if (!list?.length) return '';
  return list.join(' / ');
}

export function firmHintShort(jobId) {
  const list = JOB_FIRMS[jobId];
  if (!list?.length) return '';
  if (list.length <= 2) return list.join(' / ');
  return `${list.slice(0, 2).join(' / ')} 等`;
}

export const JOB_CHOICES = ['didi', 'factory', 'civil', 'engineer'];
export const JOB_SPECIAL = 'influencer';
export const JOB_ULTRA = 'starlink';

export const LOVE_CHOICES = {
  female: [
    {
      name: '刘芳',
      gender: 'female',
      portrait: 'young_female',
      age: 23,
      jobId: 'factory',
      education: '高中',
      income: 7500,
      cost: 8000,
      stats: { iq: 58, mood: 78, charm: 60, stamina: 70 },
      desc: '同城认识，过日子踏实。',
    },
    {
      name: '林晚',
      gender: 'female',
      portrait: 'young_female',
      age: 23,
      jobId: 'civil',
      education: '大学本科',
      income: 9200,
      cost: 18000,
      stats: { iq: 74, mood: 80, charm: 70, stamina: 62 },
      desc: '公务员，家里希望稳定。',
    },
    {
      name: '沈可',
      gender: 'female',
      portrait: 'young_female',
      age: 24,
      jobId: 'engineer',
      education: '大学本科',
      income: 18500,
      cost: 24000,
      stats: { iq: 82, mood: 68, charm: 66, stamina: 58 },
      desc: '大厂上班，节奏快。',
    },
  ],
  male: [
    {
      name: '周启明',
      gender: 'male',
      portrait: 'young_male',
      age: 26,
      jobId: 'didi',
      education: '高中',
      income: 6800,
      cost: 8000,
      stats: { iq: 60, mood: 84, charm: 62, stamina: 80 },
      desc: '跑车为生，人实在。',
    },
    {
      name: '韩磊',
      gender: 'male',
      portrait: 'young_male',
      age: 25,
      jobId: 'civil',
      education: '大学本科',
      income: 9200,
      cost: 18000,
      stats: { iq: 72, mood: 76, charm: 64, stamina: 66 },
      desc: '体制内，家里满意。',
    },
    {
      name: '苏宁',
      gender: 'male',
      portrait: 'young_male',
      age: 24,
      jobId: 'engineer',
      education: '大学本科',
      income: 18500,
      cost: 22000,
      stats: { iq: 80, mood: 70, charm: 64, stamina: 60 },
      desc: '写代码，收入不错。',
    },
  ],
};

export const LOVE_SPECIAL = {
  female: {
    name: '赵倩',
    gender: 'female',
    portrait: 'young_female',
    age: 25,
    jobId: 'influencer',
    education: '大学本科',
    income: 48000,
    cost: 36000,
    stats: { iq: 68, mood: 75, charm: 92, stamina: 58 },
    desc: '高净值网红，花代币才有机会认识。',
  },
  male: {
    name: '顾野',
    gender: 'male',
    portrait: 'young_male',
    age: 26,
    jobId: 'influencer',
    education: '大学本科',
    income: 52000,
    cost: 40000,
    stats: { iq: 70, mood: 72, charm: 90, stamina: 64 },
    desc: '高净值网红，花代币才有机会认识。',
  },
};

export const LOVE_ULTRA = {
  female: {
    name: '艾娃',
    gender: 'female',
    portrait: 'young_female',
    age: 27,
    jobId: 'engineer',
    education: '贵族本科',
    income: 128000,
    cost: 1280000,
    stats: { iq: 92, mood: 70, charm: 88, stamina: 60 },
    desc: '硅谷投资人，现金局才能约上。',
  },
  male: {
    name: '卡尔',
    gender: 'male',
    portrait: 'young_male',
    age: 29,
    jobId: 'engineer',
    education: '贵族本科',
    income: 136000,
    cost: 1280000,
    stats: { iq: 90, mood: 68, charm: 86, stamina: 64 },
    desc: '硅谷投资人，现金局才能约上。',
  },
};

export const INITIAL_FAMILY = {
  year: 2026,
  month: 3,
  cash: 331900,
  assets: 860000,
  tokens: 4,
  ownedIndustries: ['house'],
  metMusk: false,
  ownedJet: false,
  ownedFoundation: false,
  eventLog: [],
  paused: false,
  selectedId: null,
  nextPersonNum: 10,
  people: [
    {
      id: 'g1',
      name: '陈建国',
      gender: 'male',
      portrait: 'old_male',
      age: 72,
      generation: 0,
      role: '祖父',
      parentId: null,
      spouseId: 'g2',
      jobId: 'retired',
      schoolId: null,
      schoolStage: 'high',
      education: '高中',
      stats: { iq: 68, mood: 82, charm: 55, stamina: 42 },
      income: 4200,
      loveDrawn: true,
      workDrawn: true,
    },
    {
      id: 'g2',
      name: '李秀兰',
      gender: 'female',
      portrait: 'old_female',
      age: 70,
      generation: 0,
      role: '祖母',
      parentId: null,
      spouseId: 'g1',
      jobId: 'retired',
      schoolId: null,
      schoolStage: 'middle',
      education: '初中',
      stats: { iq: 62, mood: 88, charm: 60, stamina: 38 },
      income: 3800,
      loveDrawn: true,
      workDrawn: true,
    },
    {
      id: 'p1',
      name: '陈明',
      gender: 'male',
      portrait: 'mid_male',
      age: 42,
      generation: 1,
      role: '父亲',
      parentId: 'g1',
      spouseId: 'p2',
      jobId: 'engineer',
      schoolId: null,
      schoolStage: 'uni',
      education: '大学本科',
      stats: { iq: 78, mood: 65, charm: 58, stamina: 52 },
      income: 18500,
      loveDrawn: true,
      workDrawn: true,
      company: '疼讯',
    },
    {
      id: 'p2',
      name: '王雅',
      gender: 'female',
      portrait: 'mid_female',
      age: 40,
      generation: 1,
      role: '母亲',
      parentId: null,
      spouseId: 'p1',
      jobId: 'civil',
      schoolId: null,
      schoolStage: 'uni',
      education: '大学本科',
      stats: { iq: 75, mood: 70, charm: 72, stamina: 48 },
      income: 9200,
      loveDrawn: true,
      workDrawn: true,
      company: '市教育局',
    },
    {
      id: 'c1',
      name: '陈小雨',
      gender: 'female',
      portrait: 'child_female',
      age: 12,
      generation: 2,
      role: '女儿',
      parentId: 'p1',
      spouseId: null,
      jobId: 'student',
      schoolId: 'pri_county',
      schoolStage: 'primary',
      education: '小学',
      stats: { iq: 71, mood: 76, charm: 68, stamina: 80 },
      income: 0,
    },
    {
      id: 'c0',
      name: '陈晓峰',
      gender: 'male',
      portrait: 'young_male',
      age: 22,
      generation: 2,
      role: '儿子',
      parentId: 'p1',
      spouseId: null,
      jobId: 'student',
      schoolId: 'uni_county',
      schoolStage: 'uni',
      education: '大学本科',
      stats: { iq: 66, mood: 72, charm: 61, stamina: 78 },
      income: 0,
    },
    {
      id: 'c2',
      name: '陈浩然',
      gender: 'male',
      portrait: 'child_male',
      age: 8,
      generation: 2,
      role: '儿子',
      parentId: 'p1',
      spouseId: null,
      jobId: 'student',
      schoolId: 'pri_town',
      schoolStage: 'primary',
      education: '小学',
      stats: { iq: 65, mood: 84, charm: 52, stamina: 88 },
      income: 0,
    },
  ],
};

export const BABY_NAMES = {
  male: ['陈宇轩', '陈子墨', '陈嘉树'],
  female: ['陈思琪', '陈一诺', '陈予安'],
};

/** 姓名库：孩子每次随机抽，用尽则两字组合。对象入谱也从这里取，避免全家重名。 */

const SURNAMES = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];

const GIVEN_MALE = [
  '宇轩', '浩然', '子墨', '嘉树', '景行', '明哲', '致远', '博文', '思源', '昊天',
  '俊熙', '雨泽', '皓轩', '梓睿', '擎宇', '嘉懿', '煜城', '懿轩', '烨伟', '苑博',
  '伟诚', '明轩', '健柏', '晓博', '鑫磊', '晋鹏', '天磊', '绍辉', '泽洋', '鑫鹏',
  '昊强', '伟泽', '志强', '瑾瑜', '修杰', '烨华', '志泽', '弘文', '哲瀚', '雨泽',
];

const GIVEN_FEMALE = [
  '思琪', '一诺', '予安', '语桐', '若溪', '清欢', '晚晴', '嘉树', '子萱', '雨桐',
  '欣怡', '梓涵', '诗涵', '可馨', '紫萱', '雨欣', '淑华', '文静', '慧妍', '婧琪',
  '雪丽', '雅芙', '雨嘉', '娅楠', '美琳', '雪慧', '梦洁', '凌薇', '美莲', '雅静',
  '月婵', '雪雁', '婉婷', '嘉懿', '妍晨', '怡香', '慧娟', '梦琪', '忆柳', '之桃',
];

const MALE_A = ['宇', '浩', '子', '嘉', '景', '明', '致', '博', '思', '昊', '俊', '雨', '皓', '梓', '擎'];
const MALE_B = ['轩', '然', '墨', '树', '行', '哲', '远', '文', '源', '天', '熙', '泽', '睿', '城', '辉'];
const FEMALE_A = ['思', '一', '予', '语', '若', '清', '晚', '子', '雨', '欣', '梓', '诗', '可', '紫', '雅'];
const FEMALE_B = ['琪', '诺', '安', '桐', '溪', '欢', '晴', '萱', '桐', '怡', '涵', '馨', '华', '静', '妍'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function usedNames(people) {
  return new Set((people || []).map((p) => p.name));
}

function uniqueFrom(pool, used, fallback) {
  const free = pool.filter((n) => !used.has(n));
  if (free.length) return pick(free);
  return fallback();
}

function comboGiven(gender) {
  if (gender === 'female') return pick(FEMALE_A) + pick(FEMALE_B);
  return pick(MALE_A) + pick(MALE_B);
}

export function randomSurname() {
  return pick(SURNAMES);
}

export function randomFounderName(surname, gender, people) {
  const used = usedNames(people);
  const givenPool = gender === 'female' ? GIVEN_FEMALE : GIVEN_MALE;
  for (let i = 0; i < 80; i++) {
    const n = `${surname}${pick(givenPool)}`;
    if (!used.has(n)) return n;
  }
  return `${surname}${comboGiven(gender)}`;
}

/** 本族孩子：开局姓氏 + 随机两字名 */
export function randomBabyName(gender, people, surname = '陈') {
  const used = usedNames(people);
  const pool = (gender === 'female' ? GIVEN_FEMALE : GIVEN_MALE).map((g) => `${surname}${g}`);
  return uniqueFrom(pool, used, () => {
    let n = `${surname}${comboGiven(gender)}`;
    let i = 0;
    while (used.has(n) && i < 40) {
      n = `${surname}${comboGiven(gender)}`;
      i += 1;
    }
    return n;
  });
}

/** 入赘/娶进门的对象：随机姓+名，不跟现有家人撞 */
export function randomAdultName(gender, people) {
  const used = usedNames(people);
  const givenPool = gender === 'female' ? GIVEN_FEMALE : GIVEN_MALE;
  for (let i = 0; i < 80; i++) {
    const n = `${pick(SURNAMES)}${pick(givenPool)}`;
    if (!used.has(n)) return n;
  }
  return `${pick(SURNAMES)}${comboGiven(gender)}`;
}

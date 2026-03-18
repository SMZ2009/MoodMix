// Deterministic "birthday -> wuxing" mapping for profile-based recommendation.
// Goal: same birthday always results in the same wuxing/full_scores/derived mapping.

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// Stem -> element mapping (天干 -> 五行)
const STEM_TO_ELEMENT = {
  甲: 'wood',
  乙: 'wood',
  丙: 'fire',
  丁: 'fire',
  戊: 'earth',
  己: 'earth',
  庚: 'metal',
  辛: 'metal',
  壬: 'water',
  癸: 'water'
};

const ELEMENT_TO_CN = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水'
};

// birthday -> sexagenary day index calibration anchors.
// These are used to pick a day-index offset so that the deterministic day pillar matches the provided fixed map.
const DAY_ANCHORS = [
  { y: 2009, m: 5, d: 31, expectedStem: '壬', expectedBranch: '寅' },
  { y: 2026, m: 3, d: 16, expectedStem: '癸', expectedBranch: '未' }
];

function clampNumber(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseBirthday(birthday) {
  if (!birthday || typeof birthday !== 'string') return null;
  const m = birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function toJdn(y, m, d) {
  // Gregorian calendar JDN
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

function expectedDayIndexForPillar(expectedStem, expectedBranch) {
  const stemIndex = STEMS.indexOf(expectedStem);
  const branchIndex = BRANCHES.indexOf(expectedBranch);
  if (stemIndex < 0 || branchIndex < 0) return null;

  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) {
      return i;
    }
  }
  return null;
}

function getDayIndexOffset() {
  // Try to find a single offset (0..59) that satisfies all anchors.
  // If no offset matches all anchors (unlikely), fall back to first anchor.
  const anchorsWithIndex = DAY_ANCHORS.map((a) => {
    const expectedDayIndex = expectedDayIndexForPillar(a.expectedStem, a.expectedBranch);
    const jdn = toJdn(a.y, a.m, a.d);
    return { ...a, expectedDayIndex, jdn };
  }).filter(a => a.expectedDayIndex !== null);

  if (anchorsWithIndex.length === 0) return 0;

  const offsets = [];
  for (let offset = 0; offset < 60; offset++) {
    let ok = true;
    for (const a of anchorsWithIndex) {
      const dayIndex = (a.jdn + offset) % 60;
      if (dayIndex !== a.expectedDayIndex) {
        ok = false;
        break;
      }
    }
    if (ok) offsets.push(offset);
  }

  if (offsets.length > 0) return offsets[0];

  const first = anchorsWithIndex[0];
  const fallbackOffset = (first.expectedDayIndex - (first.jdn % 60) + 60) % 60;
  return fallbackOffset;
}

const DAY_INDEX_OFFSET = getDayIndexOffset();

function getYearPillarIndex(year) {
  // 1984 is known as 甲子 in most reference mappings.
  const BASE_YEAR = 1984;
  return ((year - BASE_YEAR) % 60 + 60) % 60;
}

function getYearStemBranch(year) {
  const idx = getYearPillarIndex(year);
  return {
    index: idx,
    stem: STEMS[idx % 10],
    branch: BRANCHES[idx % 12]
  };
}

function getDayStemBranch(y, m, d) {
  const jdn = toJdn(y, m, d);
  const idx = (jdn + DAY_INDEX_OFFSET) % 60;
  return {
    index: idx,
    stem: STEMS[idx % 10],
    branch: BRANCHES[idx % 12]
  };
}

// Derived deterministic mapping used by prompt rules to fill moodData numeric fields.
function getDerivedMoodMappingFromElement(element) {
  const base = {
    wood: { wuxingCn: '木', tasteScore: 7, colorCode: 2, textureScore: 1, temperature: -1, temporality: 6 },
    fire: { wuxingCn: '火', tasteScore: 8, colorCode: 4, textureScore: 2, temperature: 4, temporality: 14 },
    earth: { wuxingCn: '土', tasteScore: 6, colorCode: 3, textureScore: 0, temperature: 0, temporality: 12 },
    metal: { wuxingCn: '金', tasteScore: 4, colorCode: 1, textureScore: -1, temperature: -2, temporality: 18 },
    water: { wuxingCn: '水', tasteScore: 6, colorCode: 5, textureScore: -2, temperature: -4, temporality: 22 }
  };

  const v = base[element] || base.earth;
  return {
    wuxingCn: v.wuxingCn,
    tasteScore: clampNumber(v.tasteScore, 0, 10),
    colorCode: clampNumber(v.colorCode, 1, 5),
    textureScore: clampNumber(v.textureScore, -3, 3),
    temperature: clampNumber(v.temperature, -5, 5),
    temporality: clampNumber(v.temporality, 0, 23)
  };
}

/**
 * @param {string} birthday - format: YYYY-MM-DD
 * @returns {null | {
 *   full_scores: {wood:number,fire:number,earth:number,metal:number,water:number},
 *   dominant: 'wood'|'fire'|'earth'|'metal'|'water',
 *   dominantCn: '木'|'火'|'土'|'金'|'水',
 *   yearPillar: {stem:string,branch:string},
 *   dayPillar: {stem:string,branch:string},
 *   derivedMoodMapping: {wuxingCn:string,tasteScore:number,colorCode:number,textureScore:number,temperature:number,temporality:number}
 * }}
 */
export function calculateWuxingFromBirthday(birthday) {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;

  const { y, m, d } = parsed;

  // year_then_day:
  // 1) year stem decides main element (主属性)
  // 2) day stem adjusts balance (旺/弱修正)
  const yearPillar = getYearStemBranch(y);
  const dayPillar = getDayStemBranch(y, m, d);

  const yearElement = STEM_TO_ELEMENT[yearPillar.stem] || 'earth';
  const dayElement = STEM_TO_ELEMENT[dayPillar.stem] || 'earth';

  const scores = { wood: 10, fire: 10, earth: 10, metal: 10, water: 10 };
  scores[yearElement] += 30;
  scores[dayElement] += 20;

  let dominant = yearElement;
  let dominantScore = scores[dominant];
  for (const el of Object.keys(scores)) {
    if (scores[el] > dominantScore) {
      dominant = el;
      dominantScore = scores[el];
    }
  }

  const derivedMoodMapping = getDerivedMoodMappingFromElement(dominant);

  return {
    full_scores: scores,
    dominant,
    dominantCn: derivedMoodMapping.wuxingCn,
    yearPillar: { stem: yearPillar.stem, branch: yearPillar.branch },
    dayPillar: { stem: dayPillar.stem, branch: dayPillar.branch },
    derivedMoodMapping
  };
}


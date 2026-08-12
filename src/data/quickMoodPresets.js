const DIMENSION_KEYS = ['emotion', 'somatic', 'cognitive', 'demand', 'time', 'socialContext'];

/**
 * 将轻量预设转换成哲学标签引擎已经使用的 moodResult 结构。
 * 主维度固定为 0.9，其余维度固定为 0.2，避免本地标签退化为“待辨证”。
 */
function createPresetMoodResult(profile) {
  const moodData = { summary: profile.summary };

  DIMENSION_KEYS.forEach((key) => {
    const isPrimary = key === profile.primaryDimension;
    moodData[key] = {
      physical: {
        intensity: isPrimary ? 0.9 : 0.2,
        state: isPrimary ? profile.primaryState : '',
      },
    };
  });

  moodData.somatic.drinkMapping = {
    temperature: profile.temperature ?? 0,
  };
  moodData.demand.drinkMapping = {
    actionScore: profile.actionScore ?? 2,
  };
  moodData.time.physical.hour = profile.hour;

  const patternAnalysis = {
    polarity: {
      type: profile.polarity,
      confidence: 1,
    },
    wuxing: {
      user: profile.wuxing,
    },
    strategy: {
      type: profile.strategyType,
      logic: profile.summary,
    },
  };

  return {
    moodData,
    patternAnalysis,
    summary: profile.summary,
    rankingSalt: profile.value,
  };
}

/**
 * @typedef {Object} QuickMoodPresetCard
 * @property {string} apiId
 * @property {string} nameEn
 * @property {string} nameCn
 * @property {string} quote
 * @property {{score: number, comment: string}} quality
 */

/**
 * @typedef {Object} QuickMoodPreset
 * @property {string} value
 * @property {Object} moodProfile
 * @property {{intro: string, steps: [string, string, string], completion: string}} analysis
 * @property {QuickMoodPresetCard[]} cards
 */

/** @type {QuickMoodPreset[]} */
export const QUICK_MOOD_PRESETS = [
  {
    value: '#早起唤醒',
    moodProfile: {
      summary: '晨意初醒，精神需要轻快提振',
      polarity: 'positive',
      wuxing: 'wood',
      strategyType: 'harmonize',
      primaryDimension: 'demand',
      primaryState: '提神唤醒',
      temperature: 1,
      actionScore: 3,
      hour: 8,
    },
    analysis: {
      intro: '循晨意入味…',
      steps: [
        '晨光正沿着木的生发向上伸展。',
        '困意仍在，身体需要轻快而不锋利的提振。',
        '以咖啡香与明亮果意，把清醒慢慢点亮。',
      ],
      completion: '晨意初醒，精神需要轻快提振',
    },
    cards: [
      {
        apiId: '12782',
        nameEn: 'Thai Coffee',
        nameCn: '泰式咖啡',
        quote: '「把晨光摇进咖啡里，让清醒从第一口慢慢亮起来。」',
        quality: { score: 92, comment: '咖啡香提神，适合晨间启动' },
      },
      {
        apiId: '12776',
        nameEn: 'Melya',
        nameCn: '蜜雅咖啡',
        quote: '「蜂蜜托住咖啡的微苦，今天也可以温柔地醒来。」',
        quality: { score: 89, comment: '苦甜平衡，清醒不显锋利' },
      },
      {
        apiId: '15106',
        nameEn: 'Apello',
        nameCn: '苹果柑橘饮',
        quote: '「苹果与柑橘先替你伸个懒腰，把新鲜感送回身体。」',
        quality: { score: 86, comment: '果香轻快，温和唤醒身体' },
      },
    ],
  },
  {
    value: '#午后犯困',
    moodProfile: {
      summary: '午后倦意上涌，思路需要重新清亮',
      polarity: 'negative',
      wuxing: 'earth',
      strategyType: 'correct',
      primaryDimension: 'somatic',
      primaryState: '午后疲乏',
      temperature: 0,
      actionScore: 3,
      hour: 15,
    },
    analysis: {
      intro: '拨开午后倦意…',
      steps: [
        '午后的土气略显沉滞，倦意落在身体里。',
        '需要一点冰凉与清苦，把迟钝轻轻拨开。',
        '不必猛推，只让思路重新流动起来。',
      ],
      completion: '午后倦意上涌，思路需要重新清亮',
    },
    cards: [
      {
        apiId: '12770',
        nameEn: 'Iced Coffee',
        nameCn: '冰咖啡',
        quote: '「冰意轻敲困倦，给下午留一段干净利落的清醒。」',
        quality: { score: 93, comment: '冰凉清苦，快速拨开倦意' },
      },
      {
        apiId: '12784',
        nameEn: 'Thai Iced Coffee',
        nameCn: '泰式冰咖啡',
        quote: '「甜香与咖啡感交叠，倦意被轻轻推到窗外。」',
        quality: { score: 89, comment: '茶咖甜香，提神更显柔和' },
      },
      {
        apiId: '12768',
        nameEn: 'Frappé',
        nameCn: '希腊冰咖啡',
        quote: '「细密泡沫卷走迟钝，让思路重新有了流动感。」',
        quality: { score: 87, comment: '泡沫轻盈，适合午后重启' },
      },
    ],
  },
  {
    value: '#加班续命',
    moodProfile: {
      summary: '漫长工作仍未结束，神思需要稳稳续航',
      polarity: 'negative',
      wuxing: 'water',
      strategyType: 'correct',
      primaryDimension: 'cognitive',
      primaryState: '神思困顿',
      temperature: 0,
      actionScore: 3,
      hour: 21,
    },
    analysis: {
      intro: '为夜色续一程…',
      steps: [
        '夜色渐深，水的疲惫正拖慢神思。',
        '温热辛香或清爽果意，都在替专注续航。',
        '留一口喘息，再稳稳走完最后一程。',
      ],
      completion: '漫长工作仍未结束，神思需要稳稳续航',
    },
    cards: [
      {
        apiId: '12774',
        nameEn: 'Masala Chai',
        nameCn: '马萨拉香料茶',
        quote: '「香料把疲惫慢慢焐开，陪你稳稳走完最后一程。」',
        quality: { score: 91, comment: '温热辛香，稳住后半程专注' },
      },
      {
        apiId: '12786',
        nameEn: 'Thai Iced Tea',
        nameCn: '泰式冰茶',
        quote: '「茶香落在冰上，给绷紧的脑海留一口喘息。」',
        quality: { score: 88, comment: '冰茶回甘，给脑海一点余地' },
      },
      {
        apiId: '12718',
        nameEn: 'Pineapple Gingerale Smoothie',
        nameCn: '菠萝姜汁冰沙',
        quote: '「菠萝的明亮和姜的微辛，为漫长夜晚续上一格电。」',
        quality: { score: 86, comment: '果酸微辛，清爽补回活力' },
      },
    ],
  },
  {
    value: '#下班犒劳',
    moodProfile: {
      summary: '忙碌已经收束，此刻值得一份认真奖赏',
      polarity: 'positive',
      wuxing: 'metal',
      strategyType: 'harmonize',
      primaryDimension: 'emotion',
      primaryState: '完成后的轻松与奖赏',
      temperature: 0,
      actionScore: 2,
      hour: 19,
    },
    analysis: {
      intro: '替今日收束…',
      steps: [
        '今日诸事已收束，金的利落正在归位。',
        '微苦与醇厚适合替忙碌按下句号。',
        '这一杯不是逃离，是认真回应你的付出。',
      ],
      completion: '忙碌已经收束，此刻值得一份认真奖赏',
    },
    cards: [
      {
        apiId: '11001',
        nameEn: 'Old Fashioned',
        nameCn: '古典鸡尾酒',
        quote: '「一天已经收束，留一点醇厚，认真犒劳没有敷衍的你。」',
        quality: { score: 93, comment: '醇厚收束，适合认真犒劳' },
      },
      {
        apiId: '11003',
        nameEn: 'Negroni',
        nameCn: '尼格罗尼',
        quote: '「微苦不是为难，是替忙碌按下句号后的从容。」',
        quality: { score: 91, comment: '微苦利落，替忙碌漂亮收尾' },
      },
      {
        apiId: '11004',
        nameEn: 'Whiskey Sour',
        nameCn: '威士忌酸',
        quote: '「酸与暖意彼此拉住，让疲惫有地方落下。」',
        quality: { score: 89, comment: '酸暖平衡，让疲惫缓缓落下' },
      },
    ],
  },
  {
    value: '#周末放松',
    moodProfile: {
      summary: '时间终于松开，心情正适合舒展与欢聚',
      polarity: 'positive',
      wuxing: 'fire',
      strategyType: 'resonate',
      primaryDimension: 'emotion',
      primaryState: '松弛愉悦',
      temperature: -1,
      actionScore: 3,
      hour: 16,
    },
    analysis: {
      intro: '让时间慢下来…',
      steps: [
        '火的愉悦正在舒展，时间也慢了下来。',
        '薄荷、桃香与气泡，让轻快自然浮起。',
        '今天无需赶路，只管把松弛留在杯边。',
      ],
      completion: '时间终于松开，心情正适合舒展与欢聚',
    },
    cards: [
      {
        apiId: '11000',
        nameEn: 'Mojito',
        nameCn: '莫吉托',
        quote: '「薄荷和气泡把时间放慢，周末就该清清爽爽地展开。」',
        quality: { score: 94, comment: '薄荷清亮，最衬周末松弛' },
      },
      {
        apiId: '17207',
        nameEn: 'Pina Colada',
        nameCn: '椰林飘香',
        quote: '「椰香把海风搬到杯边，今天只负责松弛和开心。」',
        quality: { score: 92, comment: '椰香丰盈，适合放空' },
      },
      {
        apiId: '17195',
        nameEn: 'Bellini',
        nameCn: '贝里尼',
        quote: '「桃香与气泡轻轻碰杯，把好心情举得更高一点。」',
        quality: { score: 90, comment: '桃香轻盈，放大愉悦心情' },
      },
    ],
  },
  {
    value: '#睡前安抚',
    moodProfile: {
      summary: '夜色渐深，身心需要被轻轻托住',
      polarity: 'negative',
      wuxing: 'water',
      strategyType: 'harmonize',
      primaryDimension: 'demand',
      primaryState: '安静入睡',
      temperature: 2,
      actionScore: 1,
      hour: 23,
    },
    analysis: {
      intro: '把夜色调柔…',
      steps: [
        '夜色沉静，水的柔意正接住尚未放下的心绪。',
        '温热与柔和的奶香，适合让呼吸慢下来。',
        '今天到这里就好，剩下的交给明天。',
      ],
      completion: '夜色渐深，身心需要被轻轻托住',
    },
    cards: [
      {
        apiId: '12738',
        nameEn: 'Hot Chocolate to Die for',
        nameCn: '浓情热巧克力',
        quote: '「热巧克力把夜色调柔，剩下的事明天再想也来得及。」',
        quality: { score: 94, comment: '温热绵厚，适合睡前放松' },
      },
      {
        apiId: '12688',
        nameEn: 'Just a Moonmint',
        nameCn: '月光薄荷奶饮',
        quote: '「薄荷与奶香铺开一层月光，让呼吸慢慢沉下来。」',
        quality: { score: 91, comment: '薄荷奶香，让呼吸慢下来' },
      },
      {
        apiId: '12728',
        nameEn: 'Yoghurt Cooler',
        nameCn: '酸奶清饮',
        quote: '「柔和的酸奶感托住心绪，给今天一个安静的收尾。」',
        quality: { score: 88, comment: '柔和清润，为一天安静收尾' },
      },
    ],
  },
];

const PRESET_BY_VALUE = new Map(QUICK_MOOD_PRESETS.map((preset) => [preset.value, preset]));

export function getQuickMoodPreset(value) {
  return PRESET_BY_VALUE.get(value) || null;
}

function getDrinkApiId(drink) {
  if (drink?.apiId != null) return String(drink.apiId);
  if (typeof drink?.id === 'string') return drink.id.replace(/^api_/, '');
  return '';
}

/**
 * 将预设引用绑定到已加载的 CocktailDB 饮品对象，并生成画廊所需的三个状态字典。
 * 任一饮品缺失或 ID 重复时返回 null，调用方不得降级到模型链路。
 */
export function materializeQuickMoodPreset(value, apiDrinks = []) {
  const preset = getQuickMoodPreset(value);
  if (!preset || !Array.isArray(apiDrinks) || apiDrinks.length === 0) return null;

  const byApiId = new Map();
  const byEnglishName = new Map();

  apiDrinks.forEach((drink) => {
    const apiId = getDrinkApiId(drink);
    if (apiId) byApiId.set(apiId, drink);

    const englishName = String(drink?.nameEn || '').trim().toLowerCase();
    if (englishName) byEnglishName.set(englishName, drink);
  });

  const resolved = preset.cards.map((card) => {
    const drink = byApiId.get(card.apiId)
      || byEnglishName.get(card.nameEn.toLowerCase())
      || null;
    if (!drink) return null;

    return {
      card,
      drink: {
        ...drink,
        name: card.nameCn,
        nameCn: card.nameCn,
        name_cn: card.nameCn,
        nameEn: drink.nameEn || card.nameEn,
      },
    };
  });

  if (resolved.some((entry) => !entry)) return null;

  const drinks = resolved.map((entry) => entry.drink);
  if (drinks.length !== 3 || new Set(drinks.map((drink) => drink.id)).size !== 3) return null;

  const customQuotes = {};
  const qualityResults = {};
  resolved.forEach(({ card, drink }) => {
    customQuotes[drink.id] = card.quote;
    qualityResults[drink.id] = {
      drinkId: drink.id,
      score: card.quality.score,
      comment: card.quality.comment,
      detail: { source: 'preset' },
    };
  });

  return {
    source: 'preset',
    drinks,
    moodResult: createPresetMoodResult({ ...preset.moodProfile, value: preset.value }),
    analysis: preset.analysis,
    customQuotes,
    qualityResults,
  };
}

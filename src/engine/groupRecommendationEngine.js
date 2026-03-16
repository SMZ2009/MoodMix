import { generatePhilosophyTags } from './philosophyTags';

const GROUPS = [
  {
    id: 1,
    name: '微醺夜话',
    description: '分享你的调酒故事，聊聊那些让人微醺的夜晚',
    memberCount: 128,
    onlineCount: 23,
    icon: 'Wine',
    color: 'from-purple-400 to-pink-400',
    tags: ['鸡尾酒', '夜生活', '故事'],
    matchingRules: {
      abv: { min: 5, max: 40 },
      taste: { sweet: 3, bitter: 2 },
      dimensions: { temperature: { min: -2, max: 1 } },
      philosophyTags: ['郁气难舒', '心绪浮躁', '想要释放']
    },
    recentMessages: [
      { user: '调酒师小王', content: '今晚调了一杯莫吉托，薄荷味道太清新了！', time: '2分钟前' },
      { user: '夜猫子', content: '有人试过用桂花糖浆代替普通糖浆吗？', time: '5分钟前' }
    ]
  },
  {
    id: 2,
    name: '清心茶社',
    description: '无酒精饮品的聚集地，享受清醒的时光',
    memberCount: 89,
    onlineCount: 15,
    icon: 'Coffee',
    color: 'from-emerald-400 to-teal-400',
    tags: ['无酒精', '茶饮', '清醒'],
    matchingRules: {
      abv: { min: 0, max: 0 },
      taste: { sweet: 2, bitter: 3 },
      dimensions: { temperature: { min: 0, max: 3 } },
      philosophyTags: ['心气舒展', '思路通透', '想要安静']
    },
    recentMessages: [
      { user: '茶艺师', content: '推荐一款茉莉花茶特调，清香怡人', time: '1分钟前' },
      { user: '养生达人', content: '枸杞菊花茶配柠檬，清爽又健康', time: '8分钟前' }
    ]
  },
  {
    id: 3,
    name: '烈酒俱乐部',
    description: '威士忌、白兰地爱好者的专属领地',
    memberCount: 156,
    onlineCount: 28,
    icon: 'Flame',
    color: 'from-amber-500 to-orange-500',
    tags: ['烈酒', '威士忌', '品鉴'],
    matchingRules: {
      abv: { min: 30, max: 60 },
      taste: { bitter: 4, spicy: 3 },
      dimensions: { temperature: { min: 0, max: 2 } },
      philosophyTags: ['兴致正浓', '身暖气足', '想要提神']
    },
    recentMessages: [
      { user: '威士忌迷', content: '这款单一麦芽的泥煤味太棒了', time: '3分钟前' },
      { user: '白兰地爱好者', content: '有人试过陈年干邑配雪茄吗？', time: '10分钟前' }
    ]
  },
  {
    id: 4,
    name: '清爽夏日',
    description: '夏日冰饮、气泡酒的清爽世界',
    memberCount: 203,
    onlineCount: 45,
    icon: 'Droplets',
    color: 'from-cyan-400 to-blue-400',
    tags: ['冰饮', '气泡', '清爽'],
    matchingRules: {
      abv: { min: 0, max: 15 },
      taste: { sour: 3, sweet: 4 },
      dimensions: { temperature: { min: -3, max: -1 }, effervescence: { min: 3 } },
      philosophyTags: ['体凉神清', '燥热难安', '想要安静']
    },
    recentMessages: [
      { user: '夏日控', content: '金汤力加青柠，绝配！', time: '刚刚' },
      { user: '气泡爱好者', content: '普罗塞克的气泡感太治愈了', time: '4分钟前' }
    ]
  },
  {
    id: 5,
    name: '创意调酒实验室',
    description: '大胆尝试，创造属于你的特调配方',
    memberCount: 178,
    onlineCount: 34,
    icon: 'Palette',
    color: 'from-rose-400 to-red-400',
    tags: ['DIY', '创意', '实验'],
    matchingRules: {
      abv: { min: 0, max: 40 },
      taste: { sweet: 3, sour: 3, bitter: 3 },
      dimensions: {},
      philosophyTags: ['思路通透', '想要热闹', '想要慰藉']
    },
    recentMessages: [
      { user: '实验家', content: '用抹茶和伏特加调了一杯，味道很奇妙', time: '刚刚' },
      { user: '调酒新手', content: '求推荐适合女生的低度鸡尾酒配方', time: '4分钟前' }
    ]
  },
  {
    id: 6,
    name: '经典鸡尾酒鉴赏',
    description: '品味经典，传承调酒文化',
    memberCount: 134,
    onlineCount: 22,
    icon: 'Wine',
    color: 'from-violet-500 to-purple-500',
    tags: ['经典', '传统', '品鉴'],
    matchingRules: {
      abv: { min: 15, max: 35 },
      taste: { bitter: 3, sweet: 2 },
      dimensions: { texture: { min: 2, max: 5 } },
      philosophyTags: ['踏实安稳', '清醒自在', '想要慰藉']
    },
    recentMessages: [
      { user: '经典派', content: '马天尼的黄金比例是6:1', time: '2分钟前' },
      { user: '调酒师', content: '古典鸡尾酒要用方糖搅拌', time: '6分钟前' }
    ]
  },
  {
    id: 7,
    name: '甜点酒馆',
    description: '甜酒、利口酒爱好者的甜蜜时光',
    memberCount: 112,
    onlineCount: 18,
    icon: 'Coffee',
    color: 'from-pink-400 to-rose-400',
    tags: ['甜酒', '利口酒', '甜点'],
    matchingRules: {
      abv: { min: 5, max: 25 },
      taste: { sweet: { min: 5 } },
      dimensions: { texture: { min: 1, max: 4 } },
      philosophyTags: ['想要慰藉', '心气舒展', '踏实安稳']
    },
    recentMessages: [
      { user: '甜食控', content: '百利甜配巧克力，绝了！', time: '1分钟前' },
      { user: '利口酒爱好者', content: '推荐一款橙味利口酒', time: '7分钟前' }
    ]
  },
  {
    id: 8,
    name: '苦味行者',
    description: '苦味酒、草本酒的深度探索',
    memberCount: 67,
    onlineCount: 9,
    icon: 'Flame',
    color: 'from-stone-500 to-neutral-600',
    tags: ['苦味', '草本', '深度'],
    matchingRules: {
      abv: { min: 10, max: 45 },
      taste: { bitter: { min: 4 } },
      dimensions: {},
      philosophyTags: ['感伤低落', '想要安静', '思路通透']
    },
    recentMessages: [
      { user: '苦味爱好者', content: '金巴利的苦味太上头了', time: '5分钟前' },
      { user: '草本迷', content: '苦艾酒要怎么喝才好？', time: '12分钟前' }
    ]
  }
];

function calculateMatchScore(drink, group) {
  let score = 0;
  let maxScore = 0;

  const rules = group.matchingRules;

  if (!rules) return { score: 0, maxScore: 0 };

  if (rules.abv) {
    maxScore += 20;
    const { min, max } = rules.abv;
    if (drink.abv >= min && drink.abv <= max) {
      score += 20;
    } else if (drink.abv < min) {
      score += Math.max(0, 20 - (min - drink.abv) * 2);
    } else {
      score += Math.max(0, 20 - (drink.abv - max) * 2);
    }
  }

  if (rules.taste) {
    maxScore += 30;
    const tasteMatch = rules.taste;
    const drinkTaste = drink.dimensions?.taste || {};
    
    for (const [tasteKey, ruleValue] of Object.entries(tasteMatch)) {
      const drinkValue = drinkTaste[tasteKey] || 0;
      if (typeof ruleValue === 'object' && ruleValue.min !== undefined) {
        if (drinkValue >= ruleValue.min) {
          score += 15;
        } else {
          score += Math.max(0, 15 - (ruleValue.min - drinkValue) * 3);
        }
      } else {
        if (drinkValue >= ruleValue) {
          score += 10;
        } else {
          score += Math.max(0, 10 - (ruleValue - drinkValue) * 2);
        }
      }
    }
  }

  if (rules.dimensions) {
    maxScore += 30;
    const dimMatch = rules.dimensions;
    const drinkDims = drink.dimensions || {};

    for (const [dimKey, ruleValue] of Object.entries(dimMatch)) {
      const drinkValue = drinkDims[dimKey]?.value || drinkDims[dimKey] || 0;
      if (typeof ruleValue === 'object' && ruleValue.min !== undefined) {
        if (drinkValue >= ruleValue.min && drinkValue <= (ruleValue.max || 10)) {
          score += 15;
        } else {
          score += Math.max(0, 15 - Math.abs(drinkValue - ruleValue.min) * 2);
        }
      } else {
        if (drinkValue >= ruleValue) {
          score += 15;
        }
      }
    }
  }

  if (rules.philosophyTags && rules.philosophyTags.length > 0) {
    maxScore += 20;
    const philosophy = generatePhilosophyTags(drink.dimensions);
    const drinkTags = philosophy.tags || [];
    
    const tagMatchCount = rules.philosophyTags.filter(tag => 
      drinkTags.some(dt => dt.includes(tag) || tag.includes(dt))
    ).length;
    
    score += (tagMatchCount / rules.philosophyTags.length) * 20;
  }

  return { score, maxScore };
}

export function recommendGroups(drink, limit = 3) {
  if (!drink) return [];

  const scoredGroups = GROUPS.map(group => {
    const { score, maxScore } = calculateMatchScore(drink, group);
    const matchPercentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return { ...group, matchPercentage };
  });

  scoredGroups.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return scoredGroups.filter(g => g.matchPercentage >= 40).slice(0, limit);
}

export function getAllGroups() {
  return GROUPS;
}

export function getGroupById(groupId) {
  return GROUPS.find(g => g.id === groupId);
}

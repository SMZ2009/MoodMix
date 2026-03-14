/**
 * 输入验证器 - 检测特殊输入场景并返回友好提示
 * 
 * 场景包括：
 * - 空输入、过长输入
 * - 纯数字/字母/符号
 * - 乱码检测
 * - 知识类/指令类/新闻类问题
 * - 模糊情绪表达
 */

// 场景标识与东方哲学风文案映射
const SCENE_MESSAGES = {
  empty: {
    title: '小提醒',
    message: '心里装着什么？\n说与我听，我为你寻一杯。',
    tone: 'default'
  },
  too_long: {
    title: '小提醒',
    message: '话多情深，\n但我只需知道此刻你是什么滋味？',
    tone: 'default'
  },
  unsupported_format_numbers: {
    title: '小提醒',
    message: '数字难解心意，\n用几个字告诉我你的心境吧。',
    tone: 'warning'
  },
  unsupported_format_letters: {
    title: '小提醒',
    message: '字母难诉心绪，\n换几个汉字说说你此刻的感受？',
    tone: 'warning'
  },
  unsupported_format_special: {
    title: '小提醒',
    message: '符号无声，心情有味，\n用文字告诉我吧。',
    tone: 'warning'
  },
  gibberish_numbers: {
    title: '小提醒',
    message: '这串数字，我读不懂，\n此刻心里是什么感觉？',
    tone: 'warning'
  },
  gibberish_letters: {
    title: '小提醒',
    message: '这串字母，我读不懂，\n换个方式说说你的心情？',
    tone: 'warning'
  },
  gibberish_keyboard: {
    title: '小提醒',
    message: '是心乱了吗？没关系，\n试着说说此刻的感受。',
    tone: 'default'
  },
  gibberish_chinese: {
    title: '小提醒',
    message: '话语兜了圈，\n说说你真正想表达的是什么？',
    tone: 'default'
  },
  knowledge_question: {
    title: '小提醒',
    message: '我只懂以饮识心，\n告诉我你此刻的心境吧。',
    tone: 'default'
  },
  command_task: {
    title: '小提醒',
    message: '我只做一件事，\n寻一杯与你此刻相配的饮品。',
    tone: 'default'
  },
  weather_news_stock: {
    title: '小提醒',
    message: '世事纷扰，我只问你一句，\n此刻心里是什么滋味？',
    tone: 'default'
  },
  tech_academic: {
    title: '小提醒',
    message: '学问之外，我只懂以味抚心，\n说说你的心境？',
    tone: 'default'
  },
  ambiguous_multi_emotion: {
    title: '小提醒',
    message: '情绪如水，几股交汇，\n此刻哪一股最涌？',
    tone: 'default'
  },
  no_keywords_long_text: {
    title: '小提醒',
    message: '千言道不尽，我只需一句，\n你现在是什么心情？',
    tone: 'default'
  }
};

// 情绪相关关键词（用于判断是否包含有效情绪表达）
const EMOTION_KEYWORDS = [
  // 基础情绪
  '开心', '高兴', '快乐', '幸福', '兴奋', '激动', '满足', '舒服', '舒适', '愉快',
  '难过', '伤心', '悲伤', '痛苦', '失落', '沮丧', '低落', '郁闷', '抑郁', '消沉',
  '生气', '愤怒', '恼火', '烦躁', '焦虑', '紧张', '担心', '害怕', '恐惧', '惊慌',
  '平静', '安宁', '放松', '轻松', '自在', '惬意', '悠闲', '淡定', '从容', '坦然',
  '疲惫', '累', '困', '倦', '乏', '无聊', '寂寞', '孤独', '空虚', '迷茫',
  '期待', '渴望', '想念', '思念', '怀念', '感动', '感激', '温暖', '甜蜜', '浪漫',
  // 口语化表达
  '烦', '丧', 'emo', '破防', '心累', '躺平', '摆烂', '无语', '崩溃', '裂开',
  '爽', '嗨', '飘', '醉', '晕', '蒙', '懵', '慌', '虚', '飘飘然',
  // 身体感受
  '冷', '热', '渴', '饿', '困', '痛', '酸', '麻', '胀', '闷',
  // 场景暗示
  '加班', '下班', '周末', '失眠', '熬夜', '约会', '庆祝', '聚会', '独处', '发呆',
  // 天气/时间暗示情绪
  '下雨', '晴天', '阴天', '夜深', '清晨', '傍晚', '黄昏', '深夜',
  // 动作暗示
  '想喝', '来一杯', '解解', '放松一下', '庆祝', '解闷', '醒醒', '提神'
];

// 知识类问题关键词
const KNOWLEDGE_KEYWORDS = [
  '是什么', '什么是', '怎么做', '如何', '为什么', '为啥', '原因', '解释',
  '区别', '对比', '比较', '哪个好', '推荐', '建议', '评价', '评测',
  '历史', '发明', '起源', '来源', '由来', '故事', '典故',
  '配方', '做法', '步骤', '方法', '技巧', '教程', '攻略',
  '多少钱', '价格', '哪里买', '在哪', '地址', '电话'
];

// 指令类关键词
const COMMAND_KEYWORDS = [
  '帮我', '请', '给我', '告诉我', '查一下', '搜索', '找', '查询',
  '翻译', '计算', '转换', '生成', '创建', '写', '画', '做',
  '打开', '关闭', '设置', '修改', '删除', '添加', '保存',
  '播放', '暂停', '下一首', '上一首', '音量', '亮度'
];

// 天气/新闻/股票关键词
const NEWS_KEYWORDS = [
  '天气', '温度', '气温', '下雨', '下雪', '台风', '预报',
  '新闻', '头条', '热搜', '热点', '事件', '最新', '今日',
  '股票', '基金', '涨', '跌', '大盘', '指数', '行情', '市场',
  '比赛', '比分', '赛程', '冠军', '足球', '篮球', '奥运'
];

// 技术/学术关键词
const TECH_KEYWORDS = [
  '代码', '编程', '算法', '函数', '变量', '数据库', 'API', 'bug',
  '论文', '研究', '实验', '数据', '分析', '结论', '假设', '理论',
  '公式', '定理', '证明', '推导', '计算', '方程', '矩阵', '向量',
  'AI', '人工智能', '机器学习', '深度学习', '神经网络', 'GPT', 'LLM'
];

// 键盘乱码检测模式 (连续的键盘相邻键)
const KEYBOARD_PATTERNS = [
  /[qwerty]{4,}/i, /[asdfgh]{4,}/i, /[zxcvbn]{4,}/i,
  /[uiop]{4,}/i, /[jkl;]{4,}/i, /[nm,\.]{4,}/i,
  /(.)\1{3,}/, // 连续重复字符
  /[1234567890]{5,}/, // 连续数字
  /[!@#$%^&*()]{3,}/ // 连续符号
];

/**
 * 验证用户输入
 * @param {string} input - 用户输入
 * @returns {Object} { valid: boolean, scene?: string, ...SCENE_MESSAGES[scene] }
 */
export function validateInput(input) {
  // 1. 空输入检查
  if (!input || typeof input !== 'string') {
    return { valid: false, scene: 'empty', ...SCENE_MESSAGES.empty };
  }

  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, scene: 'empty', ...SCENE_MESSAGES.empty };
  }

  // 2. 过长输入检查 (超过200字)
  if (trimmed.length > 200) {
    return { valid: false, scene: 'too_long', ...SCENE_MESSAGES.too_long };
  }

  // 3. 纯数字检查
  if (/^[\d\s\.\,\-\+]+$/.test(trimmed)) {
    if (trimmed.length > 10) {
      return { valid: false, scene: 'gibberish_numbers', ...SCENE_MESSAGES.gibberish_numbers };
    }
    return { valid: false, scene: 'unsupported_format_numbers', ...SCENE_MESSAGES.unsupported_format_numbers };
  }

  // 4. 纯字母检查 (无中文)
  if (/^[a-zA-Z\s\.\,\!\?\-\'\"]+$/.test(trimmed) && !/[\u4e00-\u9fa5]/.test(trimmed)) {
    // 检查是否是有意义的英文情绪词
    const lowerInput = trimmed.toLowerCase();
    const validEnglishEmotions = ['happy', 'sad', 'tired', 'angry', 'calm', 'excited', 'bored', 'lonely', 'relaxed', 'stressed'];
    if (validEnglishEmotions.some(word => lowerInput.includes(word))) {
      return { valid: true };
    }
    
    if (trimmed.length > 15) {
      return { valid: false, scene: 'gibberish_letters', ...SCENE_MESSAGES.gibberish_letters };
    }
    return { valid: false, scene: 'unsupported_format_letters', ...SCENE_MESSAGES.unsupported_format_letters };
  }

  // 5. 纯符号检查
  if (/^[^\u4e00-\u9fa5a-zA-Z0-9]+$/.test(trimmed)) {
    return { valid: false, scene: 'unsupported_format_special', ...SCENE_MESSAGES.unsupported_format_special };
  }

  // 6. 键盘乱码检测
  for (const pattern of KEYBOARD_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, scene: 'gibberish_keyboard', ...SCENE_MESSAGES.gibberish_keyboard };
    }
  }

  // 7. 中文乱码检测 (重复字符过多或无意义组合)
  const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g) || [];
  if (chineseChars.length > 5) {
    // 检查重复率
    const uniqueChars = new Set(chineseChars);
    const repeatRate = 1 - (uniqueChars.size / chineseChars.length);
    if (repeatRate > 0.7) {
      return { valid: false, scene: 'gibberish_chinese', ...SCENE_MESSAGES.gibberish_chinese };
    }
  }

  // 8. 知识类问题检测
  if (KNOWLEDGE_KEYWORDS.some(kw => trimmed.includes(kw))) {
    // 排除与情绪/饮品相关的合理问题
    const isEmotionRelated = EMOTION_KEYWORDS.some(ek => trimmed.includes(ek));
    const isDrinkRelated = /酒|饮|喝|杯|调|品/.test(trimmed);
    if (!isEmotionRelated && !isDrinkRelated) {
      return { valid: false, scene: 'knowledge_question', ...SCENE_MESSAGES.knowledge_question };
    }
  }

  // 9. 指令类检测
  if (COMMAND_KEYWORDS.some(kw => trimmed.startsWith(kw))) {
    const isDrinkCommand = /酒|饮|喝|杯|推荐/.test(trimmed);
    if (!isDrinkCommand) {
      return { valid: false, scene: 'command_task', ...SCENE_MESSAGES.command_task };
    }
  }

  // 10. 天气/新闻/股票检测
  if (NEWS_KEYWORDS.some(kw => trimmed.includes(kw))) {
    const hasEmotionContext = EMOTION_KEYWORDS.some(ek => trimmed.includes(ek));
    if (!hasEmotionContext) {
      return { valid: false, scene: 'weather_news_stock', ...SCENE_MESSAGES.weather_news_stock };
    }
  }

  // 11. 技术/学术检测
  if (TECH_KEYWORDS.some(kw => trimmed.toLowerCase().includes(kw.toLowerCase()))) {
    const hasEmotionContext = EMOTION_KEYWORDS.some(ek => trimmed.includes(ek));
    if (!hasEmotionContext) {
      return { valid: false, scene: 'tech_academic', ...SCENE_MESSAGES.tech_academic };
    }
  }

  // 12. 长文本但无情绪关键词检测
  if (trimmed.length > 50) {
    const hasEmotionKeyword = EMOTION_KEYWORDS.some(kw => trimmed.includes(kw));
    if (!hasEmotionKeyword) {
      return { valid: false, scene: 'no_keywords_long_text', ...SCENE_MESSAGES.no_keywords_long_text };
    }
  }

  // 13. 多重情绪检测 (可选提示，不阻断)
  const matchedEmotions = EMOTION_KEYWORDS.filter(kw => trimmed.includes(kw));
  const conflictingEmotions = detectConflictingEmotions(matchedEmotions);
  if (conflictingEmotions && trimmed.length > 30) {
    // 这种情况下可以选择提示但不阻断
    // return { valid: false, scene: 'ambiguous_multi_emotion', ...SCENE_MESSAGES.ambiguous_multi_emotion };
    // 暂时设为 valid，让系统尝试处理
  }

  // 验证通过
  return { valid: true };
}

/**
 * 检测冲突的情绪
 */
function detectConflictingEmotions(emotions) {
  const positiveEmotions = ['开心', '高兴', '快乐', '幸福', '兴奋', '满足', '愉快', '爽', '嗨'];
  const negativeEmotions = ['难过', '伤心', '悲伤', '痛苦', '失落', '沮丧', '郁闷', '烦', '丧', 'emo'];
  
  const hasPositive = emotions.some(e => positiveEmotions.includes(e));
  const hasNegative = emotions.some(e => negativeEmotions.includes(e));
  
  return hasPositive && hasNegative;
}

/**
 * 获取场景消息
 */
export function getSceneMessage(scene) {
  return SCENE_MESSAGES[scene] || null;
}

export default validateInput;

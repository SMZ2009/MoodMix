/**
 * 东方哲学标签与推荐语生成器 v4.0
 * 
 * 设计原则：
 *   标签和推荐语共同讲述一个 "辨证施饮" 故事链：
 *   你现在怎么了 → 需要什么调理 → 这杯酒喝起来什么感觉
 * 
 * 三枚标签连读示例：
 *   「心绪浮躁」→「以水沉降」→「清冽·安神」
 *   「郁气难舒」→「借金疏散」→「辛香·开窍」
 *   「兴致正浓」→「同火共振」→「烈感·上扬」
 */

import { determineDrinkWuXing } from './wuxingMapper';

// ============================================================
//  常量与映射表
// ============================================================

const WUXING_CN = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

/**
 * 五行相生相克关系 → 用户可感知的 4 字动词短语
 * key = 关系类型, value = 函数(drinkElement) => 标签文本
 * 
 * 设计要点：
 *   - 每个短语以"以/借/同"开头，统一语感
 *   - 动词必须暗示调理方向（升/降/散/收/润/泄）
 *   - 总长度控制在 4-6 个汉字，不超过 7 个
 */
const RELATION_PHRASES = {
    '生':   (el) => `借${el}生发`,   // 用户生饮品：用户的能量往外走，借饮品顺势升发
    '被生': (el) => `以${el}滋养`,   // 饮品生用户：饮品补给用户
    '克':   (el) => `以${el}制衡`,   // 饮品克用户：饮品约束用户过亢的气
    '被克': (el) => `借${el}收敛`,   // 用户克饮品：用户主动收束
    '同':   (el) => `同${el}共振`,   // 同行：放大当前状态
};

/**
 * 六维 → 用户可感知的"状态描述词"
 * 
 * 设计要点：
 *   - 不用中医术语（不说"肝气郁结"），说人话（"郁气难舒"）
 *   - 正向/负向各一套，由 polarity 决定走哪条
 *   - 每个词都要让用户觉得"对，说的就是我现在的状态"
 */
const STATE_DESCRIPTORS = {
    emotion: {
        positive: {
            wood:  '心气舒展',
            fire:  '兴致正浓',
            earth: '踏实安稳',
            metal: '清醒自在',
            water: '沉静深远',
        },
        negative: {
            wood:  '郁气难舒',
            fire:  '心绪浮躁',
            earth: '倦怠沉闷',
            metal: '感伤低落',
            water: '不安焦虑',
        },
    },
    somatic: {
        positive: {
            hot:  '身暖气足',
            cold: '体凉神清',
            neutral: '身心安适',
        },
        negative: {
            hot:  '燥热难安',
            cold: '寒凉乏力',
            neutral: '气虚体倦',
        },
    },
    cognitive: {
        positive: '思路通透',
        negative: '神思困顿',
        scattered: '思绪纷飞',
    },
    demand: {
        release:  '想要释放',
        calm:     '想要安静',
        energize: '想要提神',
        social:   '想要热闹',
        comfort:  '想要慰藉',
    },
};

/**
 * 体感组合表：(温度区间, 质地区间) → 体感短语
 * 
 * 设计要点：
 *   - 两个维度交叉，覆盖所有常见情况，避免大量 if-else
 *   - 格式统一为 "XX·YY"，4-6 字
 *   - "·" 前描述入口第一感，"·" 后描述饮后走向
 */
const SENSORY_MATRIX = {
    // temp: cold(-5~-2), cool(-2~0), neutral(0~1), warm(1~3), hot(3~5)
    // texture: thin(-3~-1), smooth(-1~1), thick(1~3)
    'cold_thin':    '清冽·沉降',
    'cold_smooth':  '冰润·收束',
    'cold_thick':   '冰感·绵密',
    'cool_thin':    '微凉·通透',
    'cool_smooth':  '凉爽·顺滑',
    'cool_thick':   '凉润·醇厚',
    'neutral_thin': '清淡·轻盈',
    'neutral_smooth':'柔和·平稳',
    'neutral_thick': '醇厚·饱满',
    'warm_thin':    '温透·升散',
    'warm_smooth':  '温润·舒展',
    'warm_thick':   '温厚·绵长',
    'hot_thin':     '灼烈·冲击',
    'hot_smooth':   '热感·蔓延',
    'hot_thick':    '浓烈·深沉',
};

/**
 * 味觉修饰词：当味觉特征突出时，替换或增强体感标签
 */
const TASTE_MODIFIERS = {
    sour:  { threshold: 4, word: '酸爽', effect: '开窍' },
    sweet: { threshold: 5, word: '甘润', effect: '缓释' },
    bitter:{ threshold: 4, word: '微苦', effect: '清心' },
    spicy: { threshold: 3, word: '辛香', effect: '升提' },
};

// ============================================================
//  标签生成函数
// ============================================================

/**
 * 标签1：辨证标签 —— "你现在怎么了"
 * 
 * 逻辑：
 *   1. 取 intensity 最高的维度作为主诉
 *   2. 根据 polarity (正/负) 选择描述词
 *   3. 如果有次高维度且 intensity > 0.6，附加补充
 * 
 * @param {Object} moodData - Agent 1 输出的六维数据
 * @param {Object} patternAnalysis - Agent 2 输出的辨证结论
 * @returns {string} 如 "郁气难舒" / "心绪浮躁，神思困顿"
 */
function generateDiagnosisTag(moodData, patternAnalysis) {
    if (!moodData || !patternAnalysis) {
        return '待辨证';
    }

    const polarity = patternAnalysis?.polarity?.type || 'negative';
    const userWuxing = patternAnalysis?.wuxing?.user || 'earth';

    // 收集各维度的 intensity
    const dims = [
        { key: 'emotion',   intensity: moodData.emotion?.intensity ?? 0.5 },
        { key: 'somatic',   intensity: moodData.somatic?.intensity ?? 0.3 },
        { key: 'cognitive',  intensity: moodData.cognitive?.intensity ?? 0.3 },
        { key: 'demand',    intensity: moodData.demand?.intensity ?? 0.3 },
    ];

    // 按 intensity 降序
    dims.sort((a, b) => b.intensity - a.intensity);
    const primary = dims[0];
    const secondary = dims[1];

    // --- 主诉标签 ---
    let mainTag = '';

    if (primary.key === 'emotion') {
        const pool = polarity === 'positive'
            ? STATE_DESCRIPTORS.emotion.positive
            : STATE_DESCRIPTORS.emotion.negative;
        mainTag = pool[userWuxing] || pool.earth;

    } else if (primary.key === 'somatic') {
        // 判断寒热
        const tempVal = moodData.somatic?.drinkMapping?.temperature ?? 0;
        const heatKey = tempVal > 1 ? 'hot' : tempVal < -1 ? 'cold' : 'neutral';
        const pool = polarity === 'positive'
            ? STATE_DESCRIPTORS.somatic.positive
            : STATE_DESCRIPTORS.somatic.negative;
        mainTag = pool[heatKey] || pool.neutral;

    } else if (primary.key === 'cognitive') {
        const cogState = moodData.cognitive?.physical?.state || '';
        if (cogState.includes('散') || cogState.includes('乱')) {
            mainTag = STATE_DESCRIPTORS.cognitive.scattered;
        } else {
            mainTag = polarity === 'positive'
                ? STATE_DESCRIPTORS.cognitive.positive
                : STATE_DESCRIPTORS.cognitive.negative;
        }

    } else if (primary.key === 'demand') {
        // 从 demand 的物理映射推断诉求类型
        const actionScore = moodData.demand?.drinkMapping?.actionScore ?? 2;
        if (actionScore >= 4) mainTag = STATE_DESCRIPTORS.demand.release;
        else if (actionScore <= 1) mainTag = STATE_DESCRIPTORS.demand.calm;
        else mainTag = STATE_DESCRIPTORS.demand.comfort;
    }

    // --- 如果次要维度也很强 (intensity > 0.6)，附加补充 ---
    if (secondary && secondary.intensity > 0.6 && primary.intensity - secondary.intensity < 0.2) {
        let subTag = '';
        if (secondary.key === 'cognitive') {
            const cogState = moodData.cognitive?.physical?.state || '';
            if (cogState.includes('散') || cogState.includes('乱')) {
                subTag = STATE_DESCRIPTORS.cognitive.scattered;
            } else {
                subTag = polarity === 'positive'
                    ? STATE_DESCRIPTORS.cognitive.positive
                    : STATE_DESCRIPTORS.cognitive.negative;
            }
        } else if (secondary.key === 'somatic') {
            const tempVal = moodData.somatic?.drinkMapping?.temperature ?? 0;
            const heatKey = tempVal > 1 ? 'hot' : tempVal < -1 ? 'cold' : 'neutral';
            subTag = (polarity === 'positive'
                ? STATE_DESCRIPTORS.somatic.positive
                : STATE_DESCRIPTORS.somatic.negative)[heatKey];
        }
        // 如果有有效的次要标签，且和主标签不重复
        if (subTag && subTag !== mainTag) {
            return `${mainTag}，${subTag}`;
        }
    }

    return mainTag || '气机待调';
}

/**
 * 标签2：策略标签 —— "需要什么调理"
 * 
 * 逻辑：
 *   1. 确定用户五行和饮品五行的关系
 *   2. 输出一个动作短语，格式 "以X调Y" / "借X生发"
 *   3. 控制在 4-6 字，不超过 7 字
 *
 * @param {Object} patternAnalysis - Agent 2 输出
 * @param {string} drinkWuXing - 饮品五行 (英文 key)
 * @returns {string} 如 "以金制衡" / "同火共振"
 */
function generateStrategyTag(patternAnalysis, drinkWuXing) {
    if (!patternAnalysis || !drinkWuXing) {
        return '调和气机';
    }

    const userWuxing = patternAnalysis?.wuxing?.user || 'earth';
    const userEl = WUXING_CN[userWuxing] || '气';
    const drinkEl = WUXING_CN[drinkWuXing] || '气';

    const relation = getWuxingRelation(userWuxing, drinkWuXing);
    const phraseBuilder = RELATION_PHRASES[relation];

    return phraseBuilder ? phraseBuilder(drinkEl) : `${drinkEl}调养`;
}

/**
 * 标签3：体感标签 —— "喝起来什么感觉"
 * 
 * 逻辑：
 *   1. 温度 × 质地 → 查 SENSORY_MATRIX 得到基础体感
 *   2. 如果某味觉维度特别突出（超过阈值），用味觉修饰替换
 *   3. 格式统一 "XX·YY"
 *
 * @param {Object} dimensions - 饮品物理维度
 * @returns {string} 如 "清冽·沉降" / "辛香·升提"
 */
function generateSensoryTag(dimensions) {
    if (!dimensions) {
        return '口感待品';
    }

    // --- Step 1: 检查是否有突出味觉 ---
    const taste = dimensions.taste || {};
    let dominantTaste = null;
    let maxExcess = 0; // 超过阈值最多的味觉
    for (const [key, config] of Object.entries(TASTE_MODIFIERS)) {
        const val = taste[key] ?? 0;
        const excess = val - config.threshold;
        if (excess > 0 && excess > maxExcess) {
            maxExcess = excess;
            dominantTaste = config;
        }
    }

    // 如果有非常突出的味觉 (超过阈值2分以上)，直接用味觉标签
    if (dominantTaste && maxExcess >= 2) {
        return `${dominantTaste.word}·${dominantTaste.effect}`;
    }

    // --- Step 2: 温度 × 质地矩阵查找 ---
    const temp = dimensions.temperature?.value ?? 0;
    const txt = dimensions.texture?.value ?? 0;

    const tempKey = temp <= -2 ? 'cold'
        : temp <= 0  ? 'cool'
        : temp <= 1  ? 'neutral'
        : temp <= 3  ? 'warm'
        : 'hot';

    const txtKey = txt < -1 ? 'thin'
        : txt <= 1 ? 'smooth'
        : 'thick';

    const matrixKey = `${tempKey}_${txtKey}`;
    let sensory = SENSORY_MATRIX[matrixKey] || '柔和·平稳';

    // --- Step 3: 如果有轻度突出味觉，用它修饰"·"后半部分 ---
    if (dominantTaste && maxExcess > 0) {
        const parts = sensory.split('·');
        sensory = `${parts[0]}·${dominantTaste.effect}`;
    }

    return sensory;
}

// ============================================================
//  推荐语生成 (本地降级)
// ============================================================

/**
 * 本地推荐语 —— 当 LLM 不可用时的 fallback
 * 
 * 模板：一句自然的中文，结构为
 *   "{状态} → {调理动作} → {饮品怎么实现}"
 * 
 * 好的推荐语示例：
 *   "郁气难舒，这杯金酒用柑橘的辛香替你把闷气散开。"
 *   "兴致正浓，龙舌兰和你一起往上冲。"
 *   "心绪浮躁，一杯冰凉的伏特加汤力帮你沉下来。"
 * 
 * 坏的推荐语示例（v3.0 的问题）：
 *   "「木气偏郁，以纠偏调中，甘甜冰凉之恢复平衡」" ← 机器拼接感
 */
function generateLocalQuote(moodData, patternAnalysis, dimensions, drinkName) {
    // 获取状态描述 (复用 tag1 的逻辑)
    const stateDesc = generateDiagnosisTag(moodData, patternAnalysis);

    // 获取饮品的核心感官特征
    const sensory = describeDrinkCharacter(dimensions);

    // 获取调理方向
    const direction = describeHealingDirection(patternAnalysis);

    // 饮品名称处理
    const name = drinkName || '这杯酒';

    // 根据策略类型选择句式
    const strategyType = patternAnalysis?.strategy?.type;
    const polarity = patternAnalysis?.polarity?.type || 'negative';

    if (polarity === 'positive') {
        // 正向情绪 → 共振句式，不需要"治疗"感
        const positiveTemplates = [
            `${stateDesc}，${name}${sensory}，和你此刻正好合拍。`,
            `${stateDesc}，来一杯${sensory}的${name}，锦上添花。`,
            `此刻${stateDesc}，${name}的${sensory}替你把这份好心情再拉长一点。`,
        ];
        return positiveTemplates[hashSelect(drinkName, positiveTemplates.length)];
    }

    // 负向情绪 → 调理句式
    const negativeTemplates = [
        `${stateDesc}，${name}用${sensory}${direction}。`,
        `${stateDesc}，来一杯${name}，${sensory}${direction}。`,
        `${stateDesc}，让${name}的${sensory}${direction}。`,
    ];
    return negativeTemplates[hashSelect(drinkName, negativeTemplates.length)];
}

/**
 * 描述饮品的核心感官特征（用于推荐语）
 * 输出自然语言片段，如 "柑橘的辛香" / "冰凉的清冽"
 */
function describeDrinkCharacter(dimensions) {
    if (!dimensions) return '独特的风味';

    const parts = [];

    // 温度
    const temp = dimensions.temperature?.value ?? 0;
    if (temp <= -2) parts.push('冰凉');
    else if (temp >= 2) parts.push('温热');

    // 味觉 - 取最突出的
    const taste = dimensions.taste || {};
    const tasteEntries = [
        { key: 'sweet', val: taste.sweet ?? 0, word: '甘甜' },
        { key: 'sour', val: taste.sour ?? 0, word: '微酸' },
        { key: 'bitter', val: taste.bitter ?? 0, word: '微苦' },
        { key: 'spicy', val: taste.spicy ?? 0, word: '辛香' },
    ].sort((a, b) => b.val - a.val);

    if (tasteEntries[0].val >= 3) {
        parts.push(tasteEntries[0].word);
    }

    // 质地
    const txt = dimensions.texture?.value ?? 0;
    if (txt > 1.5) parts.push('醇厚');
    else if (txt < -1.5) parts.push('清冽');

    if (parts.length === 0) return '柔和的口感';
    return parts.join('');
}

/**
 * 描述调理方向（用于推荐语的结尾）
 * 输出动作性短语，如 "替你把闷气散开" / "帮你沉下来"
 */
function describeHealingDirection(patternAnalysis) {
    if (!patternAnalysis) return '帮你找回平衡';

    const strategy = patternAnalysis?.strategy?.type;
    const userWuxing = patternAnalysis?.wuxing?.user || 'earth';

    // 基于用户五行状态 + 策略类型，生成有画面感的调理描述
    const directionMap = {
        // 木 - 郁 → 需要疏散
        wood_correct:   '替你把郁气慢慢散开',
        wood_counter:   '帮你把堵着的情绪冲开',
        wood_resonate:  '和你一起往外舒展',
        wood_harmonize: '轻轻替你松绑',

        // 火 - 躁 → 需要沉降
        fire_correct:   '帮你把浮躁按下来',
        fire_counter:   '替你把虚火泄掉',
        fire_resonate:  '和你的热情一起燃烧',
        fire_harmonize: '替你把火气慢慢收住',

        // 土 - 闷 → 需要激活
        earth_correct:  '替你把沉闷感唤醒',
        earth_counter:  '帮你从倦怠里抽身',
        earth_resonate: '给你踏实的陪伴',
        earth_harmonize:'温温地把你托住',

        // 金 - 悲 → 需要温润
        metal_correct:  '温温地替你把伤感化开',
        metal_counter:  '帮你从低落中抬起头',
        metal_resonate: '陪你安静地待一会',
        metal_harmonize:'轻轻包裹住你的情绪',

        // 水 - 恐/焦 → 需要安定
        water_correct:  '帮你把不安慢慢放下',
        water_counter:  '替你把焦虑的气沉到底',
        water_resonate: '带你往更深处沉静',
        water_harmonize:'帮你稳住此刻的心绪',
    };

    const key = `${userWuxing}_${strategy}`;
    return directionMap[key] || '帮你找回平衡';
}

// ============================================================
//  五行关系判定
// ============================================================

/**
 * 判断用户五行与饮品五行的关系
 * 相生：木→火→土→金→水→木
 * 相克：木→土→水→火→金→木
 */
function getWuxingRelation(userWuxing, drinkWuxing) {
    if (userWuxing === drinkWuxing) return '同';

    const order = ['wood', 'fire', 'earth', 'metal', 'water'];
    const uIdx = order.indexOf(userWuxing);
    const dIdx = order.indexOf(drinkWuxing);

    if (uIdx === -1 || dIdx === -1) return '同';

    // 相生链：wood(0)→fire(1)→earth(2)→metal(3)→water(4)→wood(0)
    if ((uIdx + 1) % 5 === dIdx) return '生';    // 用户生饮品
    if ((dIdx + 1) % 5 === uIdx) return '被生';  // 饮品生用户

    // 相克链：wood(0)→earth(2)→water(4)→fire(1)→metal(3)→wood(0)
    if ((uIdx + 2) % 5 === dIdx) return '克';    // 用户克饮品 (原代码标注有误，已修正)
    if ((dIdx + 2) % 5 === uIdx) return '被克';  // 饮品克用户

    return '同';
}

// ============================================================
//  工具函数
// ============================================================

/**
 * 基于字符串的稳定哈希选择（同一饮品每次选同一模板）
 */
function hashSelect(str, max) {
    if (!str || max <= 0) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % max;
}

// ============================================================
//  核心导出函数
// ============================================================

/**
 * 生成哲学标签与推荐语
 * 
 * @param {Object} dimensions     - 饮品的 8D 物理维度
 * @param {Object} contextData    - 完整上下文 { moodData, patternAnalysis, vectorResult }
 * @param {string} drinkName      - 饮品名称
 * @returns {{
 *   tags: [string, string, string],   // [辨证, 策略, 体感]
 *   quote: string,                     // 本地推荐语
 *   diagnosis: string,                 // 兼容字段
 *   strategy: string,
 *   sensory: string
 * }}
 */
export function generatePhilosophyTags(dimensions, contextData = null, drinkName = '') {
    // 降级：无上下文
    if (!contextData || !dimensions) {
        return {
            tags: ['待辨证', '调和气机', '口感待品'],
            quote: '请先描述你此刻的心情，让我为你找到那杯对的酒。',
            diagnosis: '待辨证',
            strategy: '调和气机',
            sensory: '口感待品',
        };
    }

    const moodData = contextData.moodData || contextData;
    const patternAnalysis = contextData.patternAnalysis;

    // 确定饮品五行
    const drinkWuXing = determineDrinkWuXing(dimensions);

    // 生成三个标签
    const tag1 = generateDiagnosisTag(moodData, patternAnalysis);
    const tag2 = generateStrategyTag(patternAnalysis, drinkWuXing);
    const tag3 = generateSensoryTag(dimensions);

    // 生成本地推荐语
    const quote = generateLocalQuote(moodData, patternAnalysis, dimensions, drinkName);

    return {
        tags: [tag1, tag2, tag3],
        quote,
        diagnosis: tag1,
        strategy: tag2,
        sensory: tag3,
    };
}

// 兼容旧接口
export function generatePhilosophyTagsLegacy(dimensions, moodData = null, drinkName = '') {
    return generatePhilosophyTags(dimensions, moodData, drinkName);
}

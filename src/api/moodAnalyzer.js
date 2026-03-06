/**
 * MoodMix 六维心境分析器 (前端调用层)
 * 
 * 调用 /api/analyze_mood 代理接口，获取大模型六维分析结果。
 * 
 * 六维度:
 *   1. 情绪 (emotion)    → 味觉、颜色
 *   2. 躯体 (somatic)    → 温度、触觉、比例
 *   3. 时间 (time)       → 时序
 *   4. 认知 (cognitive)  → 嗅觉
 *   5. 诉求 (demand)     → 动作
 *   6. 社交/环境 (socialContext) → 动作、比例
 */

// ═══════════════════════════════════════════
// 相关性检测器 — 识别与六维无关的输入
// ═══════════════════════════════════════════

// 与心情/身体/需求相关的关键词
const RELEVANT_KEYWORDS = [
    // 情绪类
    '心情', '情绪', '感觉', '感受', '开心', '快乐', '难过', '伤心', '生气', '愤怒', '烦躁', '焦虑', '压力', '累', '疲惫', '舒服', '不爽', '郁闷', 'emo', '痛苦', '绝望', '无助', '委屈', '想哭', '崩溃',
    // 身体类
    '身体', '头疼', '头晕', '冷', '热', '发烧', '感冒', '胃', '肚子', '饿', '渴', '困', '失眠', '累', '酸痛', '舒服', '难受', '闷', '堵',
    // 需求类
    '想', '要', '需要', '发泄', '放松', '安静', '静一静', '独处', '社交', '聚会', '庆祝', '安慰', '鼓励', '动力', '能量', '清醒', '醉', '微醺',
    // 场景类
    '今天', '刚才', '最近', '工作', '学习', '考试', '加班', '熬夜', '约会', '失恋', '分手', '吵架', '成功', '失败', '胜利', '挫折',
    // 时间类
    '早上', '上午', '中午', '下午', '晚上', '深夜', '凌晨', '半夜', '睡前',
    // 程度词
    '很', '非常', '特别', '有点', '稍微', '太', '超级', '巨', '有点', '好', '真',
];

// 明显无关的关键词模式
const IRRELEVANT_PATTERNS = [
    // 知识性问题
    /什么是|什么是|什么叫|什么是|怎么.*做|如何.*做|为什么.*会|解释.*一下|介绍一下|告诉我.*关于/,
    // 指令/任务
    /帮我.*(订|点|买|查|搜|找)|给我.*(推荐|建议)|打开.*(软件|应用|程序)|设置.*(提醒|闹钟)/,
    // 纯数字 (111, 123, 666)
    /^\d+$/,
    // 纯字母 (abc, xyz)
    /^[a-zA-Z]+$/,
    // 纯特殊字符
    /^[^\u4e00-\u9fa5a-zA-Z0-9]+$/,
    // 天气/新闻/体育
    /天气.*怎么样|今天.*(下雨|晴天|多云)|.*(比赛|比分|赢了|输了)|.*(股票|基金|涨|跌)/,
    // 技术/学术
    /(代码|编程|bug|算法|数据|模型|训练|神经网络|量子|物理|化学|数学).*(问题|怎么|为什么|是什么)/,
];

// 乱码/无意义输入检测模式
const GIBBERISH_PATTERNS = [
    // 纯重复数字 (111, 2222, 66666)
    /^(\d)\1{2,}$/,
    // 纯重复字母 (aaa, hhhh, xxxxx)
    /^([a-z])\1{2,}$/i,
    // 键盘乱序 (asdf, qwer, zxcv)
    /^(asdf|qwer|zxcv|wasd|fdsa|rewq|vcxz|qwerty|asdfgh|zxcvbn)$/i,
    // 无意义重复汉字 (啊啊啊, 哈哈哈, 嘿嘿嘿) - 但"哈哈哈"可能是情绪，需要特殊处理
    /^(啊|哦|嗯|呃|哎|哟|喂){3,}$/,
    // 随机字符组合 (长度3-6且无意义)
    /^[a-z0-9]{1,6}$/i,
];

// 虽然是重复字符但可能是情绪表达的白名单
const EMOTIONAL_REPETITIONS = ['哈哈', '嘿嘿', '呵呵', '呜呜', '啊啊', '呜呜呜', '哈哈哈'];

/**
 * 检测用户输入是否与六维心境分析相关
 * @param {string} input - 用户输入
 * @returns {{isRelevant: boolean, reason: string}} - 是否相关及原因
 */
function checkRelevance(input) {
    if (!input || !input.trim()) {
        return { isRelevant: false, reason: 'empty' };
    }
    
    const text = input.trim();
    const textLower = text.toLowerCase();
    
    console.log('[checkRelevance] Checking input:', text);
    
    // 检查是否匹配明显无关的模式
    for (const pattern of IRRELEVANT_PATTERNS) {
        const matches = pattern.test(textLower);
        if (matches) {
            console.log('[checkRelevance] Matched IRRELEVANT_PATTERN:', pattern);
            return { isRelevant: false, reason: 'irrelevant_pattern' };
        }
    }
    
    // 检查是否为乱码/无意义输入（但排除情绪表达白名单）
    const isEmotionalRepetition = EMOTIONAL_REPETITIONS.some(emo => text.includes(emo));
    console.log('[checkRelevance] isEmotionalRepetition:', isEmotionalRepetition);
    if (!isEmotionalRepetition) {
        for (const pattern of GIBBERISH_PATTERNS) {
            const matches = pattern.test(textLower);
            if (matches) {
                console.log('[checkRelevance] Matched GIBBERISH_PATTERN:', pattern);
                return { isRelevant: false, reason: 'gibberish' };
            }
        }
    }
    
    // 检查是否包含相关关键词
    const hasRelevantKeyword = RELEVANT_KEYWORDS.some(kw => textLower.includes(kw.toLowerCase()));
    console.log('[checkRelevance] hasRelevantKeyword:', hasRelevantKeyword);
    
    if (!hasRelevantKeyword) {
        // 进一步检查：如果输入很长且没有关键词，可能是不相关的叙述
        if (text.length > 20) {
            console.log('[checkRelevance] Long text without keywords');
            return { isRelevant: false, reason: 'no_keywords_long_text' };
        }
        // 短文本但没有关键词，可能是简单的问候或短句
        // 允许通过，让LLM来判断
        console.log('[checkRelevance] Short text without keywords, allowing through');
    }
    
    console.log('[checkRelevance] Input is relevant');
    return { isRelevant: true, reason: 'ok' };
}

/**
 * 获取用户友好的提示消息
 * @param {string} reason - 不相关的原因
 * @returns {string} - 中文提示消息
 */
function getFriendlyMessage(reason) {
    const messages = {
        empty: '请告诉我你此刻的心情或状态，我才能为你推荐合适的饮品～',
        irrelevant_pattern: '这似乎和心情没什么关系呢。可以跟我聊聊你现在的感受吗？比如：开心、累、想放松、或者有点烦躁？',
        no_keywords_long_text: '你说了好多，但我有点没get到重点😅 可以简单说下你现在的心情或身体状态吗？',
        api_error: '抱歉，分析服务暂时不可用。可以直接告诉我你想喝什么类型的饮品，我来帮你推荐！',
        gibberish: '看起来像是乱码呢😅 可以告诉我你现在的心情吗？比如开心、有点累、或者想放松一下？',
    };
    return messages[reason] || messages.irrelevant_pattern;
}

// ═══════════════════════════════════════════
// 默认/降级数据 — API 不可用时的本地推断
// ═══════════════════════════════════════════

const DEFAULT_ANALYSIS = {
    emotion: {
        physical: { state: '平静', intensity: 0.5 },
        philosophy: { wuxing: '土', organ: '脾', 志: '思' },
        drinkMapping: { taste: '甘', tasteScore: 5, color: '黄/暖色', colorCode: 3 }
    },
    somatic: {
        physical: { sensation: '正常', type: 'none', intensity: 0.2 },
        philosophy: { qiState: '通畅', direction: '通畅', yinyang: '阴阳平和' },
        drinkMapping: { temperature: 0, texture: '温润', textureScore: 0 }
    },
    time: {
        physical: { hour: new Date().getHours(), period: getTimePeriod(new Date().getHours()), season: getCurrentSeason(), intensity: 0.5 },
        philosophy: { shichen: getShichen(new Date().getHours()), meridian: '脾经', solarTerm: '雨水' },
        drinkMapping: { temporality: new Date().getHours() }
    },
    cognitive: {
        physical: { mode: '日常思考', clarity: 7, intensity: 0.4 },
        philosophy: { shenState: '神志清明', '归位': true },
        drinkMapping: { aroma: '清淡花香', aromaScore: 4 }
    },
    demand: {
        physical: { desire: '放松', direction: '寻求平衡', intensity: 0.6 },
        philosophy: { ritual: '日常安住', type: '止' },
        drinkMapping: { action: '搅拌(Stir)', actionScore: 2 }
    },
    socialContext: {
        physical: { space: '未知', people: '不明', intensity: 0.3 },
        philosophy: { boundary: '内外调和', needDirection: '内外调和' },
        drinkMapping: { action: '搅拌', actionScore: 2, ratio: '温和中庸', ratioScore: 10 }
    },
    isNegative: false,
    summary: '用户状态平稳，适合一杯温和的饮品'
};

// ═══════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════

/**
 * 调用大模型进行六维心境分析
 * @param {string} userInput - 用户输入的文本
 * @param {object} options - 可选配置
 * @param {number} options.timeout - 超时时间(ms)，默认 45000 (45秒)
 * @param {number} options.maxRetries - 最大重试次数，默认 2
 * @returns {Promise<object>} 六维分析结果
 */
export async function analyzeMood(userInput, options = {}) {
    const { timeout = 60000, maxRetries = 2 } = options;

    // 1. 相关性检测
    const relevanceCheck = checkRelevance(userInput);
    if (!relevanceCheck.isRelevant) {
        console.warn('[MoodAnalyzer] 输入与六维无关:', relevanceCheck.reason);
        return {
            isRelevant: false,
            message: getFriendlyMessage(relevanceCheck.reason),
            reason: relevanceCheck.reason,
        };
    }

    const currentTime = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
    });

    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            console.log('[MoodAnalyzer] Attempting API call, attempt:', attempt + 1);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch('/api/analyze_mood', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_input: userInput.trim(),
                    current_time: currentTime
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success || !result.data) {
                console.error('[MoodAnalyzer] API returned error:', result.error);
                throw new Error(result.error || '返回数据格式异常');
            }

            // 校验并合并默认值（确保所有维度都有数据）
            const validated = validateAndMerge(result.data);

            console.log('[MoodAnalyzer] 六维分析完成:', validated.summary);
            return validated;

        } catch (error) {
            attempt++;
            console.error('[MoodAnalyzer] Error details:', error.name, error.message);
            if (error.name === 'AbortError') {
                console.warn('[MoodAnalyzer] 分析超时，直接使用本地降级方案');
                // 前端已经决定的硬超时，不进行重试，或者可以设定为重试1次
                break;
            } else {
                console.error(`[MoodAnalyzer] 分析失败 (尝试 ${attempt}/${maxRetries + 1}):`, error.message);
                if (attempt <= maxRetries) {
                    const retryDelay = attempt * 1000;
                    console.log(`[MoodAnalyzer] 等待 ${retryDelay}ms 后进行重试...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
            }
        }
    }

    // 所有尝试或超时都失败后，返回用户友好的错误提示
    console.warn('[MoodAnalyzer] API调用失败，返回友好提示');
    return {
        isRelevant: true,
        apiError: true,
        message: getFriendlyMessage('api_error'),
        fallbackData: { ...DEFAULT_ANALYSIS },
    };
}

// ═══════════════════════════════════════════
// 数据校验与合并
// ═══════════════════════════════════════════

/**
 * 校验大模型返回的结构，缺失字段用默认值填充
 */
function validateAndMerge(data) {
    const merged = { ...DEFAULT_ANALYSIS };

    const dimensions = ['emotion', 'somatic', 'time', 'cognitive', 'demand', 'socialContext'];

    for (const dim of dimensions) {
        if (data[dim]) {
            merged[dim] = {
                physical: { ...DEFAULT_ANALYSIS[dim].physical, ...(data[dim].physical || {}) },
                philosophy: { ...DEFAULT_ANALYSIS[dim].philosophy, ...(data[dim].philosophy || {}) },
                drinkMapping: { ...DEFAULT_ANALYSIS[dim].drinkMapping, ...(data[dim].drinkMapping || {}) }
            };
        }
    }

    // 顶层字段
    if (typeof data.isNegative === 'boolean') {
        merged.isNegative = data.isNegative;
    }
    if (data.summary) {
        merged.summary = data.summary;
    }

    return merged;
}

// ═══════════════════════════════════════════
// 本地降级分析
// ═══════════════════════════════════════════

/**
 * API 不可用时的本地关键词分析
 * 提供基础维度推断，精度远低于大模型
 */
function localFallbackAnalysis(input) {
    const result = JSON.parse(JSON.stringify(DEFAULT_ANALYSIS));
    const text = input.toLowerCase();

    // ─── 情绪维度 本地推断 ───
    const emotionMap = [
        { keywords: ['怒', '气死', '烦死', '暴怒', '愤怒', '生气'], wuxing: '木', organ: '肝', 志: '怒', taste: '酸', colorCode: 1, intensity: 0.8 },
        { keywords: ['开心', '高兴', '快乐', '兴奋', '狂喜', '嗨', '爽'], wuxing: '火', organ: '心', 志: '喜', taste: '苦', colorCode: 2, intensity: 0.7 },
        { keywords: ['想', '思念', '纠结', '犹豫', '迷茫', '焦虑'], wuxing: '土', organ: '脾', 志: '思', taste: '甘', colorCode: 3, intensity: 0.6 },
        { keywords: ['悲', '伤心', '难过', '委屈', '想哭', '心酸', '失落'], wuxing: '金', organ: '肺', 志: '悲', taste: '辛', colorCode: 4, intensity: 0.7 },
        { keywords: ['怕', '恐惧', '害怕', '担心', '不安', '慌'], wuxing: '水', organ: '肾', 志: '恐', taste: '咸', colorCode: 5, intensity: 0.6 },
    ];

    for (const emo of emotionMap) {
        if (emo.keywords.some(kw => text.includes(kw))) {
            result.emotion.physical.state = emo.志;
            result.emotion.physical.intensity = emo.intensity;
            result.emotion.philosophy = { wuxing: emo.wuxing, organ: emo.organ, 志: emo.志 };
            result.emotion.drinkMapping.taste = emo.taste;
            result.emotion.drinkMapping.colorCode = emo.colorCode;
            break;
        }
    }

    // ─── 负面情绪检测 ───
    const negativeKeywords = ['慢', '累', '烦', '难', '压力', 'emo', '不开心', '糟', '委屈', '失败', '想哭', '崩溃', '绝望', '无助', '痛苦'];
    result.isNegative = negativeKeywords.some(kw => text.includes(kw));

    // ─── 躯体维度 ───
    if (text.includes('冷') || text.includes('寒')) {
        result.somatic.physical.intensity = 0.8;
        result.somatic.philosophy.yinyang = '偏阴';
        result.somatic.drinkMapping.temperature = 3; // 需要温热
        result.somatic.drinkMapping.texture = '温润';
    } else if (text.includes('热') || text.includes('燥') || text.includes('上火')) {
        result.somatic.physical.intensity = 0.8;
        result.somatic.philosophy.yinyang = '偏阳';
        result.somatic.drinkMapping.temperature = -3; // 需要清凉
        result.somatic.drinkMapping.texture = '清冽';
    }
    if (text.includes('闷') || text.includes('堵') || text.includes('透不过气')) {
        result.somatic.physical.intensity = 0.9;
        result.somatic.philosophy.qiState = '郁结';
        result.somatic.drinkMapping.texture = '气泡';
        result.somatic.drinkMapping.textureScore = 2;
    }

    // ─── 时间维度 ───
    const hour = new Date().getHours();
    result.time.physical.hour = hour;
    result.time.physical.period = getTimePeriod(hour);
    result.time.philosophy.shichen = getShichen(hour);
    result.time.drinkMapping.temporality = hour;

    // 用户提及时间覆盖
    if (text.includes('早上') || text.includes('早晨')) {
        result.time.physical.hour = 8;
        result.time.drinkMapping.temporality = 8;
    } else if (text.includes('中午')) {
        result.time.physical.hour = 12;
        result.time.drinkMapping.temporality = 12;
    } else if (text.includes('晚上') || text.includes('今晚')) {
        result.time.physical.hour = 20;
        result.time.drinkMapping.temporality = 20;
    } else if (text.includes('深夜') || text.includes('凌晨')) {
        result.time.physical.hour = 2;
        result.time.drinkMapping.temporality = 2;
    }

    // ─── 诉求维度 ───
    if (text.includes('发泄') || text.includes('砸') || text.includes('释放') || text.includes('破')) {
        result.demand.physical.intensity = 0.9;
        result.demand.philosophy.type = '破';
        result.demand.drinkMapping.action = '捣(Muddling)';
        result.demand.drinkMapping.actionScore = 4;
    } else if (text.includes('安静') || text.includes('静静') || text.includes('独处') || text.includes('平静')) {
        result.demand.physical.intensity = 0.7;
        result.demand.philosophy.type = '止';
        result.demand.drinkMapping.action = '啜饮(Sip)';
        result.demand.drinkMapping.actionScore = 1;
    } else if (text.includes('动力') || text.includes('冲') || text.includes('嗨') || text.includes('社交')) {
        result.demand.physical.intensity = 0.8;
        result.demand.philosophy.type = '动';
        result.demand.drinkMapping.action = '摇晃(Shake)';
        result.demand.drinkMapping.actionScore = 3;
    }

    // ─── 社交/环境维度 ───
    if (text.includes('一个人') || text.includes('独处') || text.includes('独自') || text.includes('空荡')) {
        result.socialContext.physical.people = '独处';
        result.socialContext.philosophy.boundary = '极阴';
        result.socialContext.philosophy.needDirection = '纳气归根';
        result.socialContext.drinkMapping.actionScore = 1;
    } else if (text.includes('朋友') || text.includes('聚会') || text.includes('派对') || text.includes('大家')) {
        result.socialContext.physical.people = '小聚';
        result.socialContext.philosophy.boundary = '外向宣发';
        result.socialContext.philosophy.needDirection = '顺势宣发';
        result.socialContext.drinkMapping.actionScore = 4;
    }

    result.summary = `[本地推断] ${result.emotion.physical.state}，${result.demand.philosophy.type === '破' ? '需要释放' : result.demand.philosophy.type === '止' ? '需要安宁' : '状态平稳'}`;

    return result;
}

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

function getTimePeriod(hour) {
    if (hour >= 5 && hour < 8) return '清晨';
    if (hour >= 8 && hour < 11) return '上午';
    if (hour >= 11 && hour < 14) return '中午';
    if (hour >= 14 && hour < 17) return '下午';
    if (hour >= 17 && hour < 19) return '傍晚';
    if (hour >= 19 && hour < 23) return '晚上';
    return '深夜';
}

function getShichen(hour) {
    const shichenMap = [
        '子时', '子时', '丑时', '丑时', '寅时', '寅时',
        '卯时', '卯时', '辰时', '辰时', '巳时', '巳时',
        '午时', '午时', '未时', '未时', '申时', '申时',
        '酉时', '酉时', '戌时', '戌时', '亥时', '亥时'
    ];
    return shichenMap[hour] || '未知';
}

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return '春';
    if (month >= 6 && month <= 8) return '夏';
    if (month >= 9 && month <= 11) return '秋';
    return '冬';
}

// 导出
export default analyzeMood;
export { DEFAULT_ANALYSIS, localFallbackAnalysis };

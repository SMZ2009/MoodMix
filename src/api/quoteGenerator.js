import { generatePhilosophyTags } from '../engine/philosophyTags';

// 内存缓存字典，防止短时间重复查重
let inMemoryQuoteCache = null;

const CACHE_KEY = 'moodmix_ai_quotes_cache';

/**
 * 获取或初始化本地持久化缓存
 */
function getQuoteCache() {
    if (inMemoryQuoteCache) return inMemoryQuoteCache;

    try {
        const stored = localStorage.getItem(CACHE_KEY);
        inMemoryQuoteCache = stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.warn('Failed to read quote cache from localStorage:', e);
        inMemoryQuoteCache = {};
    }
    return inMemoryQuoteCache;
}

/**
 * 保存到本地持久化缓存
 */
function saveQuoteCache() {
    if (!inMemoryQuoteCache) return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(inMemoryQuoteCache));
    } catch (e) {
        console.warn('Failed to write quote cache to localStorage:', e);
    }
}

/**
 * 生成缓存的唯一键值： 比如 "Mojito_木生火_abc123"
 * 添加随机后缀使每次请求都生成新的推荐语
 * 可选：使用 session 模式可以控制是否复用（传入 fixedSessionId 则同 session 内复用）
 */
function generateCacheKey(drinkName, wuxingLogic, fixedSessionId = null) {
    if (!drinkName || !wuxingLogic) return null;
    // 如果有固定 session ID，则同 session 内复用；否则每次生成新的
    const randomSuffix = fixedSessionId || Math.random().toString(36).substring(2, 8);
    return `${drinkName.trim()}_${wuxingLogic.trim()}_${randomSuffix}`;
}

/**
 * 批量异步生成饮品的专属 LLM 推荐语
 * @param {Array} drinksList - 当前滑轨池里的 Top 饮品列表
 * @param {Object} contextData - 完整上下文数据 (包含 moodData, patternAnalysis, vectorResult)
 * @param {number} batchSize - 批量大小
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Promise<Object>} 返回一个 Map: { drinkId: "「量身定做的短诗...」" }
 */
export async function fetchLiveQuotes(drinksList, contextData, batchSize = 15, forceRefresh = true) {
    if (!drinksList || drinksList.length === 0) return {};

    const cache = getQuoteCache();
    const resultQuotes = {};
    const unachedItems = [];

    // 生成本次请求的随机种子，确保每次都不一样
    const requestSeed = Math.random().toString(36).substring(2, 10);

    // 1. 本地缓存碰撞测试 & 构造 Batch Request
    const targetDrinks = drinksList.slice(0, batchSize);

    targetDrinks.forEach(drink => {
        // 使用新版本的 generatePhilosophyTags，传入完整上下文
        const philosophyResult = generatePhilosophyTags(drink.dimensions, contextData, drink.name);

        // 获取三个标签
        const diagnosisTag = philosophyResult.tags[0] || '气机失调';  // 辨证
        const strategyTag = philosophyResult.tags[1] || '调理中';       // 策略
        const sensoryTag = philosophyResult.tags[2] || '口感平衡';        // 体感

        // 构建更丰富的上下文包，透传给大模型
        const contextPackage = {
            userState: diagnosisTag,
            strategy: strategyTag,
            drinkProfile: buildDrinkProfile(drink),
            sensory: sensoryTag,
            matchReason: generateMatchReason(contextData, drink),
            // 新增：透传原始五行和策略 Key，方便模型匹配意象
            userWuxing: contextData.patternAnalysis?.wuxing?.user || 'earth',
            strategyType: contextData.patternAnalysis?.strategy?.type || 'balance',
            moodSummary: contextData.moodData?.summary || ''
        };

        // 用标签和原始五行作为缓存关键特征
        const logicHash = `${diagnosisTag}_${strategyTag}_${contextPackage.userWuxing}`;

        // forceRefresh=true 时使用新的随机 key
        const key = forceRefresh
            ? generateCacheKey(drink.name || drink.nameEn, logicHash, requestSeed + '_' + drink.id)
            : generateCacheKey(drink.name || drink.nameEn, logicHash, null);

        if (!forceRefresh && key && cache[key]) {
            resultQuotes[drink.id] = cache[key];
        } else {
            unachedItems.push({
                id: drink.id,
                name: drink.name || drink.nameEn,
                contextPackage: contextPackage,
                diagnosis: diagnosisTag,
                strategy: strategyTag,
                sensory: sensoryTag,
                userWuxing: contextPackage.userWuxing,
                strategyType: contextPackage.strategyType,
                cacheKey: key,
                requestSeed: requestSeed
            });
        }
    });

    // 如果全部命中缓存，直接返回
    if (unachedItems.length === 0) {
        console.log('[QuoteGenerator] ⚡ 100% 缓存命中，无需请求 LLM。');
        return resultQuotes;
    }

    console.log(`[QuoteGenerator] 🧠 需要请求 LLM 的饮品数量: ${unachedItems.length}`);
    console.log('[QuoteGenerator] 📤 发送的items数据:', JSON.stringify(unachedItems, null, 2));

    /**
     * 构建饮品的核心物理特征描述
     */
    function buildDrinkProfile(drink) {
        if (!drink || !drink.dimensions) return '口感平衡';

        const { taste, temperature, texture, aroma } = drink.dimensions;
        const parts = [];

        // 味觉
        if (taste) {
            if (taste.sour > 3) parts.push('酸爽');
            else if (taste.sweet > 4) parts.push('甘甜');
            else if (taste.bitter > 3) parts.push('微苦');
            else if (taste.spicy > 2) parts.push('辛香');
            else if (taste.umami > 3) parts.push('鲜醇');
        }

        // 温度
        const temp = temperature?.value || 0;
        if (temp > 2) parts.push('温热');
        else if (temp < -2) parts.push('冰凉');

        // 质地
        if (texture) {
            if (texture.value > 1) parts.push('绵密');
            else if (texture.value < -1) parts.push('清透');
        }

        // 香气
        const aromaVal = aroma?.value || aroma || 0;
        if (aromaVal > 7) parts.push('馥郁');
        else if (aromaVal > 4) parts.push('清香');

        return parts.length > 0 ? parts.join('，') : '口感平衡';
    }

    /**
     * 生成匹配原因描述
     */
    function generateMatchReason(contextData, drink) {
        if (!contextData || !contextData.vectorResult) {
            return '综合匹配';
        }

        const { targetVector, weights } = contextData.vectorResult;
        if (!targetVector || !weights) return '综合匹配';

        // 找出权重最高的维度
        const dimensions = ['味觉', '质地', '温度', '颜色', '时序', '嗅觉', '酒精度', '动作'];
        const maxWeightIdx = weights.indexOf(Math.max(...weights));

        const highWeightDim = dimensions[maxWeightIdx] || '综合';
        return `在${highWeightDim}维度匹配度最高`;
    }

    console.log(`[QuoteGenerator] 🧠 存在 ${unachedItems.length} 杯酒需要请求 LLM 灵感...`);

    // 2. 发送给后端 Proxy 进行批量生成
    try {
        const response = await fetch('/api/generate_quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: unachedItems,
                variation: {
                    seed: requestSeed,
                    style: 'causal_narrative',
                    length: 'medium'
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        // 3. 将结果写回缓存并合并到返回集
        if (data.quotes && typeof data.quotes === 'object') {
            unachedItems.forEach(item => {
                const generatedQuote = data.quotes[item.id];
                if (generatedQuote) {
                    // 补齐符号格式
                    const finalStr = generatedQuote.startsWith('「') ? generatedQuote : `「${generatedQuote}」`;

                    // 合并结果
                    resultQuotes[item.id] = finalStr;

                    // 永久存入哈希库
                    if (item.cacheKey) {
                        cache[item.cacheKey] = finalStr;
                    }
                }
            });
            saveQuoteCache(); // 刷盘
        }

    } catch (err) {
        console.error('[QuoteGenerator] ❌ 异步文案生成失败，安全降级。', err);
        // 发生任何网络错误，返回空，让前端安静地沿用骨架本地词库即可，用户无感知。
    }

    return resultQuotes;
}

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
 * @param {Array} drinksList - 当前滑轨池里的 Top 饮品列表 (默认只取前几张防止过度消耗)
 * @param {Object} moodData - 原始情绪数据 (用于提炼 UserQi)
 * @param {number} batchSize - 批量大小
 * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存，重新生成）
 * @returns {Promise<Object>} 返回一个 Map: { drinkId: "「量身定做的短诗...」" }
 */
export async function fetchLiveQuotes(drinksList, moodData, batchSize = 15, forceRefresh = false) {
    if (!drinksList || drinksList.length === 0) return {};

    const cache = getQuoteCache();
    const resultQuotes = {};
    const unachedItems = [];
    
    // 生成本次请求的随机种子，确保每次都不一样
    const requestSeed = Math.random().toString(36).substring(2, 10);

    // 1. 本地缓存碰撞测试 & 构造 Batch Request
    const targetDrinks = drinksList.slice(0, batchSize);

    targetDrinks.forEach(drink => {
        // 利用刚刚写的 philosophyTags 获取它客观的五行属性和关系描述
        const hashResult = generatePhilosophyTags(drink.dimensions, moodData, drink.name);
        const logicHash = hashResult.tags[1]; // e.g. "相生 · 相养"
        
        // 提取五行关系用于提示词
        const wuxingRelation = hashResult.tags[1]?.replace(/ · /g, '') || '相生';

        // forceRefresh=true 时使用新的随机 key，否则尝试查找已有缓存
        const key = forceRefresh 
            ? generateCacheKey(drink.name || drink.nameEn, logicHash, requestSeed + '_' + drink.id)
            : generateCacheKey(drink.name || drink.nameEn, logicHash, null);

        if (!forceRefresh && key && cache[key]) {
            // 缓存命中！0 毫秒 0 Token 成本
            resultQuotes[drink.id] = cache[key];
        } else {
            // 放入待推演队列
            unachedItems.push({
                id: drink.id,
                name: drink.name || drink.nameEn,
                wuxingLogic: logicHash,
                wuxingRelation: wuxingRelation,
                cacheKey: key,
                requestSeed: requestSeed // 传递给后端确保每次生成不同
            });
        }
    });

    // 如果全部命中缓存，直接返回！
    if (unachedItems.length === 0) {
        console.log('[QuoteGenerator] ⚡ 100% 缓存命中，无需请求 LLM。');
        return resultQuotes;
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
                    style: 'poetic_minimalist',
                    length: 'short' // 8-12 characters
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

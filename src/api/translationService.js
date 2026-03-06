/**
 * 翻译服务：使用 MyMemory 免费 API 翻译制作步骤
 * 翻译结果缓存到 localStorage，避免重复请求
 */

const CACHE_KEY = 'moodmix_translation_cache';
const API_URL = 'https://api.mymemory.translated.net/get';

/**
 * 从 localStorage 读取翻译缓存
 */
function getCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/**
 * 写入翻译缓存
 */
function setCache(cache) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // localStorage 满了就忽略
    }
}

/**
 * 简单的英中词汇映射（用于API失败时的降级翻译）
 */
const SIMPLE_DICTIONARY = {
    // 动作
    'pour': '倒入', 'add': '加入', 'mix': '混合', 'shake': '摇匀', 'stir': '搅拌',
    'blend': '搅打', 'muddle': '捣压', 'strain': '滤出', 'serve': '盛装',
    'garnish': '装饰', 'fill': '加满', 'top': '补满', 'float': '漂浮',
    'layer': '分层', 'rim': '挂边', 'chill': '冰镇', 'heat': '加热',
    // 器具
    'glass': '杯', 'shaker': '摇酒壶', 'strainer': '滤冰器', 'jigger': '量酒器',
    'spoon': '吧勺', 'muddler': '捣棒', 'blender': '搅拌机',
    // 状态
    'cold': '冰的', 'hot': '热的', 'warm': '温的', 'frozen': '冰冻的',
    'fresh': '新鲜的', 'crushed': '碎', 'cubed': '方块',
    // 其他
    'with': '用', 'into': '入', 'over': '上', 'in': '在', 'on': '上',
    'and': '和', 'or': '或', 'then': '然后', 'before': '之前', 'after': '之后',
};

/**
 * 简单的降级翻译（词汇替换）
 */
function simpleTranslate(text) {
    let result = text;
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(word => {
        if (SIMPLE_DICTIONARY[word]) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            result = result.replace(regex, SIMPLE_DICTIONARY[word]);
        }
    });
    return result;
}

/**
 * 调用 MyMemory API 翻译单段文本
 * @param {string} text 英文文本
 * @returns {string} 中文翻译
 */
export async function translateText(text) {
    if (!text || text.trim() === '') return text;
    
    // 如果已经是中文（包含中文字符），直接返回
    if (/[\u4e00-\u9fa5]/.test(text)) {
        return text;
    }

    // 检查缓存
    const cache = getCache();
    const cacheKey = text.trim().toLowerCase();
    if (cache[cacheKey]) {
        return cache[cacheKey];
    }

    try {
        const url = `${API_URL}?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Translation API Error: ${response.status}`);

        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            const translated = data.responseData.translatedText;
            // 检查翻译结果是否有效（不是英文原文）
            if (!translated || translated.toLowerCase() === text.toLowerCase()) {
                // API 返回了原文，使用降级翻译
                const fallback = simpleTranslate(text);
                cache[cacheKey] = fallback;
                setCache(cache);
                return fallback;
            }
            // 写入缓存
            cache[cacheKey] = translated;
            setCache(cache);
            return translated;
        }
        // API 返回异常，使用降级翻译
        const fallback = simpleTranslate(text);
        cache[cacheKey] = fallback;
        setCache(cache);
        return fallback;
    } catch (err) {
        console.warn('Translation failed, using fallback:', err.message);
        // 网络错误使用降级翻译
        const fallback = simpleTranslate(text);
        cache[cacheKey] = fallback;
        setCache(cache);
        return fallback;
    }
}

/**
 * 批量翻译制作步骤
 * 将多个步骤合并为一段文本翻译，然后拆分回来（减少 API 调用次数）
 * @param {Array<{title: string, desc: string}>} steps 步骤列表
 * @returns {Array<{title: string, desc: string}>} 翻译后的步骤
 */
export async function translateSteps(steps) {
    if (!steps || steps.length === 0) return steps;

    // 检查是否已经全部缓存
    const cache = getCache();
    const allCached = steps.every(s => cache[s.desc.trim().toLowerCase()]);
    if (allCached) {
        return steps.map((s, idx) => ({
            title: `步骤 ${idx + 1}`,
            desc: cache[s.desc.trim().toLowerCase()] || s.desc,
        }));
    }

    // 用分隔符拼接所有步骤，一次翻译
    const SEPARATOR = ' ||| ';
    const combined = steps.map(s => s.desc).join(SEPARATOR);

    try {
        const translated = await translateText(combined);
        // 按分隔符拆分回来
        const parts = translated.split(/\s*\|\|\|\s*/);

        return steps.map((s, idx) => {
            const translatedDesc = parts[idx] || s.desc;
            // 缓存每个单独步骤
            const cacheKey = s.desc.trim().toLowerCase();
            cache[cacheKey] = translatedDesc;
            return {
                title: `步骤 ${idx + 1}`,
                desc: translatedDesc,
            };
        });
    } catch {
        // 降级：逐条翻译
        const results = [];
        for (const step of steps) {
            const translated = await translateText(step.desc);
            results.push({
                title: `步骤 ${results.length + 1}`,
                desc: translated,
            });
        }
        setCache(cache);
        return results;
    }
}

/**
 * 翻译单个饮品的制作步骤（带缓存检查）
 * @param {Object} drink 饮品对象
 * @returns {Object} 步骤已翻译的饮品对象
 */
export async function translateDrinkSteps(drink) {
    if (!drink || !drink.steps) return drink;

    const translatedSteps = await translateSteps(drink.steps);
    return {
        ...drink,
        steps: translatedSteps,
    };
}

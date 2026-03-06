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
 * 调用 MyMemory API 翻译单段文本
 * @param {string} text 英文文本
 * @returns {string} 中文翻译
 */
export async function translateText(text) {
    if (!text || text.trim() === '') return text;

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
            // 写入缓存
            cache[cacheKey] = translated;
            setCache(cache);
            return translated;
        }
        return text; // 翻译失败返回原文
    } catch (err) {
        console.warn('Translation failed:', err.message);
        return text; // 网络错误返回原文
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

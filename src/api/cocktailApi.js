/**
 * TheCocktailDB API Service
 * 封装所有 API 调用和数据转换逻辑
 */

import { translateDrinkName, translateIngredient } from '../data/translations';
import { computeDimensions } from '../engine/dimensionEngine';

const BASE_URL = 'https://www.thecocktaildb.com/api/json/v1/1';

// ─── 分类体系（11类） ───────────────────────────
const CATEGORIES = [
    { value: 'all', label: '全部' },
    { value: 'Cocktail', label: '鸡尾酒' },
    { value: 'Ordinary Drink', label: '烈酒' },
    { value: 'Beer', label: '啤酒' },
    { value: 'Wine', label: '葡萄酒' },
    { value: 'Liqueur', label: '利口酒' },
    { value: 'Coffee', label: '咖啡' },
    { value: 'Tea', label: '茶' },
    { value: 'Dairy', label: '乳制品' },
    { value: 'Juice', label: '果汁' },
    { value: 'Soft Drink', label: '软饮' },
];

/**
 * 智能分类函数 — 根据 API 原始分类 + 配料关键词分析
 * 确保每种饮品都有对应类别
 */
function classifyDrink(apiDrink) {
    const apiCat = (apiDrink.strCategory || '').toLowerCase();
    const alcoholic = (apiDrink.strAlcoholic || '').toLowerCase();

    // 收集所有配料（小写）
    const ings = [];
    for (let i = 1; i <= 15; i++) {
        const ing = apiDrink[`strIngredient${i}`];
        if (ing && ing.trim()) ings.push(ing.trim().toLowerCase());
    }
    // ingStr 备用

    // 关键词检测
    const hasCoffee = ings.some(i => /coffee|espresso|kahlua|kahlúa/.test(i));
    const hasTea = ings.some(i => /\btea\b/.test(i));
    const hasDairy = ings.some(i => /milk|cream|yogurt|ice-cream|ice cream|half-and-half|egg/.test(i));
    const hasBeer = ings.some(i => /\bbeer\b|\bale\b|\bstout\b|\blager\b|guinness/.test(i));
    const hasWine = ings.some(i => /\bwine\b|champagne|prosecco|sherry|port\b|vermouth/.test(i));
    const hasJuice = ings.some(i => /juice/.test(i));
    const hasSpirit = ings.some(i => /vodka|gin\b|rum\b|\bwhiskey|\bwhisky|bourbon|brandy|cognac|scotch|absinthe|mezcal|tequila|pisco|cachaca|cachaça|soju|sake/.test(i));
    const hasLiqueur = ings.some(i => /liqueur|amaretto|cointreau|triple sec|curacao|curaçao|chartreuse|benedictine|drambuie|frangelico|galliano|sambuca|schnapps|campari|aperol|midori|chambord|st\. germain|elderflower|grenadine|falernum|limoncello|sloe gin|pimm/.test(i));
    const hasSoda = ings.some(i => /soda|tonic|cola|coca-cola|sprite|7-up|ginger ale|ginger beer|lemonade|carbonated|dr\. pepper/.test(i));

    // ─── 分类优先级 ───

    // 1. 咖啡
    if (hasCoffee) return 'Coffee';

    // 2. 茶
    if (hasTea && !hasCoffee) return 'Tea';

    // 3. 乳制品
    if (hasDairy) return 'Dairy';

    // 4. 果汁
    if (hasJuice && !hasSpirit && !hasLiqueur) return 'Juice';

    // 5. 啤酒
    if (apiCat === 'beer' || (hasBeer && !hasSpirit && !hasLiqueur)) return 'Beer';

    // 6. 葡萄酒
    if (hasWine && !hasSpirit) return 'Wine';

    // 7. 利口酒
    if (hasLiqueur && !hasSpirit) return 'Liqueur';

    // 8. 烈酒（配料极简：纯饮或加冰/少量调味）
    if (hasSpirit && ings.length <= 3 && !hasJuice && !hasSoda && !hasDairy && !hasLiqueur) return 'Ordinary Drink';
    if (apiCat === 'ordinary drink' && ings.length <= 3) return 'Ordinary Drink';

    // 9. 软饮
    if (apiCat === 'soft drink' || hasSoda) return 'Soft Drink';

    // 10. 鸡尾酒（含烈酒的混合饮品）
    if (hasSpirit) return 'Cocktail';

    // 11. 兜底
    return 'Soft Drink';
}

// 酒精类型中文映射
const ALCOHOLIC_MAP = {
    'Alcoholic': '含酒精',
    'Non alcoholic': '无酒精',
    'Optional alcohol': '可选酒精',
};

// 配料图标映射（根据关键词自动分配）
function getIngredientIcon(name) {
    if (!name) return 'GlassWater';
    const n = name.toLowerCase();
    if (/rum|vodka|gin|tequila|whiskey|whisky|bourbon|brandy|scotch|cognac|wine|beer|ale|stout|champagne|liqueur|vermouth|campari|aperol|absinthe|schnapps/.test(n)) return 'Wine';
    if (/juice|lime|lemon|orange|grapefruit|cranberry|pineapple|apple|grape|cherry|watermelon/.test(n)) return 'Droplets';
    if (/ice/.test(n)) return 'ThermometerSnowflake';
    if (/syrup|sugar|honey|grenadine/.test(n)) return 'Droplets';
    return 'GlassWater';
}

// ═══════════════════════════════════════════
// 单位转换工具 — 将外国单位转换为中文常用单位
// ═══════════════════════════════════════════

const UNIT_CONVERSIONS = {
    // 体积单位
    'oz': { unit: '毫升', factor: 29.57, round: true },
    'ounce': { unit: '毫升', factor: 29.57, round: true },
    'cl': { unit: '毫升', factor: 10, round: true },
    'ml': { unit: '毫升', factor: 1, round: false },
    'shot': { unit: '毫升', factor: 44, round: true },
    'jigger': { unit: '毫升', factor: 44, round: true },
    'cup': { unit: '毫升', factor: 240, round: true },
    'pint': { unit: '毫升', factor: 473, round: true },
    'quart': { unit: '毫升', factor: 946, round: true },
    'l': { unit: '毫升', factor: 1000, round: false },
    'liter': { unit: '毫升', factor: 1000, round: false },
    'tsp': { unit: '茶匙', factor: 1, round: false },
    'teaspoon': { unit: '茶匙', factor: 1, round: false },
    'tbsp': { unit: '汤匙', factor: 1, round: false },
    'tablespoon': { unit: '汤匙', factor: 1, round: false },
    'dash': { unit: '滴', factor: 1, round: false },
    'splash': { unit: '少许', factor: 1, round: false },
    'drop': { unit: '滴', factor: 1, round: false },
    'pinch': { unit: '撮', factor: 1, round: false },
    // 重量单位
    'g': { unit: '克', factor: 1, round: false },
    'gram': { unit: '克', factor: 1, round: false },
    'kg': { unit: '克', factor: 1000, round: false },
    'lb': { unit: '克', factor: 453.6, round: true },
    'pound': { unit: '克', factor: 453.6, round: true },
    // 数量单位
    'piece': { unit: '片', factor: 1, round: false },
    'slice': { unit: '片', factor: 1, round: false },
    'wedge': { unit: '角', factor: 1, round: false },
    'leaf': { unit: '片', factor: 1, round: false },
    'leaves': { unit: '片', factor: 1, round: false },
    'sprig': { unit: '枝', factor: 1, round: false },
    'whole': { unit: '个', factor: 1, round: false },
    'part': { unit: '份', factor: 1, round: false },
};

/**
 * 解析并转换计量单位
 * @param {string} measure - 原始计量字符串，如 "1 1/2 oz" 
 * @returns {{amount: string, unit: string}} - 转换后的中文计量
 */
function convertMeasureToChinese(measure) {
    if (!measure || !measure.trim()) {
        return { amount: '适量', unit: '' };
    }
    
    const s = measure.trim().toLowerCase();
    
    // 检测单位
    let detectedUnit = null;
    for (const [key, config] of Object.entries(UNIT_CONVERSIONS)) {
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(s)) {
            detectedUnit = config;
            break;
        }
    }
    
    // 提取数值（支持分数如 1 1/2, 3/4）
    const numMatch = s.match(/^([\d\s/½¼¾⅓⅔⅛.]+)/);
    if (!numMatch) {
        // 无法解析数值，返回原文
        return { amount: measure.trim(), unit: '' };
    }
    
    const numStr = numMatch[1].trim();
    let num = parseFraction(numStr);
    
    if (!detectedUnit) {
        // 未检测到已知单位，返回原文
        return { amount: numStr, unit: '' };
    }
    
    // 计算转换后的数值
    let converted = num * detectedUnit.factor;
    
    // 根据配置决定是否取整
    if (detectedUnit.round) {
        converted = Math.round(converted);
    } else {
        // 保留1位小数，如果是整数则显示整数
        converted = Math.round(converted * 10) / 10;
    }
    
    // 格式化输出
    const amountStr = converted % 1 === 0 ? String(converted) : converted.toFixed(1);
    
    return {
        amount: amountStr,
        unit: detectedUnit.unit
    };
}

/**
 * 解析分数字符串
 */
function parseFraction(str) {
    str = str.trim();
    // 处理 unicode 分数
    const unicodeFracs = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667, '⅛': 0.125 };
    for (const [ch, val] of Object.entries(unicodeFracs)) {
        if (str.includes(ch)) {
            const before = str.replace(ch, '').trim();
            return (before ? parseFloat(before) : 0) + val;
        }
    }
    // "1 1/2" format
    const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    // "1/2" format
    const fracMatch = str.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    // plain number
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/**
 * 将 API 原始数据转换为项目内部格式
 */
function transformDrink(apiDrink) {
    if (!apiDrink) return null;

    // 解析配料（API 最多15个配料字段）— 应用字典翻译 + 单位转换
    const ingredients = [];
    for (let i = 1; i <= 15; i++) {
        const name = apiDrink[`strIngredient${i}`];
        if (!name || name.trim() === '') break;
        const measure = apiDrink[`strMeasure${i}`] || '';
        const nameCn = translateIngredient(name.trim());
        // 转换计量单位为中文
        const { amount, unit } = convertMeasureToChinese(measure);
        ingredients.push({
            id: String(i),
            name: nameCn, // 中文优先
            nameEn: name.trim(), // 保留英文原名
            amount: amount,
            unit: unit,
            icon: getIngredientIcon(name),
        });
    }

    // 解析制作步骤 — 将长文本按句号拆分为步骤列表（后续由 translationService 翻译）
    const instructionText = apiDrink.strInstructions || '';
    const steps = instructionText
        .split(/(?<=[.!?。！？])\s*/)
        .filter(s => s.trim().length > 0)
        .map((desc, idx) => ({
            title: `Step ${idx + 1}`,
            desc: desc.trim(),
        }));
    const finalSteps = steps.length > 0 ? steps : [{ title: 'Step 1', desc: instructionText || 'Enjoy!' }];

    // 智能分类
    const drinkCategory = classifyDrink(apiDrink);

    // 八维结构化数据
    const dimensions = computeDimensions(apiDrink);

    // 解析标签
    const tags = [drinkCategory];
    if (apiDrink.strTags) {
        tags.push(...apiDrink.strTags.split(',').map(t => t.trim()).filter(Boolean));
    }
    if (apiDrink.strAlcoholic) {
        tags.push(ALCOHOLIC_MAP[apiDrink.strAlcoholic] || apiDrink.strAlcoholic);
    }

    // 提取计算好的 ABV（由配料倒推）
    const abv = dimensions?.ratio?.physical?.estimated_abv || 0;

    // 构建简略配料（最多3个，使用翻译后名称）
    const briefIngredients = ingredients.slice(0, 3).map(ing => ({
        label: ing.name, // 已经是中文
        icon: ing.icon,
    }));

    // 饮品名翻译
    const nameEn = apiDrink.strDrink || '';
    const nameCn = translateDrinkName(nameEn);

    return {
        id: `api_${apiDrink.idDrink}`,
        apiId: apiDrink.idDrink,
        source: 'api',
        name: nameCn || nameEn, // 中文名优先，无则英文
        nameEn: nameEn, // 始终保留英文名
        nameCn: nameCn, // 中文名（可能为空）
        subName: apiDrink.strDrinkAlternate || '',
        type: apiDrink.strAlcoholic === 'Alcoholic' ? 'alcohol' : 'non-alcohol',
        category: drinkCategory,
        abv: abv, // 使用真实计算的体积比 ABV
        tags,
        image: apiDrink.strDrinkThumb || '',
        reason: '', // 不再用英文 instructions 作为 reason
        briefIngredients,
        ingredients,
        steps: finalSteps,
        dimensions,
    };
}

/**
 * 转换列表数据（filter 端点返回的简略数据）
 */
function transformDrinkBrief(apiDrink) {
    if (!apiDrink) return null;
    return {
        id: `api_${apiDrink.idDrink}`,
        apiId: apiDrink.idDrink,
        source: 'api',
        name: apiDrink.strDrink,
        subName: '',
        image: apiDrink.strDrinkThumb || '',
        // 简略模式下没有详细数据
        needDetail: true,
    };
}

// ─── API 方法 ─────────────────────────────────

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data;
}

/**
 * 按名称搜索
 */
export async function searchByName(name) {
    const data = await fetchJson(`${BASE_URL}/search.php?s=${encodeURIComponent(name)}`);
    if (!data.drinks) return [];
    return data.drinks.map(transformDrink).filter(Boolean);
}

/**
 * 按首字母浏览
 */
export async function searchByFirstLetter(letter) {
    const data = await fetchJson(`${BASE_URL}/search.php?f=${encodeURIComponent(letter)}`);
    if (!data.drinks) return [];
    return data.drinks.map(transformDrink).filter(Boolean);
}

/**
 * 按 ID 获取详情
 */
export async function getById(id) {
    const data = await fetchJson(`${BASE_URL}/lookup.php?i=${encodeURIComponent(id)}`);
    if (!data.drinks || data.drinks.length === 0) return null;
    return transformDrink(data.drinks[0]);
}

/**
 * 随机获取
 */
export async function getRandom() {
    const data = await fetchJson(`${BASE_URL}/random.php`);
    if (!data.drinks || data.drinks.length === 0) return null;
    return transformDrink(data.drinks[0]);
}

/**
 * 按分类筛选（返回简略列表，需要二次请求获取详情）
 */
export async function filterByCategory(category) {
    const data = await fetchJson(`${BASE_URL}/filter.php?c=${encodeURIComponent(category)}`);
    if (!data.drinks) return [];
    return data.drinks.map(transformDrinkBrief).filter(Boolean);
}

/**
 * 按酒精类型筛选
 */
export async function filterByAlcoholic(type) {
    const data = await fetchJson(`${BASE_URL}/filter.php?a=${encodeURIComponent(type)}`);
    if (!data.drinks) return [];
    return data.drinks.map(transformDrinkBrief).filter(Boolean);
}

/**
 * 获取分类列表（使用本地静态分类）
 */
export function getCategories() {
    return CATEGORIES;
}

/**
 * 获取多个随机饮品（用于补充加载）
 */
export async function getRandomMultiple(count = 10) {
    const promises = Array.from({ length: count }, () => getRandom());
    const results = await Promise.all(promises);
    // 去重
    const seen = new Set();
    return results.filter(d => {
        if (!d || seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
    });
}

const CACHE_KEY_ALL_DRINKS = 'moodmix_all_drinks_cache';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * 按首字母加载全部饮品（search.php?f= 返回完整数据，无需二次请求）
 * 分批加载 a-z 字母（每批2个，间隔500ms），避免 API 限流。
 * 引入 LocalStorage 缓存，避免每次刷新页面都拉取几百条数据导致的 429。
 */
export async function getAllDrinks() {
    // 1. 尝试从本地缓存读取
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY_ALL_DRINKS);
        if (cachedStr) {
            const cachedData = JSON.parse(cachedStr);
            if (Date.now() - cachedData.timestamp < CACHE_EXPIRY_MS) {
                console.log('✅ 从本地缓存读取全量饮品数据:', cachedData.data.length, '条');
                return cachedData.data;
            }
        }
    } catch (e) {
        console.warn('读取本地数据缓存失败:', e);
    }

    // 2. 缓存失效，走网路请求
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const BATCH_SIZE = 2; // 降低并发防 429
    const DELAY = 500;    // 增加间隔防 429
    const allDrinks = [];

    for (let i = 0; i < letters.length; i += BATCH_SIZE) {
        const batch = letters.slice(i, i + BATCH_SIZE);
        const promises = batch.map(letter =>
            fetchJson(`${BASE_URL}/search.php?f=${letter}`)
                .then(data => (data.drinks || []).map(transformDrink).filter(Boolean))
                .catch(() => []) // 某个字母失败不影响其他
        );
        const results = await Promise.all(promises);
        allDrinks.push(...results.flat());
        // 批间延迟
        if (i + BATCH_SIZE < letters.length) {
            await new Promise(r => setTimeout(r, DELAY));
        }
    }

    // 去重
    const seen = new Set();
    const finalData = allDrinks.filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
    });

    // 3. 结果写回本地缓存
    try {
        if (finalData.length > 0) {
            localStorage.setItem(CACHE_KEY_ALL_DRINKS, JSON.stringify({
                timestamp: Date.now(),
                data: finalData
            }));
            console.log('✅ 已缓存全量饮品数据:', finalData.length, '条');
        }
    } catch (e) {
        console.warn('吸水饮品数据写入缓存失败(可能超过限额):', e);
    }

    return finalData;
}

export { CATEGORIES, ALCOHOLIC_MAP, transformDrink };

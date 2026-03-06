/**
 * 八维推导规则引擎 (Dimension Engine)
 * 
 * 从配料知识库 + API数据 → 自动计算饮品八维结构化数据
 * 
 * 参考来源:
 * - 《Liquid Intelligence》(Dave Arnold) — 稀释/摇晃/搅拌的物理学
 * - 《The Bar Book》(Jeffrey Morgenthaler) — 调制手法分类
 * - 《黄帝内经·素问》 — 五味入五脏、十二时辰、天人相应
 * - 《中药学》统编教材 — 四气五味归经
 * - WSET Systematic Approach to Tasting — 香气轮分类
 */

import { getIngredientData } from '../data/ingredientKnowledgeBase';

// ═══════════════════════════════════════════
// 1. MEASURE 解析器 — 将 strMeasure 转为 ml
// ═══════════════════════════════════════════

const OZ_TO_ML = 29.5735;
const TSP_TO_ML = 4.93;
const TBSP_TO_ML = 14.79;
const CL_TO_ML = 10;
const DASH_ML = 0.9;
const SHOT_ML = 44.36;
const CUP_ML = 236.6;
const JIGGER_ML = 44.36;
const PONY_ML = 29.57;
const SPLASH_ML = 5;
const FLOAT_ML = 10;

/**
 * 解析分数字符串, e.g. "1 1/2" → 1.5, "3/4" → 0.75
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
 * 解析 strMeasure 字段为 ml 数值
 * 例: "1 1/2 oz " → 44.36, "2 dashes" → 1.8, "1 cup" → 236.6
 */
export function parseMeasure(measure) {
    if (!measure || !measure.trim()) return 30; // 默认 1 oz
    let s = measure.trim().toLowerCase();

    // 移除尾部空格和多余字符
    s = s.replace(/\s+/g, ' ').trim();

    // 范围值取中间: "2-3 oz" → 2.5 oz
    const rangeMatch = s.match(/^([\d./]+)\s*-\s*([\d./]+)\s*(.*)$/);
    if (rangeMatch) {
        const avg = (parseFraction(rangeMatch[1]) + parseFraction(rangeMatch[2])) / 2;
        s = avg + ' ' + rangeMatch[3].trim();
    }

    // 提取数值部分
    const numMatch = s.match(/^([\d\s/½¼¾⅓⅔⅛.]+)/);
    const num = numMatch ? parseFraction(numMatch[1]) : 1;

    // 单位匹配
    if (/\boz\b/.test(s)) return num * OZ_TO_ML;
    if (/\bcl\b/.test(s)) return num * CL_TO_ML;
    if (/\bml\b/.test(s)) return num;
    if (/\btsp\b/.test(s)) return num * TSP_TO_ML;
    if (/\btbsp\b/.test(s)) return num * TBSP_TO_ML;
    if (/\bshot\b/i.test(s)) return num * SHOT_ML;
    if (/\bjigger\b/.test(s)) return num * JIGGER_ML;
    if (/\bpony\b/.test(s)) return num * PONY_ML;
    if (/\bcup\b/.test(s)) return num * CUP_ML;
    if (/\bdash(es)?\b/.test(s)) return num * DASH_ML;
    if (/\bsplash\b/.test(s)) return num * SPLASH_ML;
    if (/\bfloat\b/.test(s)) return num * FLOAT_ML;
    if (/\bdrop\b/.test(s)) return num * 0.05;
    if (/\bpinch\b/.test(s)) return num * 0.3;
    if (/\bpart\b/.test(s)) return num * 30; // 1 part = 1 oz convention
    if (/\bfill\b|top\b|juice of/.test(s)) return 60; // 估算
    if (/\bgarnish\b|twist\b|slice\b|wedge\b|sprig\b|leaf\b|leaves\b/.test(s)) return 0; // 装饰无体积
    if (/\bcube\b/.test(s)) return num * 4; // 方糖 ~4g ≈ 4ml

    // 纯数字—猜测为 oz
    if (num > 0 && num <= 10) return num * OZ_TO_ML;
    return num > 0 ? num : 30;
}

// ═══════════════════════════════════════════
// 2. INSTRUCTIONS 关键词提取
// ═══════════════════════════════════════════

const ACTION_MAP = {
    muddle: { cn: '捣(muddle)', philosophy: '破障宣泄' },
    stir: { cn: '搅(stir)', philosophy: '归位守中' },
    shake: { cn: '摇(shake)', philosophy: '生命力转化' },
    pour: { cn: '注(pour)', philosophy: '倾注能量' },
    strain: { cn: '滤(strain)', philosophy: '去芜存菁' },
    blend: { cn: '融(blend)', philosophy: '万物归一' },
    layer: { cn: '叠(layer)', philosophy: '层次分明' },
    garnish: { cn: '饰(garnish)', philosophy: '点睛之笔' },
    build: { cn: '注(build)', philosophy: '层层构建' },
    rim: { cn: '擦(rim)', philosophy: '结界划定' },
    float: { cn: '浮(float)', philosophy: '轻盈飘浮' },
    top: { cn: '点(top)', philosophy: '画龙点睛' },
    squeeze: { cn: '挤(squeeze)', philosophy: '释放精华' },
    flame: { cn: '燃(flame)', philosophy: '凤凰涅槃' },
};

const TASTING_ACTIONS = {
    sip: { cn: '啜(sip)', philosophy: '当下即道场' },
    smell: { cn: '闻(smell)', philosophy: '通灵开窍' },
    gaze: { cn: '观(gaze)', philosophy: '静观内照' },
};

function extractActions(instructions) {
    if (!instructions) return { primary: [], preparation: [], tasting: [{ cn: '啜(sip)', philosophy: '当下即道场' }] };
    const text = instructions.toLowerCase();

    const primary = [];
    const preparation = [];

    for (const [keyword, data] of Object.entries(ACTION_MAP)) {
        if (text.includes(keyword)) {
            if (['rim', 'garnish'].includes(keyword)) {
                preparation.push(data);
            } else {
                primary.push(data);
            }
        }
    }

    // 默认品鉴动作
    const tasting = [TASTING_ACTIONS.sip];

    // 若有视觉亮点，增加"观"
    if (text.includes('flame') || text.includes('layer') || text.includes('float')) {
        tasting.unshift(TASTING_ACTIONS.gaze);
    }

    if (primary.length === 0) primary.push(ACTION_MAP.pour);
    return { primary, preparation, tasting };
}

// ═══════════════════════════════════════════
// 3. 温度判断
// ═══════════════════════════════════════════

function detectServingTemp(instructions) {
    if (!instructions) return { label: '冰饮', celsius: '2-6°C', score: -2 };
    const text = instructions.toLowerCase();

    if (/\bhot\b|warm|heat|boil/.test(text)) return { label: '热饮', celsius: '60-80°C', score: 3 };
    if (/\bfrozen\b|blender/.test(text)) return { label: '冰沙', celsius: '-2~0°C', score: -3 };
    if (/\bcrushed ice|cracked ice/.test(text)) return { label: '碎冰冰饮', celsius: '0-3°C', score: -3 };
    if (/\bice\b|chill|cold/.test(text)) return { label: '冰饮', celsius: '2-6°C', score: -2 };
    if (/\bneat\b|room/.test(text)) return { label: '常温', celsius: '18-22°C', score: 0 };
    return { label: '冰饮', celsius: '2-6°C', score: -2 }; // 默认
}

// ═══════════════════════════════════════════
// 4. 五行色彩映射
// ═══════════════════════════════════════════

function classifyColor(hex) {
    // 简化: 从 hex 提取 RGB 通道判断主色调
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // 深色/黑色 → 水
    if (r < 60 && g < 60 && b < 60) return { wuxing: '黑/深褐', element: '水', energy: '深邃储藏' };
    // 红色系 → 火
    if (r > 180 && g < 100 && b < 100) return { wuxing: '赤红', element: '火', energy: '扩张觉醒' };
    if (r > 180 && g < 130 && b < 80) return { wuxing: '赤红/琥珀', element: '火', energy: '温暖扩张' };
    // 绿色系 → 木
    if (g > r && g > b && g > 100) return { wuxing: '青绿', element: '木', energy: '生命力/疏解' };
    // 蓝色系 → 水
    if (b > r && b > g && b > 100) return { wuxing: '蓝/深色', element: '水', energy: '深邃储藏' };
    // 黄/琥珀色 → 土
    if (r > 150 && g > 100 && b < 100) return { wuxing: '黄/琥珀', element: '土', energy: '中正稳定' };
    // 白/透明 → 金
    if (r > 220 && g > 220 && b > 200) return { wuxing: '白/透明', element: '金', energy: '肃静收敛' };
    // 粉红 → 火偏
    if (r > 200 && g > 100 && b > 100 && r > g) return { wuxing: '粉红', element: '火', energy: '柔和觉醒' };
    // 棕色 → 土
    if (r > 100 && g > 60 && b < 60) return { wuxing: '棕/琥珀', element: '土', energy: '厚重稳定' };

    return { wuxing: '黄/琥珀', element: '土', energy: '中正稳定' };
}

// ═══════════════════════════════════════════
// 5. 时序维度 — 天人相应
// ═══════════════════════════════════════════

function computeTemporality(tempScore, dominantTaste, abv, category) {
    // 热饮
    if (tempScore >= 2) {
        return {
            physical: {
                ideal_hours: ['19:00-22:00'],
                ideal_shichen: '戌时',
                ideal_seasons: ['秋', '冬'],
                ideal_solar_terms: ['寒露', '霜降', '立冬', '小雪', '大雪'],
                description: '热饮适合秋冬夜晚温补'
            },
            philosophy: {
                heaven_human_logic: '秋冬主收藏，阳气内敛，以温热饮助阳归元',
                description: '顺应天时收藏之令，温补元阳'
            }
        };
    }

    // 高度酒/烈酒
    if (abv >= 25) {
        return {
            physical: {
                ideal_hours: ['19:00-23:00'],
                ideal_shichen: '戌时、亥时',
                ideal_seasons: ['秋', '冬', '四季皆宜'],
                ideal_solar_terms: ['秋分', '立冬', '小雪'],
                description: '烈酒适合夜间慢饮，秋冬尤佳'
            },
            philosophy: {
                heaven_human_logic: '日暮阳收，借烈酒温阳之力，助阳气归元不散',
                description: '夜间阳藏阴生，温阳固本'
            }
        };
    }

    // 酸味主导 → 夏季午后
    if (dominantTaste === 'sour') {
        return {
            physical: {
                ideal_hours: ['14:00-19:00'],
                ideal_shichen: '未时、申时',
                ideal_seasons: ['夏', '初秋'],
                ideal_solar_terms: ['小暑', '大暑', '立秋'],
                description: '酸味冰饮消暑，适合夏季午后'
            },
            philosophy: {
                heaven_human_logic: '夏日阳盛于外，以酸收敛浮阳，防汗出过多伤阴',
                description: '酸收夏阳，固护阴液'
            }
        };
    }

    // 苦味主导 → 开胃时段
    if (dominantTaste === 'bitter') {
        return {
            physical: {
                ideal_hours: ['17:00-19:00'],
                ideal_shichen: '酉时',
                ideal_seasons: ['夏', '秋'],
                ideal_solar_terms: ['立夏', '小满', '芒种'],
                description: '苦味开胃饮品适合傍晚餐前'
            },
            philosophy: {
                heaven_human_logic: '酉时阳气初降，苦味清泄白日积累之心火',
                description: '日落清心，苦降火气'
            }
        };
    }

    // 甜味主导 → 下午/全天
    if (dominantTaste === 'sweet') {
        return {
            physical: {
                ideal_hours: ['14:00-20:00'],
                ideal_shichen: '未时至酉时',
                ideal_seasons: ['四季皆宜'],
                ideal_solar_terms: ['各节气均可'],
                description: '甜味饮品四季皆宜，午后至傍晚最佳'
            },
            philosophy: {
                heaven_human_logic: '甘入脾土居中，不偏不倚，四时皆可补中益气',
                description: '土为万物之母，甘味补中'
            }
        };
    }

    // 默认
    return {
        physical: {
            ideal_hours: ['17:00-22:00'],
            ideal_shichen: '酉时、戌时',
            ideal_seasons: ['四季皆宜'],
            ideal_solar_terms: ['各节气均可'],
            description: '傍晚至夜间饮用'
        },
        philosophy: {
            heaven_human_logic: '日落后阳收阴生，饮品助人从动态转入静态',
            description: '顺应昼夜节律'
        }
    };
}

// ═══════════════════════════════════════════
// 6. 嗅觉 → 经络映射
// ═══════════════════════════════════════════

const AROMA_MERIDIAN = {
    herb: { meridian: '肝胆经', action: '疏肝理气' },
    citrus: { meridian: '肝胆经', action: '疏肝解郁' },
    floral: { meridian: '心经', action: '宁心安神' },
    spice: { meridian: '肺经', action: '辟秽通窍' },
    roast: { meridian: '心经、脾经', action: '温脾宁心' },
    fruit: { meridian: '脾经', action: '健脾生津' },
    mineral: { meridian: '肾经', action: '固肾纳气' },
};

// ═══════════════════════════════════════════
// 7. 气机方向
// ═══════════════════════════════════════════

function computeQiDirection(effervescence, smoothness, burn) {
    if (effervescence >= 5) return { direction: '上浮', type: '宣发提神', desc: '气泡感推动气机上浮宣发，提振精神' };
    if (smoothness >= 6) return { direction: '内敛', type: '安神沉淀', desc: '丝滑厚重质感引导气机内收下沉，安定心神' };
    if (burn >= 7) return { direction: '外散', type: '破气宣散', desc: '灼烧感破散郁结之气，打通壅塞' };
    if (burn >= 5) return { direction: '散发', type: '破气兼收', desc: '中度灼烧散郁，但不至于全散' };
    return { direction: '平和', type: '调和中正', desc: '气机平稳，不偏不倚' };
}

// ═══════════════════════════════════════════
// 主函数: 计算饮品八维数据
// ═══════════════════════════════════════════

/**
 * 从 API 原始数据计算八维结构化数据
 * @param {object} apiDrink - CocktailDB API 原始饮品对象
 * @returns {object} 八维结构化数据
 */
export function computeDimensions(apiDrink) {
    if (!apiDrink) return null;

    // ── 解析所有配料及其用量 ──
    const items = [];
    for (let i = 1; i <= 15; i++) {
        const name = apiDrink[`strIngredient${i}`];
        if (!name || !name.trim()) break;
        const measure = apiDrink[`strMeasure${i}`] || '';
        const data = getIngredientData(name);
        let ml = parseMeasure(measure);
        // 装饰物始终不计液体体积（无论是否有用量标注）
        if (data.cat === 'garnish') {
            ml = 0;
        } else {
            const noMeasure = !measure || !measure.trim();
            if (noMeasure && data.cat === 'spice') ml = 0;
            else if (noMeasure && data.cat === 'other') ml = 0;
        }
        items.push({ name: name.trim(), ml, data });
    }

    if (items.length === 0) return null;

    // 体积类配料（排除装饰 ml=0 的）
    const volumeItems = items.filter(it => it.ml > 0);
    const totalMl = volumeItems.reduce((s, it) => s + it.ml, 0) || 1;

    // ═══ 1. 味觉维度 ═══
    const tasteKeys = ['sour', 'bitter', 'sweet', 'spicy', 'salty'];
    const tasteScores = {};
    for (const k of tasteKeys) {
        tasteScores[k] = Math.round(
            volumeItems.reduce((s, it) => s + (it.data.taste[k] || 0) * (it.ml / totalMl), 0) * 10
        ) / 10;
    }
    // 盐边特殊处理
    const hasSalt = items.some(it => it.name.toLowerCase() === 'salt');
    if (hasSalt) tasteScores.salty = Math.min(10, tasteScores.salty + 5);

    // 四舍五入到整数
    for (const k of tasteKeys) tasteScores[k] = Math.round(tasteScores[k]);

    const dominant = tasteKeys.reduce((a, b) => tasteScores[a] >= tasteScores[b] ? a : b);
    const TASTE_CN = { sour: '酸', bitter: '苦', sweet: '甘(甜)', spicy: '辛(辣)', salty: '咸' };
    const ORGAN_MAP = { sour: '肝(木)', bitter: '心(火)', sweet: '脾(土)', spicy: '肺(金)', salty: '肾(水)' };

    const taste = {
        physical: {
            ...tasteScores,
            dominant: TASTE_CN[dominant],
            description: `主味为${TASTE_CN[dominant]}，` +
                tasteKeys.filter(k => tasteScores[k] >= 3).map(k => `${TASTE_CN[k]}${tasteScores[k]}`).join('，')
        },
        philosophy: {
            liver_wood: tasteScores.sour,
            heart_fire: tasteScores.bitter,
            spleen_earth: tasteScores.sweet,
            lung_metal: tasteScores.spicy,
            kidney_water: tasteScores.salty,
            dominant_organ: ORGAN_MAP[dominant],
            therapeutic_logic: `${TASTE_CN[dominant]}入${ORGAN_MAP[dominant].slice(0, 1)}，` +
                (dominant === 'sour' ? '收敛肝气，适合易怒/肝火旺盛者' :
                    dominant === 'bitter' ? '清泄心火，适合心烦焦躁者' :
                        dominant === 'sweet' ? '补益脾土，适合思虑过度/气虚者' :
                            dominant === 'spicy' ? '宣发肺气，适合气滞/呼吸不畅者' :
                                '滋补肾水，适合恐惧/精力不足者')
        }
    };

    // ═══ 2. 触觉维度 ═══
    const avgEfferv = volumeItems.reduce((s, it) => s + it.data.efferv * (it.ml / totalMl), 0);
    const avgSmooth = volumeItems.reduce((s, it) => s + it.data.smooth * (it.ml / totalMl), 0);
    const avgBurn = volumeItems.reduce((s, it) => s + it.data.burn * (it.ml / totalMl), 0);
    const efferv = Math.round(avgEfferv);
    const smooth = Math.round(avgSmooth);
    const burn = Math.round(avgBurn);
    const body = smooth >= 6 ? 'full' : smooth >= 3 ? 'medium' : 'light';

    const qi = computeQiDirection(efferv, smooth, burn);
    const texture = {
        physical: {
            effervescence: efferv, smoothness: smooth, burn,
            body,
            description: [
                efferv >= 5 ? '明显气泡感' : null,
                smooth >= 5 ? '丝滑醇厚质地' : null,
                burn >= 7 ? '强烈灼烧感' : burn >= 4 ? '中度灼烧感' : null,
            ].filter(Boolean).join('，') || '清冽爽口'
        },
        philosophy: {
            qi_direction: qi.direction,
            qi_type: qi.type,
            description: qi.desc
        }
    };

    // ═══ 3. 温度维度 ═══
    const serving = detectServingTemp(apiDrink.strInstructions);
    const avgNature = volumeItems.reduce((s, it) => s + it.data.nature * (it.ml / totalMl), 0);
    const natureLabel = avgNature <= -1.5 ? '寒' : avgNature <= -0.5 ? '凉' : avgNature <= 0.5 ? '平' : avgNature <= 1.5 ? '温' : '热';
    const yinYangScore = Math.round((serving.score + avgNature) * 10) / 10;
    const yinYangLabel = yinYangScore <= -3 ? '极阴(寒凉)' : yinYangScore <= -1 ? '偏阴' : yinYangScore <= 1 ? '阴阳调和' : yinYangScore <= 3 ? '偏阳' : '纯阳(温补)';

    const temperature = {
        physical: {
            serving_temp: serving.label,
            serving_temp_celsius: serving.celsius,
            ingredient_nature: natureLabel,
            description: `${serving.label}饮用，成分属性${natureLabel}`
        },
        philosophy: {
            yin_yang: yinYangLabel,
            yin_yang_score: Math.round(yinYangScore),
            description: yinYangScore < 0 ? '偏阴寒凉，宜清泄阳热' : yinYangScore > 0 ? '偏阳温补，宜驱寒暖身' : '阴阳平衡，中正和平'
        }
    };

    // ═══ 4. 颜色维度 ═══
    // 找体积最大的非透明配料作为主色
    const colorItems = volumeItems
        .filter(it => it.data.color.transparency < 9)
        .sort((a, b) => b.ml - a.ml);
    const mainColor = colorItems.length > 0 ? colorItems[0].data.color.hex :
        (volumeItems[0]?.data.color.hex || '#FFFFFF');
    const mainTransp = colorItems.length > 0 ? colorItems[0].data.color.transparency : 9;
    const transpLabel = mainTransp >= 8 ? '透明' : mainTransp >= 5 ? '半透明' : '不透明';
    const brightnessLabel = mainTransp >= 7 ? '明亮' : mainTransp >= 4 ? '中等' : '深沉';
    const wuxing = classifyColor(mainColor);

    const color = {
        physical: {
            primary_color: wuxing.wuxing,
            hex: mainColor,
            transparency: transpLabel,
            brightness: brightnessLabel,
            description: `${wuxing.wuxing}色调，${transpLabel}，${brightnessLabel}`
        },
        philosophy: {
            wuxing_color: wuxing.wuxing,
            wuxing_element: wuxing.element,
            energy_type: wuxing.energy,
            description: `${wuxing.wuxing}对应${wuxing.element}气，${wuxing.energy}`
        }
    };

    // ═══ 5. 时序维度 ═══
    const estAbv = volumeItems.reduce((s, it) => s + it.data.abv * (it.ml / totalMl), 0);
    const temporality = computeTemporality(serving.score, dominant, Math.round(estAbv), apiDrink.strCategory);

    // ═══ 6. 嗅觉维度 ═══
    const allAromas = new Set();
    items.forEach(it => (it.data.aroma || []).forEach(a => allAromas.add(a)));
    const aromaList = [...allAromas];
    const primaryAromas = aromaList.slice(0, 3);
    const secondaryAromas = aromaList.slice(3);
    // 找主经络
    const meridians = new Set();
    const actions = new Set();
    for (const a of aromaList) {
        if (AROMA_MERIDIAN[a]) {
            meridians.add(AROMA_MERIDIAN[a].meridian);
            actions.add(AROMA_MERIDIAN[a].action);
        }
    }
    const AROMA_CN = { herb: '草本香', citrus: '柑橘香', floral: '花香', spice: '辛香', roast: '焦烤香', fruit: '果香', mineral: '矿物质感' };
    const aromaIntensity = Math.min(10, Math.round(items.reduce((s, it) => s + (it.data.aroma || []).length, 0) / items.length * 3));

    const aroma = {
        physical: {
            primary_aromas: primaryAromas.map(a => AROMA_CN[a] || a),
            secondary_aromas: secondaryAromas.map(a => AROMA_CN[a] || a),
            aroma_intensity: aromaIntensity,
            description: `主要香气: ${primaryAromas.map(a => AROMA_CN[a] || a).join('、')}`
        },
        philosophy: {
            meridian_target: [...meridians].join('、') || '脾经',
            therapeutic_action: [...actions].join('、') || '健脾益气',
            description: `${[...meridians].join('、')}经络，${[...actions].join('、')}`
        }
    };

    // ═══ 7. 比例维度 ═══
    const spiritMl = volumeItems.filter(it => it.data.cat === 'spirit').reduce((s, it) => s + it.ml, 0);
    const liqueurMl = volumeItems.filter(it => it.data.cat === 'liqueur').reduce((s, it) => s + it.ml, 0);
    const juiceMl = volumeItems.filter(it => it.data.cat === 'juice').reduce((s, it) => s + it.ml, 0);


    const spiritR = Math.round(spiritMl / totalMl * 100) / 100;
    const modifierR = Math.round(liqueurMl / totalMl * 100) / 100;
    const juiceR = Math.round(juiceMl / totalMl * 100) / 100;
    const roundedAbv = Math.round(estAbv);

    const intensityLabel = roundedAbv >= 30 ? '强' : roundedAbv >= 20 ? '中偏强' : roundedAbv >= 10 ? '中等' : '柔和';
    const balanceLabel = spiritR >= 0.8 ? '纯阳重剂' : spiritR >= 0.5 ? '阳中带阴' :
        Math.abs(spiritR - juiceR) < 0.15 ? '中庸调和' : juiceR > spiritR ? '滋阴柔和' : '刚柔并济';

    const ratio = {
        physical: {
            spirit_ratio: spiritR,
            modifier_ratio: modifierR,
            juice_ratio: juiceR,
            estimated_abv: roundedAbv,
            description: `烈酒${Math.round(spiritR * 100)}%，利口酒${Math.round(modifierR * 100)}%，果汁${Math.round(juiceR * 100)}%，ABV≈${roundedAbv}%`
        },
        philosophy: {
            energy_intensity: intensityLabel,
            wuxing_balance: balanceLabel,
            description: `能量强度: ${intensityLabel}，${balanceLabel}`
        }
    };

    // ═══ 8. 动作维度 ═══
    const acts = extractActions(apiDrink.strInstructions);
    const meditationType = acts.primary.some(a => a.cn.includes('摇')) ? '动态冥想' :
        acts.primary.some(a => a.cn.includes('捣')) ? '宣泄冥想' :
            acts.primary.some(a => a.cn.includes('搅')) ? '静观冥想' :
                acts.primary.some(a => a.cn.includes('融')) ? '融合冥想' : '自在冥想';

    const ritual = {
        physical: {
            primary_actions: acts.primary.map(a => a.cn),
            preparation_actions: acts.preparation.map(a => a.cn),
            tasting_actions: acts.tasting.map(a => a.cn),
            description: `主要动作: ${acts.primary.map(a => a.cn).join('、')}`
        },
        philosophy: {
            ritual_meaning: acts.primary.map(a => `${a.cn.split('(')[0]} = ${a.philosophy}`).join('；'),
            meditation_type: meditationType,
            description: `${meditationType} — ${acts.primary[0]?.philosophy || '当下感知'}`
        }
    };

    return { taste, texture, temperature, color, temporality, aroma, ratio, ritual };
}

const dimensionEngineExports = { computeDimensions, parseMeasure };
export default dimensionEngineExports;

/**
 * 批量生成八维数据 → 双层存储
 * 
 * 运行: node scripts/batchGenerate.mjs
 * 
 * 输出:
 *   src/data/dimensionData.js  — 完整八维数据（含哲学层文本，用于推荐语生成）
 *   src/data/drinkVectors.js   — 数值向量（用于余弦相似度 Top15 匹配）
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DATA = join(ROOT, 'src', 'data');
const BASE_URL = 'https://www.thecocktaildb.com/api/json/v1/1';

// ═══ 加载配料知识库（直接读取源文件中的 _RAW 对象） ═══

function loadKnowledgeBase() {
    const src = readFileSync(join(SRC_DATA, 'ingredientKnowledgeBase.js'), 'utf-8');
    // 提取 _RAW 对象
    const match = src.match(/const _RAW = (\{[\s\S]*?\n\});/);
    if (!match) throw new Error('无法解析 ingredientKnowledgeBase.js 中的 _RAW');
    const _RAW = eval('(' + match[1] + ')');

    function expand(raw) {
        const [cat, taste, nature, aroma, color, abv, burn, efferv, smooth] = raw;
        return {
            cat, nature, aroma, abv, burn, efferv, smooth,
            taste: { sour: taste[0], bitter: taste[1], sweet: taste[2], spicy: taste[3], salty: taste[4] },
            color: { hex: color[0], transparency: color[1] },
        };
    }

    const cache = {};
    function getIngredientData(name) {
        if (!name) return null;
        const key = name.trim().toLowerCase();
        if (cache[key]) return cache[key];
        if (_RAW[key]) { cache[key] = expand(_RAW[key]); return cache[key]; }
        for (const [k, v] of Object.entries(_RAW)) {
            if (key.includes(k) || k.includes(key)) { cache[key] = expand(v); return cache[key]; }
        }
        const defaults = { rum: 'light rum', whiskey: 'blended whiskey', whisky: 'blended scotch', vodka: 'vodka', gin: 'gin', brandy: 'brandy', tequila: 'tequila', juice: 'orange juice', cream: 'heavy cream', liqueur: 'triple sec', syrup: 'simple syrup', schnapps: 'triple sec', wine: 'champagne', soda: 'soda water', beer: 'beer', bitters: 'bitters' };
        for (const [kw, fb] of Object.entries(defaults)) {
            if (key.includes(kw) && _RAW[fb]) { cache[key] = expand(_RAW[fb]); return cache[key]; }
        }
        cache[key] = expand(['other', [0, 0, 0, 0, 0], 0, [], ['#CCCCCC', 5], 0, 0, 0, 0]);
        return cache[key];
    }

    function isKnown(name) { return !!_RAW[name?.trim().toLowerCase()]; }
    return { getIngredientData, isKnown };
}

// ═══ Measure 解析器 ═══

function parseFraction(str) {
    str = str.trim();
    const uf = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667, '⅛': 0.125 };
    for (const [ch, val] of Object.entries(uf)) { if (str.includes(ch)) { const b = str.replace(ch, '').trim(); return (b ? parseFloat(b) : 0) + val; } }
    const mx = str.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (mx) return parseInt(mx[1]) + parseInt(mx[2]) / parseInt(mx[3]);
    const fr = str.match(/^(\d+)\/(\d+)$/); if (fr) return parseInt(fr[1]) / parseInt(fr[2]);
    const n = parseFloat(str); return isNaN(n) ? 0 : n;
}

function parseMeasure(m) {
    if (!m || !m.trim()) return 30;
    let s = m.trim().toLowerCase().replace(/\s+/g, ' ');
    const rng = s.match(/^([\d./]+)\s*-\s*([\d./]+)\s*(.*)$/);
    if (rng) { s = ((parseFraction(rng[1]) + parseFraction(rng[2])) / 2) + ' ' + rng[3].trim(); }
    const nm = s.match(/^([\d\s/½¼¾⅓⅔⅛.]+)/);
    const num = nm ? parseFraction(nm[1]) : 1;
    if (/\boz\b/.test(s)) return num * 29.57;
    if (/\bcl\b/.test(s)) return num * 10;
    if (/\bml\b/.test(s)) return num;
    if (/\btsp\b/.test(s)) return num * 4.93;
    if (/\btbsp\b/.test(s)) return num * 14.79;
    if (/\bshot\b/i.test(s)) return num * 44.36;
    if (/\bjigger\b/.test(s)) return num * 44.36;
    if (/\bcup\b/.test(s)) return num * 236.6;
    if (/\bdash/.test(s)) return num * 0.9;
    if (/\bsplash\b/.test(s)) return num * 5;
    if (/\bfloat\b/.test(s)) return num * 10;
    if (/\bdrop\b/.test(s)) return num * 0.05;
    if (/\bpinch\b/.test(s)) return num * 0.3;
    if (/\bpart\b/.test(s)) return num * 30;
    if (/\bfill\b|top\b|juice of/.test(s)) return 60;
    if (/\bgarnish|twist|slice|wedge|sprig|leaf|leaves/.test(s)) return 0;
    if (/\bcube\b/.test(s)) return num * 4;
    if (num > 0 && num <= 10) return num * 29.57;
    return num > 0 ? num : 30;
}

// ═══ 八维计算引擎（精简版） ═══

const ACTION_MAP = { muddle: '捣(muddle)', stir: '搅(stir)', shake: '摇(shake)', pour: '注(pour)', strain: '滤(strain)', blend: '融(blend)', layer: '叠(layer)', garnish: '饰(garnish)', build: '注(build)', rim: '擦(rim)', float: '浮(float)', top: '点(top)', squeeze: '挤(squeeze)', flame: '燃(flame)' };
const ACTION_PHI = { muddle: '破障宣泄', stir: '归位守中', shake: '生命力转化', pour: '倾注能量', strain: '去芜存菁', blend: '万物归一', layer: '层次分明', garnish: '点睛之笔', build: '层层构建', rim: '结界划定', float: '轻盈飘浮', top: '画龙点睛', squeeze: '释放精华', flame: '凤凰涅槃' };
const TASTE_CN = { sour: '酸', bitter: '苦', sweet: '甘(甜)', spicy: '辛(辣)', salty: '咸' };
const ORGAN_MAP = { sour: '肝(木)', bitter: '心(火)', sweet: '脾(土)', spicy: '肺(金)', salty: '肾(水)' };
const AROMA_CN = { herb: '草本香', citrus: '柑橘香', floral: '花香', spice: '辛香', roast: '焦烤香', fruit: '果香', mineral: '矿物质感' };
const AROMA_MER = { herb: { m: '肝胆经', a: '疏肝理气' }, citrus: { m: '肝胆经', a: '疏肝解郁' }, floral: { m: '心经', a: '宁心安神' }, spice: { m: '肺经', a: '辟秽通窍' }, roast: { m: '心经、脾经', a: '温脾宁心' }, fruit: { m: '脾经', a: '健脾生津' }, mineral: { m: '肾经', a: '固肾纳气' } };

function computeDimensions(apiDrink, getIngredientData) {
    if (!apiDrink) return null;
    const items = [];
    for (let i = 1; i <= 15; i++) {
        const name = apiDrink[`strIngredient${i}`]; if (!name || !name.trim()) break;
        const measure = apiDrink[`strMeasure${i}`] || '';
        const data = getIngredientData(name);
        let ml = parseMeasure(measure);
        if (data.cat === 'garnish') ml = 0;
        else { const no = !measure || !measure.trim(); if (no && (data.cat === 'spice' || data.cat === 'other')) ml = 0; }
        items.push({ name: name.trim(), ml, data });
    }
    if (!items.length) return null;
    const vi = items.filter(it => it.ml > 0), tot = vi.reduce((s, it) => s + it.ml, 0) || 1;

    // 1. 味觉
    const tk = ['sour', 'bitter', 'sweet', 'spicy', 'salty'], ts = {};
    for (const k of tk) ts[k] = Math.round(vi.reduce((s, it) => s + (it.data.taste[k] || 0) * (it.ml / tot), 0));
    if (items.some(it => it.name.toLowerCase() === 'salt')) ts.salty = Math.min(10, ts.salty + 5);
    const dom = tk.reduce((a, b) => ts[a] >= ts[b] ? a : b);
    const taste = {
        physical: { ...ts, dominant: TASTE_CN[dom], description: `主味为${TASTE_CN[dom]}，` + tk.filter(k => ts[k] >= 3).map(k => `${TASTE_CN[k]}${ts[k]}`).join('，') },
        philosophy: {
            liver_wood: ts.sour, heart_fire: ts.bitter, spleen_earth: ts.sweet, lung_metal: ts.spicy, kidney_water: ts.salty, dominant_organ: ORGAN_MAP[dom],
            therapeutic_logic: `${TASTE_CN[dom]}入${ORGAN_MAP[dom][0]}，` + (dom === 'sour' ? '收敛肝气，适合易怒/肝火旺盛者' : dom === 'bitter' ? '清泄心火，适合心烦焦躁者' : dom === 'sweet' ? '补益脾土，适合思虑过度/气虚者' : dom === 'spicy' ? '宣发肺气，适合气滞/呼吸不畅者' : '滋补肾水，适合恐惧/精力不足者')
        }
    };

    // 2. 触觉
    const ef = Math.round(vi.reduce((s, it) => s + it.data.efferv * (it.ml / tot), 0));
    const sm = Math.round(vi.reduce((s, it) => s + it.data.smooth * (it.ml / tot), 0));
    const bn = Math.round(vi.reduce((s, it) => s + it.data.burn * (it.ml / tot), 0));
    const body = sm >= 6 ? 'full' : sm >= 3 ? 'medium' : 'light';
    const qiDir = ef >= 5 ? { d: '上浮', t: '宣发提神', desc: '气泡感推动气机上浮宣发，提振精神' } : sm >= 6 ? { d: '内敛', t: '安神沉淀', desc: '丝滑厚重质感引导气机内收下沉，安定心神' } : bn >= 7 ? { d: '外散', t: '破气宣散', desc: '灼烧感破散郁结之气，打通壅塞' } : bn >= 5 ? { d: '散发', t: '破气兼收', desc: '中度灼烧散郁，但不至于全散' } : { d: '平和', t: '调和中正', desc: '气机平稳，不偏不倚' };
    const texture = {
        physical: { effervescence: ef, smoothness: sm, burn: bn, body, description: [ef >= 5 ? '明显气泡感' : null, sm >= 5 ? '丝滑醇厚质地' : null, bn >= 7 ? '强烈灼烧感' : bn >= 4 ? '中度灼烧感' : null].filter(Boolean).join('，') || '清冽爽口' },
        philosophy: { qi_direction: qiDir.d, qi_type: qiDir.t, description: qiDir.desc }
    };

    // 3. 温度
    const inst = (apiDrink.strInstructions || '').toLowerCase();
    const srv = /\bhot\b|warm|heat|boil/.test(inst) ? { l: '热饮', c: '60-80°C', s: 3 } : /\bfrozen\b|blender/.test(inst) ? { l: '冰沙', c: '-2~0°C', s: -3 } : /crushed ice|cracked ice/.test(inst) ? { l: '碎冰冰饮', c: '0-3°C', s: -3 } : /\bice\b|chill|cold/.test(inst) ? { l: '冰饮', c: '2-6°C', s: -2 } : /\bneat\b|room/.test(inst) ? { l: '常温', c: '18-22°C', s: 0 } : { l: '冰饮', c: '2-6°C', s: -2 };
    const avgN = vi.reduce((s, it) => s + it.data.nature * (it.ml / tot), 0);
    const natL = avgN <= -1.5 ? '寒' : avgN <= -0.5 ? '凉' : avgN <= 0.5 ? '平' : avgN <= 1.5 ? '温' : '热';
    const yys = Math.round((srv.s + avgN) * 10) / 10;
    const yyL = yys <= -3 ? '极阴(寒凉)' : yys <= -1 ? '偏阴' : yys <= 1 ? '阴阳调和' : yys <= 3 ? '偏阳' : '纯阳(温补)';
    const temperature = {
        physical: { serving_temp: srv.l, serving_temp_celsius: srv.c, ingredient_nature: natL, description: `${srv.l}饮用，成分属性${natL}` },
        philosophy: { yin_yang: yyL, yin_yang_score: Math.round(yys), description: yys < 0 ? '偏阴寒凉，宜清泄阳热' : yys > 0 ? '偏阳温补，宜驱寒暖身' : '阴阳平衡，中正和平' }
    };

    // 4. 颜色
    const ci = vi.filter(it => it.data.color.transparency < 9).sort((a, b) => b.ml - a.ml);
    const mHex = ci.length > 0 ? ci[0].data.color.hex : (vi[0]?.data.color.hex || '#FFFFFF');
    const mT = ci.length > 0 ? ci[0].data.color.transparency : 9;
    const r = parseInt(mHex.slice(1, 3), 16), g = parseInt(mHex.slice(3, 5), 16), b2 = parseInt(mHex.slice(5, 7), 16);
    const wx = (r < 60 && g < 60 && b2 < 60) ? { w: '黑/深褐', e: '水', en: '深邃储藏' } : (r > 180 && g < 100 && b2 < 100) ? { w: '赤红', e: '火', en: '扩张觉醒' } : (r > 180 && g < 130 && b2 < 80) ? { w: '赤红/琥珀', e: '火', en: '温暖扩张' } : (g > r && g > b2 && g > 100) ? { w: '青绿', e: '木', en: '生命力/疏解' } : (b2 > r && b2 > g && b2 > 100) ? { w: '蓝/深色', e: '水', en: '深邃储藏' } : (r > 150 && g > 100 && b2 < 100) ? { w: '黄/琥珀', e: '土', en: '中正稳定' } : (r > 220 && g > 220 && b2 > 200) ? { w: '白/透明', e: '金', en: '肃静收敛' } : (r > 200 && g > 100 && b2 > 100 && r > g) ? { w: '粉红', e: '火', en: '柔和觉醒' } : (r > 100 && g > 60 && b2 < 60) ? { w: '棕/琥珀', e: '土', en: '厚重稳定' } : { w: '黄/琥珀', e: '土', en: '中正稳定' };
    const color = {
        physical: { primary_color: wx.w, hex: mHex, transparency: mT >= 8 ? '透明' : mT >= 5 ? '半透明' : '不透明', brightness: mT >= 7 ? '明亮' : mT >= 4 ? '中等' : '深沉' },
        philosophy: { wuxing_color: wx.w, wuxing_element: wx.e, energy_type: wx.en, description: `${wx.w}对应${wx.e}气，${wx.en}` }
    };

    // 5. 时序
    const estAbv = Math.round(vi.reduce((s, it) => s + it.data.abv * (it.ml / tot), 0));
    let temporality;
    if (srv.s >= 2) temporality = { physical: { ideal_hours: ['19:00-22:00'], ideal_shichen: '戌时', ideal_seasons: ['秋', '冬'], ideal_solar_terms: ['寒露', '霜降', '立冬', '小雪', '大雪'], description: '热饮适合秋冬夜晚温补' }, philosophy: { heaven_human_logic: '秋冬主收藏，阳气内敛，以温热饮助阳归元', description: '顺应天时收藏之令，温补元阳' } };
    else if (estAbv >= 25) temporality = { physical: { ideal_hours: ['19:00-23:00'], ideal_shichen: '戌时、亥时', ideal_seasons: ['秋', '冬', '四季皆宜'], ideal_solar_terms: ['秋分', '立冬', '小雪'], description: '烈酒适合夜间慢饮，秋冬尤佳' }, philosophy: { heaven_human_logic: '日暮阳收，借烈酒温阳之力，助阳气归元不散', description: '夜间阳藏阴生，温阳固本' } };
    else if (dom === 'sour') temporality = { physical: { ideal_hours: ['14:00-19:00'], ideal_shichen: '未时、申时', ideal_seasons: ['夏', '初秋'], ideal_solar_terms: ['小暑', '大暑', '立秋'], description: '酸味冰饮消暑，适合夏季午后' }, philosophy: { heaven_human_logic: '夏日阳盛于外，以酸收敛浮阳，防汗出过多伤阴', description: '酸收夏阳，固护阴液' } };
    else if (dom === 'bitter') temporality = { physical: { ideal_hours: ['17:00-19:00'], ideal_shichen: '酉时', ideal_seasons: ['夏', '秋'], ideal_solar_terms: ['立夏', '小满', '芒种'], description: '苦味开胃饮品适合傍晚餐前' }, philosophy: { heaven_human_logic: '酉时阳气初降，苦味清泄白日积累之心火', description: '日落清心，苦降火气' } };
    else if (dom === 'sweet') temporality = { physical: { ideal_hours: ['14:00-20:00'], ideal_shichen: '未时至酉时', ideal_seasons: ['四季皆宜'], ideal_solar_terms: ['各节气均可'], description: '甜味饮品四季皆宜，午后至傍晚最佳' }, philosophy: { heaven_human_logic: '甘入脾土居中，不偏不倚，四时皆可补中益气', description: '土为万物之母，甘味补中' } };
    else temporality = { physical: { ideal_hours: ['17:00-22:00'], ideal_shichen: '酉时、戌时', ideal_seasons: ['四季皆宜'], ideal_solar_terms: ['各节气均可'], description: '傍晚至夜间饮用' }, philosophy: { heaven_human_logic: '日落后阳收阴生，饮品助人从动态转入静态', description: '顺应昼夜节律' } };

    // 6. 嗅觉
    const allA = new Set(); items.forEach(it => (it.data.aroma || []).forEach(a => allA.add(a)));
    const aList = [...allA], pA = aList.slice(0, 3), sA = aList.slice(3);
    const mers = new Set(), acts = new Set(); aList.forEach(a => { if (AROMA_MER[a]) { mers.add(AROMA_MER[a].m); acts.add(AROMA_MER[a].a); } });
    const aI = Math.min(10, Math.round(items.reduce((s, it) => s + (it.data.aroma || []).length, 0) / items.length * 3));
    const aroma = {
        physical: { primary_aromas: pA.map(a => AROMA_CN[a] || a), secondary_aromas: sA.map(a => AROMA_CN[a] || a), aroma_intensity: aI, description: `主要香气: ${pA.map(a => AROMA_CN[a] || a).join('、')}` },
        philosophy: { meridian_target: [...mers].join('、') || '脾经', therapeutic_action: [...acts].join('、') || '健脾益气', description: `${[...mers].join('、')}经络，${[...acts].join('、')}` }
    };

    // 7. 比例
    const spM = vi.filter(it => it.data.cat === 'spirit').reduce((s, it) => s + it.ml, 0);
    const lqM = vi.filter(it => it.data.cat === 'liqueur').reduce((s, it) => s + it.ml, 0);
    const juM = vi.filter(it => it.data.cat === 'juice').reduce((s, it) => s + it.ml, 0);
    const spR = Math.round(spM / tot * 100) / 100, mdR = Math.round(lqM / tot * 100) / 100, juR = Math.round(juM / tot * 100) / 100;
    const intL = estAbv >= 30 ? '强' : estAbv >= 20 ? '中偏强' : estAbv >= 10 ? '中等' : '柔和';
    const balL = spR >= 0.8 ? '纯阳重剂' : spR >= 0.5 ? '阳中带阴' : Math.abs(spR - juR) < 0.15 ? '中庸调和' : juR > spR ? '滋阴柔和' : '刚柔并济';
    const ratio = {
        physical: { spirit_ratio: spR, modifier_ratio: mdR, juice_ratio: juR, estimated_abv: estAbv, description: `烈酒${Math.round(spR * 100)}%，利口酒${Math.round(mdR * 100)}%，果汁${Math.round(juR * 100)}%，ABV≈${estAbv}%` },
        philosophy: { energy_intensity: intL, wuxing_balance: balL, description: `能量强度: ${intL}，${balL}` }
    };

    // 8. 动作
    const pActs = [], preps = [];
    for (const [kw, cn] of Object.entries(ACTION_MAP)) {
        if (inst.includes(kw)) { if (['rim', 'garnish'].includes(kw)) preps.push(cn); else pActs.push(cn); }
    }
    if (!pActs.length) pActs.push(ACTION_MAP.pour);
    const tActs = ['啜(sip)']; if (/flame|layer|float/.test(inst)) tActs.unshift('观(gaze)');
    const medT = pActs.some(a => a.includes('摇')) ? '动态冥想' : pActs.some(a => a.includes('捣')) ? '宣泄冥想' : pActs.some(a => a.includes('搅')) ? '静观冥想' : pActs.some(a => a.includes('融')) ? '融合冥想' : '自在冥想';
    const ritual = {
        physical: { primary_actions: pActs, preparation_actions: preps, tasting_actions: tActs, description: `主要动作: ${pActs.join('、')}` },
        philosophy: { ritual_meaning: pActs.map(cn => { const k = Object.keys(ACTION_MAP).find(k2 => ACTION_MAP[k2] === cn); return `${cn.split('(')[0]} = ${ACTION_PHI[k] || '当下感知'}`; }).join('；'), meditation_type: medT, description: `${medT}` }
    };

    return { taste, texture, temperature, color, temporality, aroma, ratio, ritual };
}

// ═══ 提取八维匹配向量 ═══
// 八维: [味觉, 触觉, 温度, 颜色, 时序, 嗅觉, 比例, 动作]
// 每维一个代表性数值

const WUXING_INDEX = { '木': 1, '火': 2, '土': 3, '金': 4, '水': 5 };
const MEDIT_INDEX = { '动态冥想': 1, '宣泄冥想': 2, '静观冥想': 3, '融合冥想': 4, '自在冥想': 5 };
// 时序数值化: 将适饮时段映射为 0-23 的中值小时数
function temporalityScore(temp) {
    const h = temp.physical.ideal_hours?.[0] || '17:00-22:00';
    const m = h.match(/(\d+):00.*?(\d+):00/);
    return m ? Math.round((parseInt(m[1]) + parseInt(m[2])) / 2) : 19;
}

function extractVector(dim) {
    // 1. 味觉: 主味的分值 (0-10)
    const tasteVals = [dim.taste.physical.sour, dim.taste.physical.bitter, dim.taste.physical.sweet, dim.taste.physical.spicy, dim.taste.physical.salty];
    const dominantScore = Math.max(...tasteVals);

    // 2. 触觉: 气机方向值 (上浮3, 散发1~2, 平和0, 内敛-3)
    const qiVal = dim.texture.philosophy.qi_direction === '上浮' ? 3 : dim.texture.philosophy.qi_direction === '外散' ? 2 : dim.texture.philosophy.qi_direction === '散发' ? 1 : dim.texture.philosophy.qi_direction === '内敛' ? -3 : 0;

    // 3. 温度: 阴阳分 (-5 ~ 5)
    const yinyang = dim.temperature.philosophy.yin_yang_score;

    // 4. 颜色: 五行元素 (木1 火2 土3 金4 水5)
    const wuxing = WUXING_INDEX[dim.color.philosophy.wuxing_element] || 3;

    // 5. 时序: 适饮时段中值小时 (0-23)
    const temporal = temporalityScore(dim.temporality);

    // 6. 嗅觉: 香气强度 (0-10)
    const aromaInt = dim.aroma.physical.aroma_intensity;

    // 7. 比例: 预估ABV% (0-95)
    const abv = dim.ratio.physical.estimated_abv;

    // 8. 动作: 冥想类型 (动态1 宣泄2 静观3 融合4 自在5)
    const meditation = MEDIT_INDEX[dim.ritual.philosophy.meditation_type] || 5;

    return [dominantScore, qiVal, yinyang, wuxing, temporal, aromaInt, abv, meditation];
}

// ═══ API 拉取 ═══

async function fetchJson(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API ${res.status}`);
            return res.json();
        } catch (e) {
            if (attempt === retries) throw e;
            await new Promise(r => setTimeout(r, 1000 * attempt)); // 递增等待
        }
    }
}

async function getAllDrinks() {
    // a-z + 0-9 覆盖所有首字母（数字开头的饮品如 "110 in the shade" 等）
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    const all = [];
    const BATCH = 3, DELAY = 800; // 小批量+长间隔，避免限流
    for (let i = 0; i < chars.length; i += BATCH) {
        const batch = chars.slice(i, i + BATCH);
        process.stdout.write(`  拉取 ${batch.join(',')}...`);
        const ps = batch.map(l => fetchJson(`${BASE_URL}/search.php?f=${l}`).then(d => d.drinks || []).catch(() => []));
        const rs = await Promise.all(ps);
        const count = rs.flat().length;
        all.push(...rs.flat());
        console.log(` ${count} 款`);
        if (i + BATCH < chars.length) await new Promise(r => setTimeout(r, DELAY));
    }
    const seen = new Set();
    return all.filter(d => { if (!d || seen.has(d.idDrink)) return false; seen.add(d.idDrink); return true; });
}

// ═══ 主流程 ═══

async function main() {
    console.log('═══ 八维数据批量生成 → 双层存储 ═══\n');

    const { getIngredientData, isKnown } = loadKnowledgeBase();
    console.log('✓ 配料知识库加载完成\n');

    // 1. 拉取
    console.log('[1/3] 拉取 CocktailDB 全部饮品...');
    const allDrinks = await getAllDrinks();
    console.log(`  共 ${allDrinks.length} 款\n`);

    // 2. 计算
    console.log('[2/3] 计算八维数据...');
    // 注: dimensionData 已在生产环境中被移除（未使用但占用 ~57KB）
    // 如需重新启用，请参考历史提交或文档
    const vectorData = {};      // 匹配向量（实际使用）
    let ok = 0, fail = 0;
    let totalIng = 0, knownIng = 0;
    const unknown = new Set();

    for (const drink of allDrinks) {
        try {
            const dim = computeDimensions(drink, getIngredientData);
            if (!dim) { fail++; continue; }
            const id = drink.idDrink;
            // ⬇️ 只生成向量，不保存完整八维数据
            vectorData[id] = {
                name: drink.strDrink,
                v: extractVector(dim),
            };
            ok++;
            // 统计
            for (let i = 1; i <= 15; i++) {
                const ing = drink[`strIngredient${i}`]; if (!ing || !ing.trim()) break;
                totalIng++; if (isKnown(ing)) knownIng++; else unknown.add(ing.trim());
            }
        } catch (e) { fail++; }
    }
    console.log(`  成功:${ok} 失败:${fail}`);
    console.log(`  配料命中率: ${totalIng > 0 ? (knownIng / totalIng * 100).toFixed(1) : 0}% (${knownIng}/${totalIng})`);
    if (unknown.size > 0) console.log(`  未精确匹配: ${unknown.size} 种`);
    console.log();

    // 3. 输出
    console.log('[3/3] 生成向量存储文件...');

    // drinkVectors.js — 匹配向量（实际使用）

/**
 * 余弦相似度计算
 * @param {number[]} a - 用户情绪向量
 * @param {number[]} b - 饮品向量
 * @returns {number} 相似度 0~1
 */
export function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 匹配 Top N 饮品
 * @param {number[]} userVector - 用户情绪映射的 12 维向量
 * @param {number} topN - 返回前 N 个匹配结果 (默认 15)
 * @returns {Array<{id: string, name: string, score: number}>}
 */
export function matchTopDrinks(userVector, topN = 15) {
  const scores = Object.entries(drinkVectors).map(([id, data]) => ({
    id,
    name: data.name,
    score: cosineSimilarity(userVector, data.v),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}

export default drinkVectors;
`;
    writeFileSync(join(SRC_DATA, 'drinkVectors.js'), vecJS, 'utf-8');
    console.log(`  ✓ src/data/drinkVectors.js (${(Buffer.byteLength(vecJS) / 1024).toFixed(0)} KB)`);

    console.log('\n═══ 完成 ═══');
    console.log(`✓ ${ok} 款饮品向量生成成功`);
    console.log(`✗ ${fail} 款饮品生成失败`);
    console.log(`配料命中率: ${totalIng > 0 ? (knownIng / totalIng * 100).toFixed(1) : 0}% (${knownIng}/${totalIng})`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

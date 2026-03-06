/**
 * 东方哲学标签生成器 (Philosophy Tags Generator v2.0 - 五行生克版)
 * 抛弃随机伪散列，基于用户心境(User_Qi)与饮品物理特性(Drink_Qi)的底层五行映射。
 */

// === 1. 五行生克推演矩阵 ===
// 关系定义：[Drink_Qi][User_Qi] 
// 含义：这杯酒(Drink) 对 用户(User) 起了什么作用？
// 生 (Drink生User) / 被生 (User生Drink) / 克 (Drink克User) / 被克 (User克Drink) / 同 (同气相求)
const WUXING_RELATIONS = {
    // 饮品为木 (酸收条达)
    '木': {
        '水': { relation: '被生', logic: '水生木', desc: '以生发之气，唤醒沉迷的深渊' },
        '火': { relation: '生', logic: '木生火', desc: '顺着火势，把体内淤堵一并散尽' },
        '木': { relation: '同', logic: '木遇木', desc: '同气相求，让躁动找到最佳出口' },
        '金': { relation: '被克', logic: '金克木', desc: '以酸楚的生机，破除肃杀的死局' },
        '土': { relation: '克', logic: '木克土', desc: '像竹根破石，以锐利之酸劈开泥沼' },
    },
    // 饮品为火 (辛热升散)
    '火': {
        '木': { relation: '被生', logic: '木生火', desc: '借你的火种，点燃这杯灼热的狂欢' },
        '土': { relation: '生', logic: '火生土', desc: '以温热之力，烘暖冰冷的郁结' },
        '火': { relation: '同', logic: '火遇火', desc: '不灭你的火，以火引火，烧透方休' },
        '水': { relation: '被克', logic: '水克火', desc: '以极端的灼热，对抗彻骨的寒凉' },
        '金': { relation: '克', logic: '火克金', desc: '烈火熔金，强制化解紧绷的防线' },
    },
    // 饮品为土 (甘厚养中)
    '土': {
        '火': { relation: '被生', logic: '火生土', desc: '承接所有的升散，将它们落地为安' },
        '金': { relation: '生', logic: '土生金', desc: '厚德载物，孕育出重新出发的锋芒' },
        '土': { relation: '同', logic: '土遇土', desc: '两相宽厚，在这里你可以绝对安全' },
        '木': { relation: '被克', logic: '木克土', desc: '以甘厚之味，把所有锋利悉数裹住' },
        '水': { relation: '克', logic: '土克水', desc: '筑起堤坝，拦住四散溃逃的精力' },
    },
    // 饮品为金 (辛凉肃清)
    '金': {
        '土': { relation: '被生', logic: '土生金', desc: '从浑浊泥土中，萃取出最纯粹的凛冽' },
        '水': { relation: '生', logic: '金生水', desc: '以收敛之气，化为滋养心神的第一滴露' },
        '金': { relation: '同', logic: '金遇金', desc: '极致的孤冷，是此刻最懂你的知音' },
        '火': { relation: '被克', logic: '火克金', desc: '借肃杀之心，强行切断内心的灼烧' },
        '木': { relation: '克', logic: '金克木', desc: '像秋面西风，以肃杀之气收住疯长' },
    },
    // 饮品为水 (苦寒沉降)
    '水': {
        '金': { relation: '被生', logic: '金生水', desc: '承接所有锋芒，化作绕指的柔波' },
        '木': { relation: '生', logic: '水生木', desc: '像根下的深泉，以沉静养住躁动' },
        '水': { relation: '同', logic: '水遇水', desc: '深海的拥抱，让疲惫彻底下沉' },
        '土': { relation: '被克', logic: '土克水', desc: '以苦寒的底色，湿润板结的内心' },
        '火': { relation: '克', logic: '水克火', desc: '以彻骨的冰潭，强制扑灭无名邪火' },
    }
};

// === 2. 五行话术文案库 (Minimalist Poetic Style) ===
// 结构：quotes[User_Qi][Relation] -> []
// 原则：8-12字，诗意凝练，节奏感强
const QUOTE_LIBRARY = {
    '木': { // 用户情绪属木（怒/烦躁/想发泄）
        '生': [
            '「借烈散郁，酣畅淋漓」',
            '「火势燎原，烦忧尽散」',
            '「一饮灼心，郁结皆空」'
        ],
        '克': [
            '「辛凉收锋，躁气自平」',
            '「凛冽入喉，烦丝斩断」',
            '「清凉一饮，边界自守」'
        ],
        '同': [
            '「同气相求，锋芒共释」',
            '「酸涩共振，懂你所向」',
            '「陪你劈开，这漫漫长夜」'
        ],
        '被生': [
            '「苦水沉降，锚定心神」',
            '「深泉静养，躁气自消」',
            '「沉静之味，悬崖之锚」'
        ],
        '被克': [
            '「甘柔化锋，一饮皆平」',
            '「甜润入心，怒火自熄」',
            '「宽厚之味，安稳降落」'
        ]
    },
    '火': { // 用户情绪属火（喜/亢奋/嗨/气血上冲）
        '生': [
            '「甘润落地，飘然归宁」',
            '「甜厚承接，亢奋有终」',
            '「温润入腹，心神自安」'
        ],
        '克': [
            '「苦寒一饮，邪火自熄」',
            '「冰潭入喉，躁动皆止」',
            '「极冷镇心，狂热自平」'
        ],
        '同': [
            '「以火引火，烧透方休」',
            '「烈火烹油，今夜无刹」',
            '「同频灼热，致敬狂欢」'
        ],
        '被生': [
            '「酸爽添柴，火势更旺」',
            '「生机托举，灵魂高飞」',
            '「果香一点，火上浇花」'
        ],
        '被克': [
            '「烈火熔金，破局有方」',
            '「以热破冰，锋芒毕露」',
            '「灼热之势，融化冰层」'
        ]
    },
    '土': { // 用户情绪属土（思/焦虑/内耗/郁结）
        '生': [
            '「甘中藏锋，破茧而出」',
            '「甜润护刃，刺破虚妄」',
            '「厚德载物，锋芒渐露」'
        ],
        '克': [
            '「酸锐破网，困局自开」',
            '「竹根破石，泥沼自散」',
            '「酸收之味，撕开焦虑」'
        ],
        '同': [
            '「两相宽厚，卸下防备」',
            '「甜润包容，接纳狼狈」',
            '「柔软筑墙，挡风遮雨」'
        ],
        '被生': [
            '「温热落地，焦虑归宁」',
            '「火种入心，淤堵自化」',
            '「烤暖思绪，温暖归宿」'
        ],
        '被克': [
            '「苦堤拦水，精力归拢」',
            '「深海静流，淹没喧嚣」',
            '「物理下沉，心智自稳」'
        ]
    },
    '金': { // 用户情绪属金（悲/低落/空）
        '生': [
            '「收敛成露，滋养心神」',
            '「悲凉凝结，沉潜成诗」',
            '「落花成酿，舍不得尽」'
        ],
        '克': [
            '「烈酒一盏，斩断忧思」',
            '「灼热穿喉，打断悲歌」',
            '「以暴制暴，忧思尽断」'
        ],
        '同': [
            '「孤冷相遇，无言相懂」',
            '「辛凉碰杯，破碎共鸣」',
            '「不劝快乐，陪你枯坐」'
        ],
        '被生': [
            '「土中萃冽，懂你所悲」',
            '「甘甜御寒，风雪稍歇」',
            '「悲凉尽头，一丝回甘」'
        ],
        '被克': [
            '「酸生悸动，枯木逢春」',
            '「生发之味，死局自破」',
            '「刺痛为证，曾经活过」'
        ]
    },
    '水': { // 用户情绪属水（恐/疲惫/虚/透支）
        '生': [
            '「生发之气，深渊开花」',
            '「顺水推舟，疲惫化养」',
            '「木赖水生，躯壳开花」'
        ],
        '克': [
            '「甘厚筑堤，挡住无力」',
            '「甜润绵长，填平沟壑」',
            '「脾胃之暖，对抗彻骨」'
        ],
        '同': [
            '「深海拥抱，允许下沉」',
            '「同向寒渊，累了就沉」',
            '「苦寒相依，懂你所疲」'
        ],
        '被生': [
            '「锋芒化波，温柔绕指」',
            '「肃杀成冰，身躯自凝」',
            '「收拢心神，苦水回正」'
        ],
        '被克': [
            '「灼热驱寒，骨中寒夜散」',
            '「冰火拉扯，生命回升」',
            '「沸煮深寒，热汗重生」'
        ]
    }
};

/**
 * 确定用户的五行属性 (天时病灶)
 */
function determineUserWuXing(moodData) {
    if (!moodData) return '土'; // 默认状态(平和平庸)

    const intensities = {
        somatic: moodData.somatic?.physical?.intensity || 0,
        emotion: moodData.emotion?.physical?.intensity || 0,
        cognitive: moodData.cognitive?.physical?.intensity || 0,
        demand: moodData.demand?.physical?.intensity || 0,
        time: moodData.time?.physical?.intensity || 0
    };

    // 找出强度最大的维度
    const maxKey = Object.keys(intensities).reduce((a, b) => intensities[a] > intensities[b] ? a : b);

    // 如果极弱(测试或者空白)，兜底为土
    if (intensities[maxKey] === 0) return '土';

    // 基于最大维度和内含感情色彩判断
    if (maxKey === 'demand') {
        // 想发泄、打破常规
        return '木';
    }
    if (maxKey === 'emotion') {
        const taste = moodData.emotion?.drinkMapping?.tasteScore || 5;
        // 如果想要甜，或者颜色鲜艳，倾向于火（正面亢奋）；否则倾向于金（悲伤低落收敛）
        if (taste >= 5) return '火';
        else return '金';
    }
    if (maxKey === 'cognitive') {
        // 思虑内耗
        return '土';
    }
    if (maxKey === 'somatic') {
        // 躯体疲惫透支
        return '水';
    }

    return '土'; // time 兜底
}

/**
 * 确定饮品的五行属性 (地利药引)
 */
function determineDrinkWuXing(dimensions) {
    const t = dimensions.taste || { sweet: 0, bitter: 0, sour: 0, spicy: 0 };
    const r = dimensions.ratio?.physical || { estimated_abv: 0 };
    const temp = dimensions.temperature || { value: 0 };
    const aroma = dimensions.aroma || 0;
    const soma = dimensions.texture || { thickness: 0 };

    // 木：味觉偏酸 + 香气强 (酸收条达)
    if (t.sour > 3 && aroma > 5) return '木';

    // 火：温度高 或 烈度高 (辛热升散)
    if (temp.value > 2 || r.estimated_abv > 35) return '火';

    // 土：味觉偏甜 + 质地厚 (甘厚养中)
    if (t.sweet >= 4 && soma.thickness >= 1) return '土';

    // 金：香气强 + 质地薄而凛冽 (辛凉肃清)
    if (aroma > 6 && soma.thickness < 0) return '金';

    // 水：味觉偏苦 或 温度偏低 (苦寒沉降)
    if (t.bitter > 3 || temp.value <= -2) return '水';

    // 默认中正兜底
    return '土';
}

/**
 * 核心暴露函数
 */
export function generatePhilosophyTags(dimensions, moodData = null, drinkName = '') {
    // 保护性回退
    if (!dimensions || !dimensions.taste) {
        return {
            tags: ['混沌初开', '未知羁绊'],
            quote: '「探索本身，即是抚平情绪的最佳良药」'
        };
    }

    const userQi = determineUserWuXing(moodData);
    const drinkQi = determineDrinkWuXing(dimensions);

    // 获取五行相互作用结果矩阵
    const relationResult = WUXING_RELATIONS[drinkQi][userQi];
    const relationType = relationResult.relation;

    // 构造 Tags (Minimalist Poetic Style)
    const tags = [];
    const seed = drinkName ? drinkName.length + (drinkName.charCodeAt(0) || 0) : Math.random() * 100;
    
    // 主标签：感官体验描述（味觉 + 质地）
    const t = dimensions.taste;
    const temp = dimensions.temperature?.value || 0;
    const abv = dimensions.ratio?.physical?.estimated_abv || 0;
    const aroma = dimensions.aroma || 0;
    
    // 构建感官标签池
    const sensoryTags = [];
    
    // 味觉维度标签
    if (t.sour > 3) sensoryTags.push('微酸 · 回甘', '酸爽开窍', '酸收条达');
    if (t.sweet > 4) sensoryTags.push('甘润 · 绵长', '甜柔入心', '甘厚养中');
    if (t.bitter > 3) sensoryTags.push('清苦 · 回甘', '苦尽甘来', '苦寒清热');
    if (t.spicy > 2) sensoryTags.push('辛香 · 通透', '微辛开窍', '辛热升散');
    
    // 温度维度标签
    if (temp > 2) sensoryTags.push('温热 · 暖腹', '暖意入喉', '温热升散');
    if (temp < -2) sensoryTags.push('冰冽 · 沁心', '极寒沉降', '清凉入髓');
    if (temp >= -2 && temp <= 2) sensoryTags.push('温润 · 平和', '常温 · 中正', '平和入胃');
    
    // 酒感维度标签
    if (abv > 35) sensoryTags.push('烈酒 · 灼心', '醇厚 · 有力', '烈而回甘');
    if (abv > 15 && abv <= 35) sensoryTags.push('微醺 · 刚好', '酒感 · 适中', '醇和 · 温润');
    if (abv <= 15 && abv > 0) sensoryTags.push('轻酒 · 柔和', '微醺 · 轻盈', '淡而有味');
    if (abv === 0) sensoryTags.push('无酒 · 清润', '纯粹 · 自然', '清润 · 养人');
    
    // 香气维度标签
    if (aroma > 7) sensoryTags.push('异香 · 通窍', '馥郁 · 芬芳', '香韵 · 悠长');
    if (aroma > 4 && aroma <= 7) sensoryTags.push('清香 · 淡雅', '幽香 · 宜人', '香而不艳');
    
    // 五行关系诗意标签
    const relationPoeticTags = {
        '生': '相生 · 相养',
        '克': '相制 · 相衡', 
        '同': '同气 · 相求',
        '被生': '被养 · 得助',
        '被克': '被制 · 得安'
    };
    
    // 选择标签：1个感官标签 + 1个关系标签
    if (sensoryTags.length > 0) {
        tags.push(sensoryTags[seed % sensoryTags.length]);
    } else {
        // 兜底感官标签
        const fallbackSensory = ['温润 · 平和', '甘润 · 绵长', '清冽 · 回甘', '柔和 · 顺滑'];
        tags.push(fallbackSensory[seed % fallbackSensory.length]);
    }
    
    tags.push(relationPoeticTags[relationType] || '相生 · 相养');
    
    // 补充风味副标签
    const flavorSubTags = [];
    if (drinkQi === '木') flavorSubTags.push('木性 · 条达', '生发 · 之气', '酸收 · 养肝');
    if (drinkQi === '火') flavorSubTags.push('火性 · 炎上', '温热 · 升散', '辛热 · 暖心');
    if (drinkQi === '土') flavorSubTags.push('土德 · 载物', '甘厚 · 养中', '厚重 · 安稳');
    if (drinkQi === '金') flavorSubTags.push('金气 · 收敛', '辛凉 · 肃清', '凛冽 · 通窍');
    if (drinkQi === '水') flavorSubTags.push('水性 · 润下', '苦寒 · 沉降', '沉静 · 养肾');
    
    if (flavorSubTags.length > 0) {
        tags.push(flavorSubTags[seed % flavorSubTags.length]);
    }

    // 生成洗牌种子 (虽然不用它来保证差异化，但用来从确定的五行库中取不一样的变体句式)
    const quoteSeed = drinkName ? drinkName.length + (drinkName.charCodeAt(0) || 0) + (drinkName.charCodeAt(drinkName.length - 1) || 0) : Math.random() * 100;

    // 从矩阵金库中提取 Quote 数组
    const candidateQuotes = QUOTE_LIBRARY[userQi][relationType];
    const finalQuote = candidateQuotes[quoteSeed % candidateQuotes.length] || candidateQuotes[0];

    return {
        tags: Array.from(new Set(tags)).slice(0, 3),
        quote: finalQuote
    };
}

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

// === 2. 五行话术文案库 ===
// 结构：quotes[User_Qi][Relation] -> []
const QUOTE_LIBRARY = {
    '木': { // 用户情绪属木（怒/烦躁/想发泄）
        '生': [
            '「顺着这股火势，把体内淤堵一并散尽」',
            '「燃起心火，将烦躁连根拔起烧个痛快」',
            '「借着它的烈，让郁结随着酒精尽数挥发」'
        ],
        '克': [
            '「像秋天的西风，以肃杀之气收住疯长的乱麻」',
            '「凛冽落胃，强行斩断纠缠不休的烦丝」',
            '「借一缕辛凉，收摄住你快要失控的边界」'
        ],
        '同': [
            '「同气相求，让躁动在这里找到对冲的出口」',
            '「酸涩共振，它是懂你此刻锋芒的同类」',
            '「你想要冲撞，这杯酒便陪你一起劈开这长夜」'
        ],
        '被生': [
            '「像根下的深泉，以沉静之味养住躁定的气」',
            '「苦水沉降，从源头熄灭你肝火的升腾」',
            '「冰冷的底色，是你情绪悬崖边的锚点」'
        ],
        '被克': [
            '「以甘厚之味，把所有锋利尖锐悉数裹住」',
            '「泥土的包容，足以掩埋任何形式的怒火」',
            '「这杯宽厚的甜，是你烦躁时最安稳的降落伞」'
        ]
    },
    '火': { // 用户情绪属火（喜/亢奋/嗨/气血上冲）
        '生': [
            '「以温热之力，将浮散的情绪沉淀为长久的安宁」',
            '「落入凡尘的甘甜，稳稳接住你此刻的飘然」',
            '「亢奋过后，这杯厚重是你最佳的着陆垫」'
        ],
        '克': [
            '「以彻骨的冰潭，强制扑灭多余的无名邪火」',
            '「一记苦寒，镇压住四肢百骸过剩的躁动」',
            '「用极度的冷静，对抗正在燃烧的极限」'
        ],
        '同': [
            '「不灭你的火，以火引火，烧透了方休」',
            '「烈火烹油，今夜的反叛不需要刹车」',
            '「同样的灼热，是对你狂欢最原始的致敬」'
        ],
        '被生': [
            '「以条达的酸楚，给你过火的情绪添一把新柴」',
            '「木能生火，让这股野蛮的生命力再飞一会」',
            '「一点果香的生机，托住了你高涨的灵魂」'
        ],
        '被克': [
            '「烈火熔金，借高涨的气势冲破一切旧有规矩」',
            '「以火炼金，此刻的亢奋自带破局的锋芒」',
            '「用绝对的热度，融化任何试图封锁你的冰层」'
        ]
    },
    '土': { // 用户情绪属土（思/焦虑/内耗/郁结）
        '生': [
            '「厚德载物，孕育出让你重新出发的锋芒」',
            '「在甘甜的保护下，长出刺破虚妄的利刃」',
            '「告别内耗的泥沼，提炼出一口凛冽的清醒」'
        ],
        '克': [
            '「像竹根破石，以锐利之酸劈开闷住你的泥沼」',
            '「酸收之味，强行撕开焦虑编结的巨网」',
            '「借一点穿透性的刺激，打破画地为牢的困局」'
        ],
        '同': [
            '「两相宽厚，在这里你可以放下所有的防备」',
            '「无需证明什么，这杯甜润能接纳你的所有狼狈」',
            '「柔软地裹挟焦虑，用厚重为你筑一道挡风的墙」'
        ],
        '被生': [
            '「承接它热烈的升散，将飘忽不定的焦虑落地为安」',
            '「借着它的火种，化解凝结在心头的淤堵」',
            '「烤暖这片冷透的土地，给思绪一个温暖的归宿」'
        ],
        '被克': [
            '「筑起苦涩的堤坝，拦住四散溃逃的精力」',
            '「用深海的安静，淹没头脑里喋喋不休的争吵」',
            '「让它物理的下沉，拖住你正不断下坠的心智」'
        ]
    },
    '金': { // 用户情绪属金（悲/低落/空）
        '生': [
            '「以收敛之气，化为滋养心神的第一滴露水」',
            '「将四散的悲凉凝结，滴落成一杯纯粹的沉潜」',
            '「落花有情，将所有的舍不得酿成这杯苦水」'
        ],
        '克': [
            '「借烈火一盏，强行切断这无休止的悲从中来」',
            '「灼热贯穿喉管，用物理的痛觉打断情绪的走马灯」',
            '「以暴制暴，烈酒是你斩断忧思的最佳利刃」'
        ],
        '同': [
            '「极致的孤冷，是此刻最懂你的无言知音」',
            '「辛凉交汇，两个破碎的灵魂在这里碰杯」',
            '「我不劝你快乐，我用更加肃杀的冷陪你枯坐」'
        ],
        '被生': [
            '「从浑浊泥土中，萃取出最懂你悲悯的凛冽」',
            '「借一点多余的甘甜，稍稍抵挡风雪的侵袭」',
            '「厚积薄发，悲凉的尽头总会有一丝回甘」'
        ],
        '被克': [
            '「以酸楚的生机，破除这份无欲无求的死局」',
            '「借生发之味，让干涸的枯木再感受一次悸动」',
            '「总要有些刺痛，才能证明我们曾经努力活过」'
        ]
    },
    '水': { // 用户情绪属水（恐/疲惫/虚/透支）
        '生': [
            '「以生发之气，唤醒沉迷深渊里的那一朵芽」',
            '「顺水推舟，将疲惫转化为下一场进化的养料」',
            '「木赖水生，你的一具躯壳在此刻开出了花」'
        ],
        '克': [
            '「筑起厚土高墙，挡下即将把你淹没的无力感」',
            '「以甘厚绵长之味，填平你被掏空的体力沟壑」',
            '「脾胃的暖甜，是对抗彻骨透支的终极堡垒」'
        ],
        '同': [
            '「深海的拥抱，允许你今夜在这里彻底下沉」',
            '「同向寒渊，别硬挺了，累了就沉下去吧」',
            '「苦寒相依，最懂你疲惫的只有同样的深邃」'
        ],
        '被生': [
            '「承接那些外露的锋芒，化作绕指的温柔波光」',
            '「汲取肃杀的力量，让虚弱的身躯重新凝结成冰」',
            '「收拢心神，化入这口苦水之中慢慢回正」'
        ],
        '被克': [
            '「以极端的灼热，驱散浸透在骨骼深处的寒夜」',
            '「冰与火的拉扯，强行拉升你跌入谷底的生命体征」',
            '「沸煮深寒，逼迫出一身热汗方能涅槃重生」'
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
    const relationType = relationResult.relation; // 生, 克, 同, 被生, 被克
    const logicDesc = relationResult.logic;       // "木生火", "金克木"

    // 构造 Tags
    const tags = [];
    tags.push(`${userQi}命${drinkQi}骨`);
    tags.push(logicDesc);

    // 补充物理副标签辅助理解
    const t = dimensions.taste;
    if (drinkQi === '木' && t.sour > 3) tags.push('大酸收敛');
    if (drinkQi === '火' && dimensions.ratio?.physical?.estimated_abv > 35) tags.push('烈酒发散');
    if (drinkQi === '土' && t.sweet > 4) tags.push('甘厚绵长');
    if (drinkQi === '水' && dimensions.temperature?.value < -2) tags.push('极寒沉降');
    if (drinkQi === '金' && dimensions.aroma > 7) tags.push('异香通窍');

    // 生成洗牌种子 (虽然不用它来保证差异化，但用来从确定的五行库中取不一样的变体句式)
    const seed = drinkName ? drinkName.length + (drinkName.charCodeAt(0) || 0) + (drinkName.charCodeAt(drinkName.length - 1) || 0) : Math.random() * 100;

    // 从矩阵金库中提取 Quote 数组
    const candidateQuotes = QUOTE_LIBRARY[userQi][relationType];
    const finalQuote = candidateQuotes[seed % candidateQuotes.length] || candidateQuotes[0];

    return {
        tags: Array.from(new Set(tags)).slice(0, 3),
        quote: finalQuote
    };
}

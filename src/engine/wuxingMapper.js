/**
 * 饮品五行映射器
 * 根据饮品的物理特征确定其五行属性
 */

/**
 * 确定饮品的五行属性
 * @param {Object} dimensions - 饮品的物理维度
 * @returns {String} 五行: wood/fire/earth/metal/water
 */
export function determineDrinkWuXing(dimensions) {
    if (!dimensions) return 'earth';
    
    const { taste, temperature, aroma, ratio } = dimensions;
    
    // 五行分数
    let scores = {
        wood: 0,   // 木 - 酸、青色、升发
        fire: 0,   // 火 - 苦、红色、炎热
        earth: 0,  // 土 - 甘、黄色、厚重
        metal: 0,  // 金 - 辛、白色、收敛
        water: 0   // 水 - 咸、黑色、沉降
    };
    
    // 味觉维度
    if (taste?.sour > 3) scores.wood += 3;
    if (taste?.bitter > 3) scores.fire += 3;
    if (taste?.sweet > 4) scores.earth += 3;
    if (taste?.spicy > 2) scores.metal += 3;
    if (taste?.salty > 2) scores.water += 2;
    
    // 温度维度
    const temp = temperature?.value || 0;
    if (temp > 2) scores.fire += 2;  // 温热 -> 火
    if (temp < -2) scores.water += 2; // 冰凉 -> 水
    
    // 香气维度
    const aromaScore = aroma?.value || aroma || 0;
    if (aromaScore > 7) scores.metal += 2; // 浓郁 -> 金（收敛）
    if (aromaScore > 4 && aromaScore <= 7) scores.wood += 1; // 清香 -> 木（生发）
    
    // 酒精度/烈度
    const abv = ratio?.physical?.estimated_abv || ratio || 0;
    if (abv > 35) scores.fire += 2;  // 高度 -> 火
    if (abv > 15 && abv <= 35) scores.metal += 1; // 中度 -> 金
    if (abv <= 15 && abv > 0) scores.wood += 1; // 低度 -> 木
    if (abv === 0) scores.water += 2; // 无酒精 -> 水
    
    // 找出最高分
    let maxScore = 0;
    let result = 'earth'; // 默认
    
    Object.entries(scores).forEach(([element, score]) => {
        if (score > maxScore) {
            maxScore = score;
            result = element;
        }
    });
    
    return result;
}

/**
 * 五行名称映射
 */
export const WUXING_NAMES = {
    wood: '木',
    fire: '火',
    earth: '土',
    metal: '金',
    water: '水'
};

/**
 * 五行相生相克关系
 */
export const WUXING_RELATIONS = {
    // 木生火 -> 火生土 -> 土生金 -> 金生水 -> 水生木
    '生': ['木火', '火土', '土金', '金水', '水木'],
    // 木克土 -> 土克水 -> 水克火 -> 火克金 -> 金克木
    '克': ['木土', '土水', '水火', '火金', '金木']
};

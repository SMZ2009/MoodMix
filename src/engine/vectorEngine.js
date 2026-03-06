import { drinkVectors } from '../data/drinkVectors';

// 维度敏感度系数 (kappa)
const KAPPA = {
    somatic: 2.0,     // 躯体信号 生理不适最高优先级 -> [触觉、温度、比例]
    demand: 1.8,      // 诉求信号 明确意图强优先级 -> [动作、比例]
    emotion: 1.5,     // 情绪信号 情志病灶中优先级 -> [味觉、颜色]
    cognitive: 1.2,   // 认知信号 心理状态次优先级 -> [嗅觉、味觉]
    timeContext: 1.0  // 社交/时间 背景变量低优先级 -> [时序]
};

// 基础权重 W_base
const BASE_WEIGHTS = {
    taste: 1.0,
    texture: 1.0,
    temperature: 1.0,
    color: 1.0,
    temporality: 1.0,
    aroma: 1.0,
    ratio: 1.0,
    action: 1.0
};

/**
 * 根据大模型给出的信号强度(I)计算动态权重 W_final
 * @param {Object} moodData - 六维分析结果
 * @returns {Array} 8维特征的动态权重数组 [W_taste, W_texture, W_temperature, W_color, W_temporality, W_aroma, W_ratio, W_action]
 */
export function computeDynamicWeights(moodData) {
    // 1. 获取模型返回的各维度强度 I (0.0-1.0)
    const I_som = moodData.somatic?.physical?.intensity || 0.0;
    const I_dem = moodData.demand?.physical?.intensity || 0.0;
    const I_emo = moodData.emotion?.physical?.intensity || 0.0;
    const I_cog = moodData.cognitive?.physical?.intensity || 0.0;
    const I_time = Math.max(moodData.time?.physical?.intensity || 0.0, moodData.socialContext?.physical?.intensity || 0.0);

    // 2. 将信号累加至 8 维画像基准值 W'
    let W = { ...BASE_WEIGHTS };

    // 躯体 (Somatic) -> 触觉(1), 温度(2), 比例(6), 动作(7)
    W.texture += KAPPA.somatic * I_som;
    W.temperature += KAPPA.somatic * I_som;
    W.ratio += KAPPA.somatic * I_som * 0.5;

    // 诉求 (Demand) -> 动作(7), 比例(6)
    W.action += KAPPA.demand * I_dem;
    W.ratio += KAPPA.demand * I_dem * 0.5;

    // 情绪 (Emotion) -> 味觉(0), 颜色(3)
    W.taste += KAPPA.emotion * I_emo;
    W.color += KAPPA.emotion * I_emo;

    // 认知 (Cognitive) -> 嗅觉(5), 味觉(0)
    W.aroma += KAPPA.cognitive * I_cog;
    W.taste += KAPPA.cognitive * I_cog * 0.5;

    // 环境/时间 (Context) -> 时序(4)
    W.temporality += KAPPA.timeContext * I_time;

    // 3. 转化为数组
    const rawWeights = [
        W.taste,        // 0: 味觉
        W.texture,      // 1: 触觉
        W.temperature,  // 2: 温度
        W.color,        // 3: 颜色
        W.temporality,  // 4: 时序
        W.aroma,        // 5: 嗅觉
        W.ratio,        // 6: 比例
        W.action        // 7: 动作
    ];

    // 4. 归一化 (确保总和1)
    const sumWeights = rawWeights.reduce((a, b) => a + b, 0);
    const normalized = rawWeights.map(w => w / sumWeights);

    console.log('[VectorEngine] 提取的信号强度:', { I_som, I_dem, I_emo, I_cog, I_time });
    console.log('[VectorEngine] 归一化后的动态权重:', normalized);

    return normalized;
}

/**
 * 构造用户的需求向量 (用于余弦相似度计算)
 */
export function buildUserVector(moodData) {
    const v = new Array(8).fill(0);
    // 0: 味觉: 0-10
    v[0] = moodData.emotion?.drinkMapping?.tasteScore ?? 5;
    // 1: 触觉: -3~3
    v[1] = moodData.somatic?.drinkMapping?.textureScore ?? 0;
    // 2: 温度: -5~5
    v[2] = moodData.somatic?.drinkMapping?.temperature ?? 0;
    // 3: 颜色: 1-5
    v[3] = moodData.emotion?.drinkMapping?.colorCode ?? 3;
    // 4: 时序: 0-23
    v[4] = moodData.time?.drinkMapping?.temporality ?? 12;
    // 5: 嗅觉: 0-10
    v[5] = moodData.cognitive?.drinkMapping?.aromaScore ?? 5;
    // 6: 比例(ABV): 0-95
    v[6] = Math.max(moodData.socialContext?.drinkMapping?.ratioScore ?? 0, 15);
    // 7: 动作: 1-5
    v[7] = Math.max(moodData.demand?.drinkMapping?.actionScore ?? 0, moodData.socialContext?.drinkMapping?.actionScore ?? 0) || 2;

    return v;
}

/**
 * 计算加权余弦相似度
 */
function weightedCosineSimilarity(u, v, weights) {
    let dotProduct = 0;
    let normU = 0;
    let normV = 0;

    for (let i = 0; i < 8; i++) {
        const w = weights[i];

        // 对时序(4) 和 颜色(3) 做环形与差值换算为相似量级
        let v_i = v[i];
        let u_i = u[i];

        if (i === 4) { // 时序(temporality: 0-23)
            let diff = Math.abs(u_i - v_i);
            if (diff > 12) diff = 24 - diff;
            v_i = 12 - diff;
            u_i = 12; // 理想最大相似度基准
        } else if (i === 3) { // 颜色(1-5)
            let diff = Math.abs(u_i - v_i);
            v_i = 4 - diff;
            u_i = 4;
        } else if (i === 1 || i === 2) { // 触觉(-3~3), 温度(-5~5)
            // 差值转换为正收益
            let maxRange = i === 1 ? 6 : 10;
            let diff = Math.abs(u_i - v_i);
            v_i = maxRange - diff;
            u_i = maxRange;
        }

        dotProduct += w * u_i * v_i;
        normU += w * u_i * u_i;
        normV += w * v_i * v_i;
    }

    if (normU === 0 || normV === 0) return 0;
    return dotProduct / (Math.sqrt(normU) * Math.sqrt(normV));
}

/**
 * 第1&2&3步：进行双轨过滤 + 加权计算矩阵推荐
 */
export function evaluateAndSortDrinks(moodData, allDrinks, sessionIngredients) {
    const dynamicWeights = computeDynamicWeights(moodData);
    const userVector = buildUserVector(moodData);

    console.groupCollapsed('🍹 [VectorEngine] 新一轮推荐匹配开始');
    console.log('📌 动态维度权重 (Dynamic Weights):', dynamicWeights);
    console.log('👤 用户情绪与需求映射向量 (User Vector):', userVector);
    console.log('📦 当前用户可用库存 (Inventory):', sessionIngredients);

    const inventorySet = new Set(sessionIngredients.map(i => i.toLowerCase()));

    // 防弹设计：如果传来的数据池是空的，证明 API 还没载完，立刻返回具有合法字段的安全占位
    if (!allDrinks || allDrinks.length === 0) {
        console.warn('⚠️ [VectorEngine] 获取到的饮品池为空！已派发占位缓冲数据。');
        return [{
            id: 'loading_placeholder_001',
            name: '探索未知的配方中...',
            name_cn: '探索未知的配方中...',
            image: '',
            abv: 0,
            ingredients: [],
            missingCount: 0,
            missingItems: [],
            isReadyToMake: false,
            similarityScore: 0
        }];
    }

    const evaluatedBasePool = [];

    for (const drink of allDrinks) {
        // ID 兼容处理 (API 返回的是字母开头如 api_11000)
        let vectorId = drink.id;
        if (typeof vectorId === 'string' && vectorId.startsWith('api_')) {
            vectorId = vectorId.replace('api_', '');
        }

        // 如果连向量库都没有，赋予一个基准向量而不是直接 continue 丢弃
        let v = drinkVectors[vectorId] ? drinkVectors[vectorId].v : [5, 0, 0, 3, 12, 5, 15, 3];

        // 核心修复：如果传进来的 drink 没有自带的 abv (如来自之前旧版本的缓存或不完整的 fallback)，
        // 则强制从由全量配料推导出的离线缓存向量 (index 6 记录的是 ABV) 中提取
        if (!drink.abv || drink.abv === 0) {
            drink.abv = v[6];
        }

        // 取配料列表：兼容 data/drinks.js 中的结构 (ingredients 包含 name 或者 briefIngredients)
        const ingredientsArray = drink.ingredients || drink.briefIngredients || [];

        // 分析缺失
        let missingCount = 0;
        const missingItems = [];
        for (const req of ingredientsArray) {
            // 提供多字段兼容查找（中文、英文、label）
            const searchNames = [req.name, req.nameEn, req.label, req.name_cn, req.name_en].filter(Boolean).map(n => n.toLowerCase());

            // 只要有一个命中库存，就算有货
            const isOwned = searchNames.some(name => inventorySet.has(name));

            if (!isOwned) {
                missingCount++;
                missingItems.push(req.name || req.nameEn || req.label);
            }
        }

        const isReadyToMake = missingCount === 0;

        let similarity = weightedCosineSimilarity(userVector, v, dynamicWeights);

        // 为库存齐备度设置渐进式加分激励 (0: +0.15, 1: +0.08, 2: +0.03, >=3: +0)
        let bonus = 0;
        if (missingCount === 0) bonus = 0.15;
        else if (missingCount === 1) bonus = 0.08;
        else if (missingCount === 2) bonus = 0.03;

        similarity += bonus;

        const evaluatedItem = {
            ...drink,
            missingCount,
            missingItems,
            isReadyToMake,
            similarityScore: similarity
        };

        evaluatedBasePool.push(evaluatedItem);
    }

    // 全局统一降序：无论是缺料0还是缺料5，凭借 (基础向量分 + 库存齐备加分) 统一大混排
    evaluatedBasePool.sort((a, b) => b.similarityScore - a.similarityScore);

    console.log(`📊 过滤结果: 统一加权混合排序完成，总计共 ${evaluatedBasePool.length} 款`);

    let finalPool = evaluatedBasePool;

    // 前端只取前 15
    const top15 = finalPool.slice(0, 15);

    console.log('🏆 Top 15 最终推荐结果排行:');
    top15.forEach((d, i) => {
        console.log(
            `%c[#${i + 1}] %c${d.name || d.name_cn || d.name_en} ` +
            `%c(得分: ${(d.similarityScore * 100).toFixed(2)}%) ` +
            `%c| 缺失数量: ${d.missingCount} ` +
            (d.missingCount > 0 ? `| 缺: [${d.missingItems.join(', ')}]` : '| 🎉 100% 齐备'),
            'font-weight:bold; color: #8B5CF6;',
            'font-weight:bold; color: #333;',
            'color: #10B981;',
            d.missingCount === 0 ? 'color: #3B82F6;' : (d.missingCount <= 2 ? 'color: #F59E0B;' : 'color: #EF4444;')
        );
    });
    console.groupEnd();

    return top15;
}

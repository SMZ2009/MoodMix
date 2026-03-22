let drinkVectorsCache = null;

/** 稳定哈希：用于在相似度极度接近时打散排序，避免每次同一批酒固定占 Top9 */
function hash32(str) {
    const s = String(str ?? '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

async function loadDrinkVectors() {
    if (drinkVectorsCache) return drinkVectorsCache;
    const mod = await import('../data/drinkVectors');
    drinkVectorsCache = mod.drinkVectors || mod.default || {};
    return drinkVectorsCache;
}

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
 * 辨证结论映射到检索向量：用户五行 → 颜色维 (1–5)。
 * 流式 LLM 常给 drinkMapping.colorCode≈3，若仅做 0.5 混合，火/水/土 的 v[3] 仍接近 3，Top9 几乎不变。
 * 因此：只要有辨证五行，颜色维以辨证为准覆盖；并用 summary+盐微调时序维打散近并列。
 */
function applyPatternAnalysisToUserVector(v, patternAnalysis, moodData, rankingSalt = '') {
    if (!patternAnalysis?.wuxing?.user) return v;
    const w = patternAnalysis.wuxing.user;
    const colorByWuxing = { wood: 1, fire: 2, earth: 3, metal: 4, water: 5 };
    const cc = colorByWuxing[w];
    if (cc == null) return v;

    const hasMapping =
        moodData?.emotion?.drinkMapping?.colorCode != null ||
        moodData?.emotion?.drinkMapping?.tasteScore != null;

    // 颜色维：辨证优先（否则与 LLM 默认 colorCode 叠加后几乎恒为 3）
    v[3] = cc;

    const pol = patternAnalysis.polarity?.type;
    const st = patternAnalysis.strategy?.type;
    if (!hasMapping) {
        if (pol === 'positive') v[0] = Math.min(10, (v[0] || 5) + 0.5);
        else if (pol === 'negative') v[0] = Math.max(0, (v[0] || 5) - 0.5);
        if (st === 'counter') v[7] = Math.min(5, Math.max(1, Math.round((v[7] || 2) + 1)));
        else if (st === 'resonate') v[7] = Math.min(5, Math.max(1, Math.round((v[7] || 2) - 1)));
    } else {
        if (st === 'counter') v[7] = Math.min(5, Math.max(1, Math.round((v[7] || 2) + 0.5)));
        else if (st === 'resonate') v[7] = Math.min(5, Math.max(1, Math.round((v[7] || 2) - 0.5)));
    }

    const tShift = (hash32(String(moodData?.summary || '') + w + String(rankingSalt || '')) % 9) - 4;
    v[4] = Math.max(0, Math.min(23, Math.round((v[4] || 12) + tShift)));

    return v;
}

/**
 * 用户原文盐：微调味觉/质地/温度维，使同一辨证下换文案仍改变检索排序。
 */
function applyRankingSaltPerturbation(v, rankingSalt, summary) {
    const h = hash32(String(rankingSalt || '') + String(summary || ''));
    const d0 = ((h % 21) - 10) / 10;
    const d1 = (((h >> 7) % 11) - 5) / 5;
    const d2 = (((h >> 15) % 13) - 6) / 3;
    v[0] = Math.max(0, Math.min(10, (v[0] ?? 5) + d0));
    v[1] = Math.max(-3, Math.min(3, (v[1] ?? 0) + d1));
    v[2] = Math.max(-5, Math.min(5, (v[2] ?? 0) + d2));
}

function l1Distance8(a, b) {
    if (!a || !b || a.length < 8 || b.length < 8) return 0;
    let s = 0;
    for (let i = 0; i < 8; i++) s += Math.abs(a[i] - b[i]);
    return s;
}

/**
 * 从前 poolSize 名中贪心选 k 款：已选集合内饮品离线向量两两尽量远，减少「同一风味簇占满 Top9」。
 */
function diversifyByEmbedding(sortedPool, k, poolSize) {
    const pool = sortedPool.slice(0, Math.min(poolSize, sortedPool.length));
    if (pool.length <= k) return pool.map(stripEmbed);
    const selected = [pool[0]];
    const rest = pool.slice(1);
    while (selected.length < k && rest.length) {
        let bestI = 0;
        let bestScore = -Infinity;
        for (let i = 0; i < rest.length; i++) {
            const cand = rest[i];
            const emb = cand.embeddingVector;
            let minD = Infinity;
            for (const s of selected) {
                const d = l1Distance8(emb, s.embeddingVector);
                if (d < minD) minD = d;
            }
            const score = minD + cand.similarityScore * 8;
            if (score > bestScore) {
                bestScore = score;
                bestI = i;
            }
        }
        selected.push(rest.splice(bestI, 1)[0]);
    }
    return selected.map(stripEmbed);
}

function stripEmbed(item) {
    const { embeddingVector: _, ...rest } = item;
    return rest;
}

/**
 * 构造用户的需求向量 (用于余弦相似度计算)
 * @param {Object|null} patternAnalysis - 可选；有则合并五行/策略到向量，避免仅靠默认 drinkMapping
 * @param {string} rankingSalt - 用户原始输入等，用于时序微扰
 */
export function buildUserVector(moodData, patternAnalysis = null, rankingSalt = '') {
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

    applyPatternAnalysisToUserVector(v, patternAnalysis, moodData, rankingSalt);
    applyRankingSaltPerturbation(v, rankingSalt, moodData?.summary);
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
export async function evaluateAndSortDrinks(
    moodData,
    allDrinks,
    sessionIngredients,
    patternAnalysis = null,
    rankingSalt = ''
) {
    const drinkVectors = await loadDrinkVectors();
    const dynamicWeights = computeDynamicWeights(moodData);
    const userVector = buildUserVector(moodData, patternAnalysis, rankingSalt);

    const moodSig = JSON.stringify({
        em: moodData?.emotion?.physical?.intensity,
        so: moodData?.somatic?.physical?.intensity,
        co: moodData?.cognitive?.physical?.intensity,
        de: moodData?.demand?.physical?.intensity,
        ti: moodData?.time?.physical?.intensity,
        sc: moodData?.socialContext?.physical?.intensity,
        sum: moodData?.summary,
        pw: patternAnalysis?.wuxing?.user,
        st: patternAnalysis?.strategy?.type,
    });
    const moodHash = hash32(moodSig);

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
        const hasOfflineVec = !!(drinkVectors[vectorId] && drinkVectors[vectorId].v);
        let v = hasOfflineVec ? drinkVectors[vectorId].v : [5, 0, 0, 3, 12, 5, 15, 3];

        // 核心修复：如果传进来的 drink 没有自带的 abv (如来自之前旧版本的缓存或不完整的 fallback)，
        // 则强制从由全量配料推导出的离线缓存向量 (index 6 记录的是 ABV) 中提取
        if (!drink.abv || drink.abv === 0) {
            drink.abv = v[6];
        }

        // 取配料列表：兼容 data/drinks.js 中的结构 (ingredients 包含 name 或者 briefIngredients)
        const ingredientsArray = drink.ingredients || drink.briefIngredients || [];

        let similarity = weightedCosineSimilarity(userVector, v, dynamicWeights);
        // 心境签名 × 饮品 ID 微扰：分数大量并列时仍能保持不同输入下的排序差异
        const dHash = hash32(String(vectorId) + moodSig);
        similarity += ((moodHash ^ dHash) % 2001 - 1000) / 1e6;

        // 只有在 DIY 模式（传入了有效库存）时才分析原料缺失情况
        const hasInventory = sessionIngredients && sessionIngredients.length > 0;
        let missingCount;
        let missingItems;
        let isReadyToMake;

        if (hasInventory) {
            missingCount = 0;
            missingItems = [];
            for (const req of ingredientsArray) {
                const searchNames = [req.name, req.nameEn, req.label, req.name_cn, req.name_en].filter(Boolean).map(n => n.toLowerCase());
                const isOwned = searchNames.some(name => inventorySet.has(name));
                if (!isOwned) {
                    missingCount++;
                    missingItems.push(req.name || req.nameEn || req.label);
                }
            }
            isReadyToMake = missingCount === 0;

            // 为库存齐备度设置渐进式加分激励 (0: +0.15, 1: +0.08, 2: +0.03, >=3: +0)
            if (missingCount === 0) similarity += 0.15;
            else if (missingCount === 1) similarity += 0.08;
            else if (missingCount === 2) similarity += 0.03;
        }

        const evaluatedItem = {
            ...drink,
            ...(hasInventory ? { missingCount, missingItems, isReadyToMake } : {}),
            similarityScore: similarity,
            embeddingVector: v.slice(),
        };

        evaluatedBasePool.push(evaluatedItem);
    }

    // 全局统一降序：无论是缺料0还是缺料5，凭借 (基础向量分 + 库存齐备加分) 统一大混排
    evaluatedBasePool.sort((a, b) => b.similarityScore - a.similarityScore);

    console.log(`📊 过滤结果: 统一加权混合排序完成，总计共 ${evaluatedBasePool.length} 款`);

    let finalPool = evaluatedBasePool;

    const pickMode = !sessionIngredients || sessionIngredients.length === 0;
    const top9 =
        pickMode && finalPool.length > 9
            ? diversifyByEmbedding(finalPool, 9, 40)
            : finalPool.slice(0, 9);

    console.log('🏆 Top 9 最终推荐结果排行:');
    top9.forEach((d, i) => {
        console.log(
            `%c[#${i + 1}] %c${d.name || d.name_cn || d.name_en} ` +
            `%c(得分: ${(d.similarityScore * 100).toFixed(2)}%) ` +
            `%c${d.isReadyToMake !== undefined ? `| 缺失数量: ${d.missingCount} ` + (d.missingCount > 0 ? `| 缺: [${d.missingItems.join(', ')}]` : '| 🎉 100% 齐备') : '| 寻一杯模式（不检查库存）'}`,
            'font-weight:bold; color: #8B5CF6;',
            'font-weight:bold; color: #333;',
            'color: #10B981;',
            d.isReadyToMake === undefined ? 'color: #9CA3AF;' : (d.missingCount === 0 ? 'color: #3B82F6;' : (d.missingCount <= 2 ? 'color: #F59E0B;' : 'color: #EF4444;'))
        );
    });
    console.groupEnd();

    return top9;
}

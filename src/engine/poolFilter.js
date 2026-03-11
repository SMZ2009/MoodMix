/**
 * PoolFilter - 候选池过滤器
 * 
 * 根据提取的实体过滤饮品池，缩小搜索范围
 * 同时保持与现有向量匹配算法的兼容性
 */

import { fuzzyMatch } from './entityExtractor';

/**
 * 过滤饮品池
 * @param {Array} allDrinks - 全量饮品列表
 * @param {Object} entities - 提取的实体
 * @param {Object} options - 配置选项
 * @returns {Object} 过滤结果
 */
export function filterDrinkPool(allDrinks, entities, options = {}) {
  const {
    maxPoolSize = 50,           // 过滤后最大池大小
    minPoolSize = 10,           // 最小保证数量
    fuzzyThreshold = 0.6,       // 模糊匹配阈值
    enableFallback = true       // 无匹配时是否回退全量
  } = options;
  
  // 如果没有任何实体，返回全量池
  if (!hasEntities(entities)) {
    return {
      filtered: allDrinks,
      filterApplied: false,
      reason: 'no_entities_detected',
      stats: { total: allDrinks.length, filtered: allDrinks.length }
    };
  }
  
  // 计算每个饮品的匹配分数
  const scoredDrinks = allDrinks.map(drink => {
    const score = calculateFilterScore(drink, entities, fuzzyThreshold);
    const matchReasons = score > 0 ? getMatchReasons(drink, entities) : [];
    return { drink, score, matchReasons };
  });
  
  // 按分数排序，过滤出有分数的
  const filtered = scoredDrinks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoolSize);
  
  // 如果过滤结果太少，启用回退策略
  if (filtered.length < minPoolSize && enableFallback) {
    // 如果有任何匹配结果，使用它们（即使少于minPoolSize）
    if (filtered.length > 0) {
      console.log(`│    - 找到 ${filtered.length} 款匹配饮品（少于最小要求${minPoolSize}款，但仍使用）`);
      return {
        filtered: filtered.map(item => ({
          ...item.drink,
          _filterScore: item.score,
          _matchReasons: item.matchReasons
        })),
        filterApplied: true,
        reason: 'partial_match',
        stats: { 
          total: allDrinks.length, 
          filtered: filtered.length,
          topMatches: getTopMatchesStats(filtered)
        }
      };
    }
    
    // 回退策略: 放宽匹配条件
    const relaxedFiltered = scoredDrinks
      .filter(item => item.score > 0 || hasPartialMatch(item.drink, entities))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPoolSize);
    
    if (relaxedFiltered.length >= minPoolSize) {
      return {
        filtered: relaxedFiltered.map(item => ({
          ...item.drink,
          _filterScore: item.score,
          _matchReasons: item.matchReasons
        })),
        filterApplied: true,
        reason: 'relaxed_match',
        stats: { 
          total: allDrinks.length, 
          filtered: relaxedFiltered.length,
          topMatches: getTopMatchesStats(relaxedFiltered)
        }
      };
    }
    
    // 回退策略2: 返回全量池
    return {
      filtered: allDrinks,
      filterApplied: false,
      reason: 'fallback_to_full_pool',
      stats: { 
        total: allDrinks.length,
        attempted: filtered.length, 
        required: minPoolSize 
      }
    };
  }
  
  return {
    filtered: filtered.map(item => ({
      ...item.drink,
      _filterScore: item.score,
      _matchReasons: item.matchReasons
    })),
    filterApplied: true,
    reason: 'entity_match',
    stats: {
      total: allDrinks.length,
      filtered: filtered.length,
      topMatches: getTopMatchesStats(filtered)
    }
  };
}

/**
 * 检查是否有提取到的实体
 */
function hasEntities(entities) {
  return entities && (
    entities.drinkNames?.length > 0 || 
    entities.categories?.length > 0 || 
    entities.flavors?.length > 0
  );
}

/**
 * 计算饮品的过滤匹配分数
 */
function calculateFilterScore(drink, entities, fuzzyThreshold) {
  let score = 0;
  
  const drinkName = (drink.name || '').toLowerCase();
  const drinkNameEn = (drink.nameEn || '').toLowerCase();
  const drinkCategory = (drink.category || '').toLowerCase();
  const drinkTags = (drink.tags || []).map(t => t.toLowerCase());
  const drinkIngredients = (drink.ingredients || [])
    .map(i => ((i.name || '') + ' ' + (i.name_cn || '')).toLowerCase())
    .join(' ');
  const drinkDesc = ((drink.description || '') + ' ' + (drink.taste || '')).toLowerCase();
  
  // 1. 精确饮品名匹配 (最高权重: 100分)
  for (const { key, matched } of (entities.drinkNames || [])) {
    const matchedLower = matched.toLowerCase();
    
    // 精确匹配
    if (drinkName.includes(matchedLower) || drinkNameEn.includes(matchedLower)) {
      score += 100;
      continue;
    }
    
    // 模糊匹配饮品名
    const fuzzyNameResult = fuzzyMatch(matched, drink.name, fuzzyThreshold);
    const fuzzyNameEnResult = fuzzyMatch(matched, drink.nameEn || '', fuzzyThreshold);
    
    if (fuzzyNameResult.match) {
      score += Math.round(60 * fuzzyNameResult.similarity);
    } else if (fuzzyNameEnResult.match) {
      score += Math.round(60 * fuzzyNameEnResult.similarity);
    }
  }
  
  // 2. 品类匹配 (中等权重: 30分)
  for (const { key, matched } of (entities.categories || [])) {
    const matchedLower = matched.toLowerCase();
    
    // 品类字段匹配
    if (drinkCategory.includes(matchedLower)) {
      score += 30;
      continue;
    }
    
    // 标签匹配
    if (drinkTags.some(t => t.includes(matchedLower))) {
      score += 25;
      continue;
    }
    
    // 特殊品类逻辑
    if (key === 'mocktail' && drink.abv === 0) {
      score += 30;
    } else if (key === 'cocktail' && drink.abv > 0) {
      score += 15;
    } else if (key === 'shot' && drink.abv > 30) {
      score += 20;
    } else if (key === 'whiskey' && drinkIngredients.includes('威士忌')) {
      score += 25;
    } else if (key === 'gin' && drinkIngredients.includes('金酒')) {
      score += 25;
    } else if (key === 'rum' && drinkIngredients.includes('朗姆')) {
      score += 25;
    } else if (key === 'vodka' && drinkIngredients.includes('伏特加')) {
      score += 25;
    } else if (key === 'tequila' && drinkIngredients.includes('龙舌兰')) {
      score += 25;
    } else if (key === 'tea') {
      // 茶类特殊处理：检查名称、原料、描述中是否包含茶相关关键词
      const teaKeywords = ['茶', 'tea', '抹茶', 'matcha', '红茶', 'black tea', '绿茶', 'green tea', '乌龙', 'oolong', '奶茶'];
      const allDrinkText = (drinkName + ' ' + drinkNameEn + ' ' + drinkIngredients + ' ' + drinkDesc + ' ' + drinkCategory).toLowerCase();
      if (teaKeywords.some(kw => allDrinkText.includes(kw.toLowerCase()))) {
        score += 30;
      }
    } else if (key === 'coffee') {
      // 咖啡类特殊处理
      const coffeeKeywords = ['咖啡', 'coffee', 'espresso', '拿铁', 'latte', '美式', 'americano', '卡布奇诺', 'cappuccino'];
      const allDrinkText = (drinkName + ' ' + drinkNameEn + ' ' + drinkIngredients + ' ' + drinkDesc + ' ' + drinkCategory).toLowerCase();
      if (coffeeKeywords.some(kw => allDrinkText.includes(kw.toLowerCase()))) {
        score += 30;
      }
    }
  }
  
  // 3. 风味/原料匹配 (基础权重: 15分)
  for (const { key, matched } of (entities.flavors || [])) {
    const matchedLower = matched.toLowerCase();
    
    // 原料匹配
    if (drinkIngredients.includes(matchedLower)) {
      score += 20;
      continue;
    }
    
    // 描述匹配
    if (drinkDesc.includes(matchedLower)) {
      score += 15;
      continue;
    }
    
    // 标签匹配
    if (drinkTags.some(t => t.includes(matchedLower))) {
      score += 12;
      continue;
    }
    
    // 特殊风味逻辑
    if (key === 'sweet' && drink.dimensions?.sweetness?.value > 3) {
      score += 10;
    } else if (key === 'sour' && drink.dimensions?.sourness?.value > 3) {
      score += 10;
    } else if (key === 'bitter' && drink.dimensions?.bitterness?.value > 3) {
      score += 10;
    } else if (key === 'ice' && drink.dimensions?.temperature?.value < 0) {
      score += 10;
    } else if (key === 'hot' && drink.dimensions?.temperature?.value > 2) {
      score += 10;
    }
  }
  
  return score;
}

/**
 * 获取匹配原因
 */
function getMatchReasons(drink, entities) {
  const reasons = [];
  
  const drinkName = (drink.name || '').toLowerCase();
  const drinkNameEn = (drink.nameEn || '').toLowerCase();
  const drinkCategory = (drink.category || '').toLowerCase();
  const drinkTags = (drink.tags || []).map(t => t.toLowerCase());
  const drinkIngredients = (drink.ingredients || [])
    .map(i => ((i.name || '') + ' ' + (i.name_cn || '')).toLowerCase())
    .join(' ');
  
  for (const { matched } of (entities.drinkNames || [])) {
    if (drinkName.includes(matched.toLowerCase()) || 
        drinkNameEn.includes(matched.toLowerCase())) {
      reasons.push(`饮品名: ${matched}`);
    }
  }
  
  for (const { matched } of (entities.categories || [])) {
    if (drinkCategory.includes(matched.toLowerCase()) ||
        drinkTags.some(t => t.includes(matched.toLowerCase()))) {
      reasons.push(`品类: ${matched}`);
    }
  }
  
  for (const { matched } of (entities.flavors || [])) {
    if (drinkIngredients.includes(matched.toLowerCase())) {
      reasons.push(`原料: ${matched}`);
    }
  }
  
  return reasons;
}

/**
 * 宽松匹配检查
 */
function hasPartialMatch(drink, entities) {
  const allText = [
    drink.name, 
    drink.nameEn, 
    drink.category,
    ...(drink.tags || []),
    ...(drink.ingredients || []).map(i => i.name || i.name_cn)
  ].filter(Boolean).join(' ').toLowerCase();
  
  const allKeywords = [
    ...(entities.drinkNames || []).map(e => e.matched),
    ...(entities.categories || []).map(e => e.matched),
    ...(entities.flavors || []).map(e => e.matched)
  ];
  
  // 检查是否有任何部分匹配 (至少前2个字符)
  return allKeywords.some(kw => {
    const prefix = kw.toLowerCase().slice(0, 2);
    return prefix.length >= 2 && allText.includes(prefix);
  });
}

/**
 * 获取Top匹配统计
 */
function getTopMatchesStats(filtered) {
  return filtered.slice(0, 5).map(item => ({
    name: item.drink.name,
    score: item.score,
    reasons: item.matchReasons
  }));
}

/**
 * 直接通过名称搜索饮品 (用于精确搜索场景)
 */
export function searchDrinkByName(allDrinks, searchName, options = {}) {
  const { fuzzyThreshold = 0.7, maxResults = 10 } = options;
  const searchLower = searchName.toLowerCase();
  
  const results = allDrinks
    .map(drink => {
      const nameLower = (drink.name || '').toLowerCase();
      const nameEnLower = (drink.nameEn || '').toLowerCase();
      
      // 精确匹配
      if (nameLower === searchLower || nameEnLower === searchLower) {
        return { drink, score: 100, matchType: 'exact' };
      }
      
      // 包含匹配
      if (nameLower.includes(searchLower) || nameEnLower.includes(searchLower)) {
        return { drink, score: 80, matchType: 'contains' };
      }
      
      // 模糊匹配
      const fuzzyName = fuzzyMatch(searchName, drink.name, fuzzyThreshold);
      const fuzzyNameEn = fuzzyMatch(searchName, drink.nameEn || '', fuzzyThreshold);
      
      if (fuzzyName.match) {
        return { drink, score: Math.round(60 * fuzzyName.similarity), matchType: 'fuzzy' };
      }
      if (fuzzyNameEn.match) {
        return { drink, score: Math.round(60 * fuzzyNameEn.similarity), matchType: 'fuzzy' };
      }
      
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  return results;
}

export default {
  filterDrinkPool,
  searchDrinkByName
};

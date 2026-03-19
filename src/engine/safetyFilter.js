/**
 * 安全硬拦截 — 前置于首屏渲染，纯本地规则，<10ms
 * 被剔除的饮品用候选池中下一个补位
 *
 * @param {Array} topDrinks - 向量匹配后的 Top N 饮品
 * @param {Object} moodData - ComprehensiveAnalyzer 输出的情绪数据
 * @param {Array} fallbackPool - 完整的已排序候选池（用于补位）
 * @returns {Array} 安全过滤后的饮品列表
 */
export function safetyFilter(topDrinks, moodData, fallbackPool) {
  if (!topDrinks || topDrinks.length === 0) return topDrinks;

  const isExtremeNegative = moodData?.isNegative
    && moodData.emotion?.physical?.intensity > 0.8;
  const hour = new Date().getHours();
  const isLateNight = hour >= 22 || hour < 6;

  const isSafe = (drink) => {
    // 规则1：极端负面情绪 + 高酒精（>40%）→ 剔除
    if (isExtremeNegative && (drink.dimensions?.abv ?? drink.abv ?? 0) > 40) {
      return false;
    }
    // 规则2：深夜22点-早6点 + 高咖啡因 → 剔除
    if (isLateNight && (drink.dimensions?.caffeine ?? 0) > 0.8) {
      return false;
    }
    // 规则3：高温（热饮）+ 高酒精（>35%）→ 过于刺激，剔除
    if ((drink.dimensions?.temperature ?? 0) > 3
      && (drink.dimensions?.abv ?? drink.abv ?? 0) > 35) {
      return false;
    }
    return true;
  };

  const filtered = topDrinks.filter(isSafe);

  const removedCount = topDrinks.length - filtered.length;
  if (removedCount > 0 && fallbackPool && fallbackPool.length > 0) {
    const existingIds = new Set(filtered.map(d => d.id));
    const safeBackfill = fallbackPool
      .filter(d => !existingIds.has(d.id) && isSafe(d))
      .slice(0, removedCount);
    filtered.push(...safeBackfill);
  }

  return filtered;
}

export default safetyFilter;

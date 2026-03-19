/**
 * Agent 3: ValidatorOptimizer — 质量评估（异步后置，不阻塞 UI）
 *
 * 两层设计中的第二层：
 *   第一层（safetyFilter）已在首屏渲染前同步完成。
 *   本模块在首屏渲染后异步执行，为每款推荐饮品输出：
 *     - 心境契合度百分比
 *     - 一句话解读
 *
 * 评估维度（3 项）:
 *   | 评估项         | 实现方式                         | 权重 |
 *   |---------------|----------------------------------|------|
 *   | 五行生克验证    | LLM — 推荐饮品五行是否克用户五行    | 0.4  |
 *   | 情绪-饮品一致性 | LLM — 用户意图和推荐方向是否矛盾    | 0.4  |
 *   | 时段适饮性      | 本地规则 — 当前时间和饮品类型是否匹配 | 0.2  |
 */

import { BaseAgent } from '../core/BaseAgent';

// ─── 本地时段适饮评分 ────────────────────────────────────────

function calcTimeScore(drink, hour) {
  const abv = drink.dimensions?.abv ?? drink.abv ?? 0;
  const caffeine = drink.dimensions?.caffeine ?? 0;

  if (hour >= 6 && hour <= 10) {
    if (caffeine > 0.5) return 90;
    if (abv > 10) return 40;
    return 70;
  }
  if (hour >= 14 && hour <= 17) {
    if (caffeine > 0.3) return 85;
    return 70;
  }
  if (hour >= 18 && hour <= 22) {
    if (abv > 0 && abv <= 30) return 85;
    return 70;
  }
  return 70;
}

// ─── 综合评分 ────────────────────────────────────────────────

function calcFinalScore(wuxingScore, emotionScore, timeScore) {
  return Math.round(wuxingScore * 0.4 + emotionScore * 0.4 + timeScore * 0.2);
}

// ─── 分数 → 一句话解读 ──────────────────────────────────────

function getScoreComment(score) {
  if (score >= 85) return '五行相生，恰合此刻心境';
  if (score >= 70) return '气韵相近，略有未尽之意';
  if (score >= 50) return '缘虽不深，亦可浅尝一试';
  return '此味尚远，容我再为你寻';
}

// ─── 单款饮品评估 ────────────────────────────────────────────

async function evaluateDrink(drink, moodData) {
  const hour = new Date().getHours();
  const timeScore = calcTimeScore(drink, hour);

  let wuxingScore = 75;
  let emotionScore = 75;

  try {
    const response = await fetch('/api/quality-eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moodSummary: moodData?.summary || moodData?.moodData?.summary || '',
        userWuxing: moodData?.patternAnalysis?.wuxing?.user || '',
        drinkName: drink.name || '',
        drinkWuxing: drink.dimensions?.philosophy?.wuxing || drink.dimensions?.wuxing || '',
        currentTime: `${hour}:00`,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      wuxingScore = parsed?.wuxingScore ?? 75;
      emotionScore = parsed?.emotionScore ?? 75;
    }
  } catch (e) {
    console.warn('[QualityEval] LLM failed, using defaults:', e.message);
  }

  const finalScore = calcFinalScore(wuxingScore, emotionScore, timeScore);

  return {
    drinkId: drink.id,
    score: finalScore,
    comment: getScoreComment(finalScore),
    detail: { wuxingScore, emotionScore, timeScore },
  };
}

// ─── 批量评估（Promise.all 并行） ───────────────────────────

export async function evaluateAllDrinks(drinks, moodData) {
  if (!drinks || drinks.length === 0) return [];
  const results = await Promise.all(
    drinks.map(drink => evaluateDrink(drink, moodData))
  );
  return results;
}

// ─── 兼容现有 Agent 编排器的类封装 ──────────────────────────

export class ValidatorOptimizer extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'ValidatorOptimizer',
      timeout: 30000,
      ...config,
    });
  }

  validateInput(context) {
    const matches = context.getIntermediate('matches');
    if (!matches || matches.length === 0) {
      return { valid: false, reason: 'No matches available for quality evaluation' };
    }
    return { valid: true };
  }

  async process(context) {
    const matches = context.getIntermediate('matches') || [];
    const moodData = context.getIntermediate('moodData');
    const patternAnalysis = context.getIntermediate('patternAnalysis');

    const drinks = matches.map(m => m.drink).filter(Boolean);
    const contextData = { moodData, patternAnalysis, summary: moodData?.summary };
    const qualityResults = await evaluateAllDrinks(drinks, contextData);

    const avgScore = qualityResults.length > 0
      ? Math.round(qualityResults.reduce((s, r) => s + r.score, 0) / qualityResults.length)
      : 75;

    context.setIntermediate('qualityResults', qualityResults);

    return {
      score: avgScore,
      qualityLevel: avgScore >= 85 ? 'excellent' : avgScore >= 70 ? 'good' : avgScore >= 50 ? 'acceptable' : 'poor',
      qualityResults,
      issues: [],
      uiHints: {
        showBadge: avgScore >= 70,
        badgeText: avgScore >= 85 ? '心味相合' : avgScore >= 70 ? '恰有灵犀' : '随缘入味',
      },
      timestamp: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).replace(/\//g, '-'),
    };
  }

  validateOutput(result) {
    if (!result || typeof result.score !== 'number') {
      return { valid: false, reason: 'Invalid quality evaluation report' };
    }
    return { valid: true };
  }
}

export default ValidatorOptimizer;

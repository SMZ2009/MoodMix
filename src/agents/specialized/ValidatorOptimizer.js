/**
 * Agent 5: ValidatorOptimizer - 验证优化师
 * 
 * 职责：
 * 1. 一致性验证
 * 2. 冲突检测（五行生克、时段温度、情绪酒精）
 * 3. 质量评分（多维度加权）
 * 4. 自动优化
 * 5. 处理策略决策（重试/降级/阻断）
 * 
 * 输入：全流程输出
 * 输出：验证报告 + UI提示
 */

import { BaseAgent } from '../core/BaseAgent';

// 五行生克关系表
const WUXING_RELATIONS = {
  // 相生：木生火、火生土、土生金、金生水、水生木
  generates: {
    wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood'
  },
  // 相克：木克土、土克水、水克火、火克金、金克木
  conquers: {
    wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood'
  }
};

export class ValidatorOptimizer extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'ValidatorOptimizer',
      timeout: 1500,
      ...config
    });
  }

  /**
   * 输入验证
   */
  validateInput(context) {
    const required = ['moodData', 'patternAnalysis', 'vectorResult', 'matches'];
    const missing = required.filter(key => !context.getIntermediate(key));
    
    if (missing.length > 0) {
      return { 
        valid: false, 
        reason: `Missing required intermediates: ${missing.join(', ')}` 
      };
    }
    
    return { valid: true };
  }

  /**
   * 核心处理：验证与优化
   */
  async process(context) {
    const moodData = context.getIntermediate('moodData');
    const analysis = context.getIntermediate('patternAnalysis');
    const vectorResult = context.getIntermediate('vectorResult');
    const matches = context.getIntermediate('matches');
    const copy = context.getIntermediate('creativeCopy');
    const inventory = context.input?.inventory || [];
    
    const issues = [];
    const optimizations = [];
    
    // 1. 一致性验证
    const consistencyCheck = this.validateConsistency(moodData, analysis, vectorResult);
    if (!consistencyCheck.valid) {
      issues.push(...consistencyCheck.issues);
    }
    
    // 2. 冲突检测（基础）
    const conflictCheck = this.detectConflicts(moodData, vectorResult);
    if (!conflictCheck.valid) {
      issues.push(...conflictCheck.issues);
    }
    
    // 3. 五行生克验证
    const wuxingCheck = this.validateWuxingRelation(analysis, matches);
    if (!wuxingCheck.valid) {
      issues.push(...wuxingCheck.issues);
    }
    
    // 4. 时段温度合理性
    const temporalCheck = this.validateTemporalTemperature(vectorResult);
    if (!temporalCheck.valid) {
      issues.push(...temporalCheck.issues);
    }
    
    // 5. 情绪酒精度安全性
    const safetyCheck = this.validateEmotionAlcohol(moodData, matches);
    if (!safetyCheck.valid) {
      issues.push(...safetyCheck.issues);
    }
    
    // 6. 向量范围验证
    const vectorCheck = this.validateVectorRange(vectorResult);
    if (!vectorCheck.valid) {
      issues.push(...vectorCheck.issues);
      const fixed = this.fixVectorRange(vectorResult);
      optimizations.push('向量范围已自动修复');
      context.setIntermediate('vectorResult', fixed);
    }
    
    // 7. 权重验证
    const weightCheck = this.validateWeights(vectorResult);
    if (!weightCheck.valid) {
      issues.push(...weightCheck.issues);
      const fixed = this.fixWeights(vectorResult);
      optimizations.push('权重已自动归一化');
      context.setIntermediate('vectorResult', fixed);
    }
    
    // 8. 原料可行性计算
    const feasibility = this.calculateFeasibility(matches, inventory);
    
    // 9. 多维度加权评分
    const score = this.calculateWeightedScore({
      moodData, analysis, vectorResult, matches, copy, issues, feasibility
    });
    
    // 10. 确定质量等级和处理策略
    const qualityLevel = this.determineQualityLevel(score);
    const { shouldRetry, shouldBlock, userMessage } = this.determineStrategy(issues, score, moodData);
    const uiHints = this.generateUIHints(qualityLevel, shouldBlock);
    
    const report = {
      valid: issues.filter(i => i.type === 'error').length === 0,
      score,
      qualityLevel,
      shouldRetry,
      shouldBlock,
      userMessage,
      issues,
      optimizations,
      feasibility,
      uiHints,
      recommendations: this.generateRecommendations(issues, qualityLevel),
      timestamp: new Date().toISOString()
    };
    
    context.setIntermediate('validationReport', report);
    
    return report;
  }

  /**
   * 一致性验证
   */
  validateConsistency(moodData, analysis, vectorResult) {
    const issues = [];
    
    // 检查情绪极性与策略是否匹配
    if (analysis.polarity?.type === 'negative' && analysis.strategy?.type === 'resonate') {
      issues.push({
        type: 'warning',
        message: '负面情绪不应使用共鸣策略',
        severity: 'medium'
      });
    }
    
    // 检查五行映射是否一致
    const wuxing = analysis.wuxing?.user;
    const vectorWuxing = this.inferWuxingFromVector(vectorResult?.targetVector);
    
    if (wuxing && vectorWuxing && wuxing !== vectorWuxing) {
      issues.push({
        type: 'info',
        message: `五行映射存在差异: ${wuxing} vs ${vectorWuxing}`,
        severity: 'low'
      });
    }
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * 冲突检测
   */
  detectConflicts(moodData, vectorResult) {
    const issues = [];
    const vector = vectorResult?.targetVector;
    
    if (!vector) {
      return { valid: false, issues: [{ type: 'error', message: 'Missing target vector' }] };
    }
    
    // 检查温度与烈度冲突
    const temperature = vector[2]; // 温度维度
    const ratio = vector[6]; // 烈度维度
    
    if (temperature > 3 && ratio > 40) {
      issues.push({
        type: 'warning',
        message: '高温+高烈度组合可能过于刺激',
        severity: 'low'
      });
    }
    
    // 检查质地与温度冲突
    const texture = vector[1]; // 质地维度
    
    if (texture < -2 && temperature > 2) {
      issues.push({
        type: 'info',
        message: '轻盈质地与高温的组合较为少见',
        severity: 'low'
      });
    }
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * 五行生克关系验证
   */
  validateWuxingRelation(analysis, matches) {
    const issues = [];
    const userWuxing = analysis?.wuxing?.user;
    
    if (!userWuxing || !matches || matches.length === 0) {
      return { valid: true, issues };
    }
    
    // 检查推荐酒的五行是否与用户相克
    const topMatch = matches[0];
    const drinkWuxing = topMatch?.drink?.dimensions?.philosophy?.wuxing;
    
    if (drinkWuxing && WUXING_RELATIONS.conquers[drinkWuxing] === userWuxing) {
      issues.push({
        type: 'warning',
        message: `推荐酒五行(${drinkWuxing})克用户五行(${userWuxing})，可能不太契合`,
        severity: 'medium'
      });
    }
    
    // 相生关系加分（信息性）
    if (drinkWuxing && WUXING_RELATIONS.generates[userWuxing] === drinkWuxing) {
      // 用户五行生酒的五行，很好的搞配
      issues.push({
        type: 'bonus',
        message: `用户五行(${userWuxing})生推荐酒五行(${drinkWuxing})，相得益彰`,
        severity: 'positive'
      });
    }
    
    return { valid: issues.filter(i => i.type !== 'bonus').length === 0, issues };
  }

  /**
   * 时段温度合理性验证
   */
  validateTemporalTemperature(vectorResult) {
    const issues = [];
    const vector = vectorResult?.targetVector;
    
    if (!vector) return { valid: true, issues };
    
    const temperature = vector[2];  // 温度维度
    const temporality = vector[4];  // 时段维度 (0-23小时)
    
    // 深夜(22-6点) + 冰饮(温度<-2) = 不合理
    const isLateNight = temporality >= 22 || temporality <= 6;
    const isIceCold = temperature < -2;
    
    if (isLateNight && isIceCold) {
      issues.push({
        type: 'warning',
        message: '深夜时段推荐冰饮可能不太合适',
        severity: 'low'
      });
    }
    
    // 早晨(6-9点) + 高酒精度 = 不合理
    const isMorning = temporality >= 6 && temporality <= 9;
    const ratio = vector[6];  // 酒精度
    
    if (isMorning && ratio > 20) {
      issues.push({
        type: 'warning',
        message: '早晨时段推荐高酒精饮品可能不太合适',
        severity: 'medium'
      });
    }
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * 情绪酒精度安全性验证
   */
  validateEmotionAlcohol(moodData, matches) {
    const issues = [];
    
    if (!moodData || !matches || matches.length === 0) {
      return { valid: true, issues };
    }
    
    const isNegative = moodData.isNegative;
    const intensity = moodData.emotion?.intensity || 'medium';
    
    // 检查推荐酒的平均酒精度
    const avgAlcohol = matches.slice(0, 3).reduce((sum, m) => {
      return sum + (m.drink?.abv || m.drink?.dimensions?.ratio || 0);
    }, 0) / Math.min(3, matches.length);
    
    // 极度负面情绪 + 高酒精度(>40%) = 不安全
    if (isNegative && intensity === 'high' && avgAlcohol > 40) {
      issues.push({
        type: 'error',
        message: '极度负面情绪下不建议推荐高酒精度饮品',
        severity: 'critical',
        shouldBlock: true
      });
    }
    
    // 负面情绪 + 较高酒精度(>30%) = 警告
    if (isNegative && avgAlcohol > 30) {
      issues.push({
        type: 'warning',
        message: '负面情绪时建议适度饮酒',
        severity: 'medium'
      });
    }
    
    return { valid: issues.filter(i => i.type === 'error').length === 0, issues };
  }

  /**
   * 计算原料可行性
   */
  calculateFeasibility(matches, inventory) {
    if (!matches || matches.length === 0 || !inventory || inventory.length === 0) {
      return { ratio: 0, canMakeCount: 0, totalCount: 0 };
    }
    
    const inventorySet = new Set(inventory.map(i => i.toLowerCase()));
    let canMakeCount = 0;
    
    matches.slice(0, 9).forEach(match => {
      const ingredients = match.drink?.ingredients || [];
      const drinkIngredients = ingredients.map(ing => 
        (typeof ing === 'string' ? ing : ing.name || '').toLowerCase()
      );
      
      // 计算用户拥有的原料比例
      const matchedCount = drinkIngredients.filter(ing => 
        [...inventorySet].some(inv => ing.includes(inv) || inv.includes(ing))
      ).length;
      
      if (matchedCount >= drinkIngredients.length * 0.7) {
        canMakeCount++;
      }
    });
    
    return {
      ratio: canMakeCount / Math.min(9, matches.length),
      canMakeCount,
      totalCount: Math.min(9, matches.length)
    };
  }

  /**
   * 向量范围验证
   */
  validateVectorRange(vectorResult) {
    const issues = [];
    const vector = vectorResult?.targetVector;
    
    if (!vector) {
      return { valid: false, issues: [{ type: 'error', message: 'Missing target vector' }] };
    }
    
    // 各维度有效范围
    const ranges = [
      [0, 10],    // taste
      [-3, 3],    // texture
      [-5, 5],    // temperature
      [1, 5],     // color
      [0, 23],    // temporality
      [0, 10],    // aroma
      [0, 95],    // ratio
      [1, 5]      // action
    ];
    
    vector.forEach((value, idx) => {
      const [min, max] = ranges[idx];
      if (value < min || value > max) {
        issues.push({
          type: 'error',
          message: `Dimension ${idx} out of range: ${value} not in [${min}, ${max}]`,
          dimension: idx,
          value,
          range: [min, max]
        });
      }
    });
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * 修复向量范围
   */
  fixVectorRange(vectorResult) {
    const ranges = [
      [0, 10], [-3, 3], [-5, 5], [1, 5],
      [0, 23], [0, 10], [0, 95], [1, 5]
    ];
    
    const fixed = { ...vectorResult };
    fixed.targetVector = vectorResult.targetVector.map((value, idx) => {
      const [min, max] = ranges[idx];
      return Math.max(min, Math.min(max, value));
    });
    
    return fixed;
  }

  /**
   * 权重验证
   */
  validateWeights(vectorResult) {
    const issues = [];
    const weights = vectorResult?.weights;
    
    if (!weights || weights.length !== 8) {
      return { valid: false, issues: [{ type: 'error', message: 'Invalid weights' }] };
    }
    
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      issues.push({
        type: 'error',
        message: `Weights sum to ${sum}, expected 1.0`,
        sum
      });
    }
    
    // 检查是否有负权重
    const negativeWeights = weights.filter(w => w < 0);
    if (negativeWeights.length > 0) {
      issues.push({
        type: 'error',
        message: 'Negative weights detected'
      });
    }
    
    return { valid: issues.length === 0, issues };
  }

  /**
   * 修复权重（归一化）
   */
  fixWeights(vectorResult) {
    const fixed = { ...vectorResult };
    const weights = [...vectorResult.weights];
    
    // 确保非负
    const nonNegative = weights.map(w => Math.max(0, w));
    
    // 归一化
    const sum = nonNegative.reduce((a, b) => a + b, 0);
    fixed.weights = sum > 0 ? nonNegative.map(w => w / sum) : weights.map(() => 1/8);
    
    return fixed;
  }

  /**
   * 从向量推断五行
   */
  inferWuxingFromVector(vector) {
    if (!vector) return null;
    
    const [taste, texture, temperature] = vector;
    
    // 简单推断规则
    if (temperature > 2) return 'fire';
    if (temperature < -2) return 'water';
    if (taste > 6) return 'earth';
    if (texture > 1) return 'wood';
    if (texture < -1) return 'metal';
    
    return 'earth';
  }

  /**
   * 多维度加权评分
   */
  calculateWeightedScore({ moodData, analysis, vectorResult, matches, copy, issues, feasibility }) {
    // 权重配置
    const weights = {
      consistency: 0.25,   // 一致性（无error/warning）
      relevance: 0.30,     // 情绪匹配度（top1 similarity）
      feasibility: 0.20,   // 原料可行性
      safety: 0.15,        // 安全性（无高危组合）
      creativity: 0.10     // 文案质量
    };
    
    let scores = {};
    
    // 1. 一致性评分
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    const bonusCount = issues.filter(i => i.type === 'bonus').length;
    scores.consistency = Math.max(0, 100 - errorCount * 30 - warningCount * 10 + bonusCount * 5);
    
    // 2. 情绪匹配度
    if (matches && matches.length > 0) {
      const topSimilarity = matches[0].similarity || 0;
      scores.relevance = Math.round(topSimilarity * 100);
    } else {
      scores.relevance = 0;
    }
    
    // 3. 原料可行性
    scores.feasibility = feasibility?.ratio ? Math.round(feasibility.ratio * 100) : 50; // 无原料数据时给中间分
    
    // 4. 安全性
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    scores.safety = Math.max(0, 100 - criticalIssues * 50 - mediumIssues * 15);
    
    // 5. 文案质量
    scores.creativity = copy?.quote ? 100 : 50;
    
    // 加权计算总分
    const totalScore = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (scores[key] || 0) * weight;
    }, 0);
    
    return Math.max(0, Math.min(100, Math.round(totalScore)));
  }

  /**
   * 确定质量等级
   */
  determineQualityLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'acceptable';
    return 'poor';
  }

  /**
   * 确定处理策略
   */
  determineStrategy(issues, score, moodData) {
    // 检查是否有严重安全问题
    const criticalSafetyIssue = issues.find(i => i.shouldBlock || i.severity === 'critical');
    
    if (criticalSafetyIssue) {
      return {
        shouldRetry: false,
        shouldBlock: true,
        userMessage: '此刻的心境需要换一种表达方式'
      };
    }
    
    // 检查是否需要重试
    const hasError = issues.some(i => i.type === 'error');
    if (score < 60 || hasError) {
      return {
        shouldRetry: true,
        shouldBlock: false,
        userMessage: null
      };
    }
    
    return {
      shouldRetry: false,
      shouldBlock: false,
      userMessage: null
    };
  }

  /**
   * 生成UI提示配置
   */
  generateUIHints(qualityLevel, shouldBlock) {
    if (shouldBlock) {
      return {
        showBadge: false,
        badgeText: null,
        showBottomHint: true,
        bottomHintText: '此缘或许未到，换一批再寻？',
        buttonText: '再寻一次'
      };
    }
    
    switch (qualityLevel) {
      case 'excellent':
        return {
          showBadge: true,
          badgeText: '心味相合',
          showBottomHint: false,
          bottomHintText: null,
          buttonText: null
        };
      case 'good':
        return {
          showBadge: false,
          badgeText: null,
          showBottomHint: false,
          bottomHintText: null,
          buttonText: null
        };
      case 'acceptable':
        return {
          showBadge: true,
          badgeText: '缘来一试',
          showBottomHint: false,
          bottomHintText: null,
          buttonText: null
        };
      case 'poor':
      default:
        return {
          showBadge: true,
          badgeText: '缘分尚浅',
          showBottomHint: false,
          bottomHintText: null,
          buttonText: null
        };
    }
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(issues, qualityLevel) {
    const recommendations = [];
    
    const errorIssues = issues.filter(i => i.type === 'error');
    const warningIssues = issues.filter(i => i.type === 'warning');
    const bonusIssues = issues.filter(i => i.type === 'bonus');
    
    if (errorIssues.length > 0) {
      recommendations.push('已自动修复向量范围问题');
    }
    
    if (warningIssues.length > 0) {
      recommendations.push('建议人工复核策略匹配');
    }
    
    if (bonusIssues.length > 0) {
      recommendations.push('五行相生，天作之合');
    }
    
    if (qualityLevel === 'excellent') {
      recommendations.push('心味相合，推荐结果可信');
    } else if (qualityLevel === 'good') {
      recommendations.push('推荐质量良好');
    } else if (qualityLevel === 'acceptable') {
      recommendations.push('推荐结果可接受，建议尝试');
    } else if (qualityLevel === 'poor') {
      recommendations.push('建议换一批探索');
    }
    
    return recommendations;
  }

  /**
   * 输出验证
   */
  validateOutput(result) {
    if (!result || typeof result.score !== 'number') {
      return { valid: false, reason: 'Invalid validation report' };
    }
    
    return { valid: true };
  }
}

export default ValidatorOptimizer;

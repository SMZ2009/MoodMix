/**
 * Agent 5: ValidatorOptimizer - 验证优化师
 * 
 * 职责：
 * 1. 一致性验证
 * 2. 冲突检测
 * 3. 质量评分
 * 4. 自动优化
 * 
 * 输入：全流程输出
 * 输出：验证报告
 */

import { BaseAgent } from '../core/BaseAgent';

export class ValidatorOptimizer extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'ValidatorOptimizer',
      timeout: 1000,
      ...config
    });
  }

  /**
   * 输入验证
   */
  validateInput(context) {
    // 验证器需要所有前面的输出
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
    
    const issues = [];
    const optimizations = [];
    
    // 1. 一致性验证
    const consistencyCheck = this.validateConsistency(moodData, analysis, vectorResult);
    if (!consistencyCheck.valid) {
      issues.push(...consistencyCheck.issues);
    }
    
    // 2. 冲突检测
    const conflictCheck = this.detectConflicts(moodData, vectorResult);
    if (!conflictCheck.valid) {
      issues.push(...conflictCheck.issues);
    }
    
    // 3. 向量范围验证
    const vectorCheck = this.validateVectorRange(vectorResult);
    if (!vectorCheck.valid) {
      issues.push(...vectorCheck.issues);
      // 自动修复
      const fixed = this.fixVectorRange(vectorResult);
      optimizations.push('Vector range auto-fixed');
      context.setIntermediate('vectorResult', fixed);
    }
    
    // 4. 权重验证
    const weightCheck = this.validateWeights(vectorResult);
    if (!weightCheck.valid) {
      issues.push(...weightCheck.issues);
      // 自动修复
      const fixed = this.fixWeights(vectorResult);
      optimizations.push('Weights auto-normalized');
      context.setIntermediate('vectorResult', fixed);
    }
    
    // 5. 质量评分
    const score = this.calculateQualityScore({
      moodData,
      analysis,
      vectorResult,
      matches,
      copy,
      issues
    });
    
    const report = {
      valid: issues.length === 0,
      score,
      issues,
      optimizations,
      recommendations: this.generateRecommendations(issues),
      timestamp: new Date().toISOString()
    };
    
    // 存储到上下文
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
   * 计算质量评分
   */
  calculateQualityScore({ moodData, analysis, vectorResult, matches, copy, issues }) {
    let score = 100;
    
    // 根据问题扣分
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    
    score -= errorCount * 20;
    score -= warningCount * 5;
    
    // 匹配质量加分
    if (matches && matches.length > 0) {
      const topSimilarity = matches[0].similarity;
      score += Math.round(topSimilarity * 10);
    }
    
    // 文案质量加分
    if (copy && copy.quote) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(issues) {
    const recommendations = [];
    
    const errorIssues = issues.filter(i => i.type === 'error');
    const warningIssues = issues.filter(i => i.type === 'warning');
    
    if (errorIssues.length > 0) {
      recommendations.push('已自动修复向量范围问题');
    }
    
    if (warningIssues.length > 0) {
      recommendations.push('建议人工复核策略匹配');
    }
    
    if (issues.length === 0) {
      recommendations.push('所有检查通过，推荐结果可信');
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

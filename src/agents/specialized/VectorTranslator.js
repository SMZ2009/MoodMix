/**
 * Agent 3: VectorTranslator - 向量翻译官
 * 
 * 职责：
 * 1. 将诊断结论翻译为8维目标向量
 * 2. 计算动态权重
 * 3. 实现跨模态映射（哲学→数学）
 * 
 * 输入：诊断结论 + 6维数据
 * 输出：8维向量 + 动态权重
 */

import { BaseAgent } from '../core/BaseAgent';

export class VectorTranslator extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'VectorTranslator',
      timeout: 30000,
      ...config
    });
  }

  /**
   * 输入验证
   */
  validateInput(context) {
    const moodData = context.getIntermediate('moodData');
    const analysis = context.getIntermediate('patternAnalysis');

    if (!moodData) {
      return { valid: false, reason: 'Missing moodData' };
    }
    if (!analysis) {
      return { valid: false, reason: 'Missing patternAnalysis' };
    }

    return { valid: true };
  }

  /**
   * 核心处理：向量翻译
   */
  async process(context) {
    const moodData = context.getIntermediate('moodData');
    const analysis = context.getIntermediate('patternAnalysis');

    try {
      this.log('INFO', '尝试请求 AI 向量翻译...');
      const response = await fetch('/api/vector_translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodData, patternAnalysis: analysis })
      });

      if (!response.ok) throw new Error(`AI 服务返回错误: ${response.status}`);

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'AI 翻译失败');

      this.log('SUCCESS', 'AI 向量翻译完成');

      // 强制归一化处理，确保 weights 之和为 1.0，防止校验失败
      if (result.data.weights && Array.isArray(result.data.weights)) {
        const sum = result.data.weights.reduce((a, b) => a + b, 0);
        if (sum > 0) {
          result.data.weights = result.data.weights.map(w => w / sum);
        }
      }

      const data = {
        ...result.data,
        isAI: true
      };

      context.setIntermediate('vectorResult', data);
      return data;

    } catch (error) {
      this.log('WARNING', `AI 翻译失败，降级到本地计算: ${error.message}`);

      const result = this.processLocal(moodData, analysis);
      result.isAI = false;
      result.fallbackReason = error.message;

      context.setIntermediate('vectorResult', result);
      return result;
    }
  }

  /**
   * 原有的本地向量翻译逻辑（作为降级方案）
   */
  processLocal(moodData, analysis) {
    // 构建8维目标向量
    const targetVector = this.buildTargetVector(moodData, analysis);

    // 计算动态权重
    const weights = this.calculateWeights(moodData, analysis);

    // 计算优先级排序
    const priorities = this.calculatePriorities(moodData, analysis);

    return {
      targetVector,
      weights,
      priorities,
      mappingExplanation: this.generateExplanation(targetVector, analysis)
    };
  }

  /**
   * 构建8维目标向量
   * [taste, texture, temperature, color, temporality, aroma, ratio, action]
   */
  buildTargetVector(moodData, analysis) {
    const { emotion, somatic, time, cognitive, demand, socialContext } = moodData;

    // 提取各维度的drinkMapping
    const vector = [
      // 1. taste (味觉 0-10)
      emotion?.drinkMapping?.tasteScore ?? 5,

      // 2. texture (质地 -3~3)
      somatic?.drinkMapping?.textureScore ?? 0,

      // 3. temperature (温度 -5~5)
      somatic?.drinkMapping?.temperature ?? 0,

      // 4. color (颜色 1-5)
      emotion?.drinkMapping?.colorCode ?? 3,

      // 5. temporality (时序 0-23)
      time?.drinkMapping?.temporality ?? 12,

      // 6. aroma (香气 0-10)
      cognitive?.drinkMapping?.aromaScore ?? 5,

      // 7. ratio (烈度 0-95)
      socialContext?.drinkMapping?.ratioScore ?? 20,

      // 8. action (动作感 1-5)
      demand?.drinkMapping?.actionScore ?? 3
    ];

    return vector;
  }

  /**
   * 计算动态权重
   */
  calculateWeights(moodData, analysis) {
    // 基础权重
    const baseWeights = [1.0, 1.0, 1.0, 0.8, 0.6, 0.9, 1.1, 1.0];

    const kappa = {
      somatic: 2.0,
      demand: 1.8,
      emotion: 1.5,
      cognitive: 1.2,
      time: 0.8,
      socialContext: 0.7
    };

    const intensities = {
      somatic: moodData.somatic?.physical?.intensity ?? 0.5,
      demand: moodData.demand?.physical?.intensity ?? 0.5,
      emotion: moodData.emotion?.physical?.intensity ?? 0.5,
      cognitive: moodData.cognitive?.physical?.intensity ?? 0.5,
      time: moodData.time?.physical?.intensity ?? 0.3,
      socialContext: moodData.socialContext?.physical?.intensity ?? 0.3
    };

    const adjustedWeights = baseWeights.map((base, idx) => {
      let adjustment = 0;
      switch (idx) {
        case 0: adjustment = kappa.emotion * intensities.emotion; break;
        case 1: adjustment = kappa.somatic * intensities.somatic; break;
        case 2: adjustment = kappa.somatic * intensities.somatic; break;
        case 3: adjustment = kappa.emotion * intensities.emotion * 0.5; break;
        case 4: adjustment = kappa.time * intensities.time; break;
        case 5: adjustment = kappa.cognitive * intensities.cognitive; break;
        case 6: adjustment = (kappa.demand * intensities.demand + kappa.socialContext * intensities.socialContext) / 2; break;
        case 7: adjustment = kappa.demand * intensities.demand; break;
        default: adjustment = 0; break;
      }
      return base + adjustment;
    });

    const sum = adjustedWeights.reduce((a, b) => a + b, 0);
    return adjustedWeights.map(w => w / sum);
  }

  /**
   * 计算优先级排序
   */
  calculatePriorities(moodData, analysis) {
    const priorities = [];
    const strategyType = analysis.strategy?.type;

    if (strategyType === 'counter') {
      priorities.push('ratio', 'temperature', 'action');
    } else if (strategyType === 'harmonize') {
      priorities.push('texture', 'aroma', 'taste');
    } else if (strategyType === 'resonate') {
      priorities.push('taste', 'color', 'temporality');
    } else {
      priorities.push('taste', 'temperature', 'texture');
    }

    return priorities;
  }

  /**
   * 生成映射解释
   */
  generateExplanation(vector, analysis) {
    const wuxingNames = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
    const [taste, texture, temperature] = vector;

    return {
      wuxing: wuxingNames[analysis.wuxing?.user] || '土',
      strategy: analysis.strategy?.type,
      keyDimensions: [
        temperature > 0 ? '温热' : temperature < 0 ? '寒凉' : '平和',
        taste > 6 ? '浓郁' : taste < 4 ? '清淡' : '适中',
        texture > 0 ? '厚重' : texture < 0 ? '轻盈' : '平衡'
      ]
    };
  }

  /**
   * 输出验证
   */
  validateOutput(result) {
    if (!result || !result.targetVector || !result.weights) return { valid: false, reason: 'Missing vector or weights' };
    if (result.targetVector.length !== 8) return { valid: false, reason: 'Vector must be 8D' };
    const sum = result.weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.05) return { valid: false, reason: 'Weights must sum to 1.0' };
    return { valid: true };
  }
}

export default VectorTranslator;

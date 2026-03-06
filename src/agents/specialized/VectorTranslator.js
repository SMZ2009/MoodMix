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
      timeout: 2000,
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
    
    // 构建8维目标向量
    const targetVector = this.buildTargetVector(moodData, analysis);
    
    // 计算动态权重
    const weights = this.calculateWeights(moodData, analysis);
    
    // 计算优先级排序
    const priorities = this.calculatePriorities(moodData, analysis);
    
    const result = {
      targetVector,
      weights,
      priorities,
      mappingExplanation: this.generateExplanation(targetVector, analysis)
    };
    
    // 存储到上下文
    context.setIntermediate('vectorResult', result);
    
    return result;
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
   * W_final,i = Normalize(W_base,i + Σ(κ_j→i × I_j))
   */
  calculateWeights(moodData, analysis) {
    // 基础权重
    const baseWeights = [1.0, 1.0, 1.0, 0.8, 0.6, 0.9, 1.1, 1.0];
    
    // 维度敏感度系数 (Kappa)
    const kappa = {
      somatic: 2.0,  // 躯体感受最重要
      demand: 1.8,   // 诉求次之
      emotion: 1.5,  // 情绪
      cognitive: 1.2, // 认知
      time: 0.8,     // 时间
      socialContext: 0.7 // 社交
    };
    
    // 提取各维度强度
    const intensities = {
      somatic: moodData.somatic?.physical?.intensity ?? 0.5,
      demand: moodData.demand?.physical?.intensity ?? 0.5,
      emotion: moodData.emotion?.physical?.intensity ?? 0.5,
      cognitive: moodData.cognitive?.physical?.intensity ?? 0.5,
      time: moodData.time?.physical?.intensity ?? 0.3,
      socialContext: moodData.socialContext?.physical?.intensity ?? 0.3
    };
    
    // 计算调整后的权重
    const adjustedWeights = baseWeights.map((base, idx) => {
      let adjustment = 0;
      
      // 根据维度映射关系计算调整值
      switch (idx) {
        case 0: // taste - 受 emotion 影响
          adjustment = kappa.emotion * intensities.emotion;
          break;
        case 1: // texture - 受 somatic 影响
          adjustment = kappa.somatic * intensities.somatic;
          break;
        case 2: // temperature - 受 somatic 影响
          adjustment = kappa.somatic * intensities.somatic;
          break;
        case 3: // color - 受 emotion 影响
          adjustment = kappa.emotion * intensities.emotion * 0.5;
          break;
        case 4: // temporality - 受 time 影响
          adjustment = kappa.time * intensities.time;
          break;
        case 5: // aroma - 受 cognitive 影响
          adjustment = kappa.cognitive * intensities.cognitive;
          break;
        case 6: // ratio - 受 socialContext 和 demand 影响
          adjustment = (kappa.demand * intensities.demand + 
                       kappa.socialContext * intensities.socialContext) / 2;
          break;
        case 7: // action - 受 demand 影响
          adjustment = kappa.demand * intensities.demand;
          break;
      }
      
      return base + adjustment;
    });
    
    // 归一化
    const sum = adjustedWeights.reduce((a, b) => a + b, 0);
    return adjustedWeights.map(w => w / sum);
  }

  /**
   * 计算优先级排序
   */
  calculatePriorities(moodData, analysis) {
    const priorities = [];
    
    // 基于策略类型确定优先级
    const strategyType = analysis.strategy?.type;
    
    if (strategyType === 'counter') {
      // 对冲策略：优先烈度和温度
      priorities.push('ratio', 'temperature', 'action');
    } else if (strategyType === 'harmonize') {
      // 调和策略：优先质地和香气
      priorities.push('texture', 'aroma', 'taste');
    } else if (strategyType === 'resonate') {
      // 共鸣策略：优先味觉和颜色
      priorities.push('taste', 'color', 'temporality');
    } else {
      // 默认
      priorities.push('taste', 'temperature', 'texture');
    }
    
    return priorities;
  }

  /**
   * 生成映射解释
   */
  generateExplanation(vector, analysis) {
    const wuxingNames = {
      wood: '木',
      fire: '火',
      earth: '土',
      metal: '金',
      water: '水'
    };
    
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
    if (!result || !result.targetVector || !result.weights) {
      return { valid: false, reason: 'Missing vector or weights' };
    }
    
    if (result.targetVector.length !== 8) {
      return { valid: false, reason: 'Target vector must have 8 dimensions' };
    }
    
    if (result.weights.length !== 8) {
      return { valid: false, reason: 'Weights must have 8 dimensions' };
    }
    
    // 验证权重和为1
    const weightSum = result.weights.reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      return { valid: false, reason: 'Weights must sum to 1.0' };
    }
    
    return { valid: true };
  }
}

export default VectorTranslator;

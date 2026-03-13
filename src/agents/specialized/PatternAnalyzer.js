/**
 * Agent 2: PatternAnalyzer - 辨证分析师
 * 
 * 职责：
 * 1. 基于六维数据进行中医辨证分析
 * 2. 确定五行归纳和调理策略
 * 3. 判断情绪极性和对冲/共鸣策略
 * 
 * 输入：6维JSON数据
 * 输出：诊断结论 + 策略定义
 */

import { BaseAgent } from '../core/BaseAgent';

export class PatternAnalyzer extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'PatternAnalyzer',
      timeout: 30000, // 增加到30秒，适配 LLM 响应波动
      ...config
    });
  }

  /**
   * 输入验证
   */
  validateInput(context) {
    const moodData = context.getIntermediate('moodData');

    if (!moodData) {
      return { valid: false, reason: 'Missing moodData from previous agent' };
    }

    return { valid: true };
  }

  /**
   * 核心处理：辨证分析
   */
  async process(context) {
    const moodData = context.getIntermediate('moodData');

    try {
      this.log('INFO', '尝试请求 AI 深度辨证...');
      const response = await fetch('/api/pattern_analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodData })
      });

      if (!response.ok) throw new Error(`AI 服务返回错误: ${response.status}`);

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'AI 辨证失败');

      this.log('SUCCESS', 'AI 深度辨证完成');
      const analysis = {
        ...result.data,
        isAI: true,
        timestamp: new Date().toISOString()
      };

      context.setIntermediate('patternAnalysis', analysis);
      return analysis;

    } catch (error) {
      this.log('WARNING', `AI 辨证失败，降级到本地规则: ${error.message}`);

      // 降级到原有的本地逻辑
      const analysis = this.processLocal(moodData);
      analysis.isAI = false;
      analysis.fallbackReason = error.message;

      context.setIntermediate('patternAnalysis', analysis);
      return analysis;
    }
  }

  /**
   * 原有的本地辨证逻辑（作为降级方案）
   */
  processLocal(moodData) {
    // 分析情绪极性
    const polarity = this.analyzePolarity(moodData);

    // 五行归纳
    const wuxing = this.determineWuxing(moodData);

    // 确定调理策略
    const strategy = this.determineStrategy(moodData, polarity, wuxing);

    // 构建诊断结论
    const diagnosis = this.buildDiagnosis(moodData, polarity, wuxing);

    return {
      polarity,
      wuxing,
      strategy,
      diagnosis,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 分析情绪极性
   */
  analyzePolarity(moodData) {
    const { emotion, somatic, demand } = moodData;

    // 负面情绪关键词
    const negativeKeywords = ['难过', '伤心', '痛苦', '焦虑', '压力', '累', '疲惫', '烦躁', '生气', '愤怒', '郁闷', '不爽', '难受', '烦', 'emo'];

    // 检查情绪维度
    const emotionState = emotion?.physical?.state || '';
    const isNegativeEmotion = negativeKeywords.some(kw => emotionState.includes(kw));

    // 检查躯体维度
    const somaticState = somatic?.physical?.state || '';
    const isNegativeSomatic = negativeKeywords.some(kw => somaticState.includes(kw));

    // 检查诉求维度
    const demandType = demand?.physical?.type || '';
    const isNegativeDemand = ['发泄', '打破', '逃离', '安静', '独处'].some(kw => demandType.includes(kw));

    // 综合判断
    const negativeScore = [isNegativeEmotion, isNegativeSomatic, isNegativeDemand].filter(Boolean).length;

    if (negativeScore >= 2) {
      return { type: 'negative', confidence: 0.7 + (negativeScore - 2) * 0.15 };
    } else if (negativeScore === 1) {
      return { type: 'mixed', confidence: 0.5 };
    } else {
      return { type: 'positive', confidence: 0.8 };
    }
  }

  /**
   * 五行归纳
   */
  determineWuxing(moodData) {
    const { emotion, somatic, cognitive, demand } = moodData;

    // 基于各维度强度计算五行倾向
    const scores = {
      wood: 0,   // 木 - 怒/烦躁/想发泄
      fire: 0,   // 火 - 喜/亢奋
      earth: 0,  // 土 - 思/焦虑/内耗
      metal: 0,  // 金 - 悲/收敛
      water: 0   // 水 - 恐/疲惫/沉静
    };

    // 情绪维度映射
    const emotionState = emotion?.physical?.state || '';
    if (emotionState.includes('烦躁') || emotionState.includes('生气') || emotionState.includes('怒')) {
      scores.wood += 3;
    } else if (emotionState.includes('开心') || emotionState.includes('兴奋') || emotionState.includes('嗨')) {
      scores.fire += 3;
    } else if (emotionState.includes('难过') || emotionState.includes('悲伤') || emotionState.includes('郁闷')) {
      scores.metal += 3;
    } else if (emotionState.includes('焦虑') || emotionState.includes('担心') || emotionState.includes('思')) {
      scores.earth += 3;
    } else if (emotionState.includes('累') || emotionState.includes('疲惫') || emotionState.includes('困')) {
      scores.water += 3;
    }

    // 躯体维度映射
    const somaticState = somatic?.physical?.state || '';
    if (somaticState.includes('热') || somaticState.includes('燥')) {
      scores.fire += 2;
    } else if (somaticState.includes('冷') || somaticState.includes('寒')) {
      scores.water += 2;
    } else if (somaticState.includes('闷') || somaticState.includes('堵')) {
      scores.earth += 2;
    }

    // 认知维度映射
    const cognitiveState = cognitive?.physical?.state || '';
    if (cognitiveState.includes('清醒') || cognitiveState.includes('清晰')) {
      scores.metal += 2;
    } else if (cognitiveState.includes('混沌') || cognitiveState.includes('模糊')) {
      scores.earth += 1;
      scores.water += 1;
    }

    // 诉求维度映射
    const demandType = demand?.physical?.type || '';
    if (demandType.includes('发泄') || demandType.includes('打破')) {
      scores.wood += 2;
    } else if (demandType.includes('安静') || demandType.includes('独处')) {
      scores.water += 2;
    } else if (demandType.includes('庆祝') || demandType.includes('社交')) {
      scores.fire += 2;
    }

    // 找出最高分
    const maxScore = Math.max(...Object.values(scores));
    const dominantWuxing = Object.entries(scores)
      .filter(([_, score]) => score === maxScore)
      .map(([type, _]) => type)[0] || 'earth';

    return {
      user: dominantWuxing,
      scores,
      confidence: maxScore / Math.max(Object.values(scores).reduce((a, b) => a + b, 0), 1)
    };
  }

  /**
   * 确定调理策略
   */
  determineStrategy(moodData, polarity, wuxing) {
    const { demand } = moodData;

    // 基于极性和诉求确定策略
    if (polarity.type === 'negative') {
      // 负面情绪：纠偏或对冲
      const demandType = demand?.physical?.type || '';

      if (demandType.includes('发泄') || demandType.includes('打破')) {
        return { type: 'counter', logic: '以极端对抗极端，释放压力' };
      } else if (demandType.includes('安慰') || demandType.includes('安抚')) {
        return { type: 'harmonize', logic: '温和调理，平复情绪' };
      } else {
        return { type: 'correct', logic: '纠偏调理，恢复平衡' };
      }
    } else if (polarity.type === 'positive') {
      // 正面情绪：共鸣增强
      return { type: 'resonate', logic: '同频共振，强化愉悦' };
    } else {
      // 混合情绪：平衡调和
      return { type: 'balance', logic: '平衡调和，稳定状态' };
    }
  }

  /**
   * 构建诊断结论
   */
  buildDiagnosis(moodData, polarity, wuxing) {
    const { emotion, somatic } = moodData;

    const wuxingNames = {
      wood: '木',
      fire: '火',
      earth: '土',
      metal: '金',
      water: '水'
    };

    return {
      summary: `${wuxingNames[wuxing.user]}气偏${polarity.type === 'negative' ? '郁' : '盛'}`,
      emotionState: emotion?.physical?.state || '未知',
      somaticState: somatic?.physical?.state || '未知',
      recommendation: `宜${polarity.type === 'negative' ? '疏泄' : '滋养'}${wuxingNames[wuxing.user]}气`
    };
  }

  /**
   * 输出验证
   */
  validateOutput(result) {
    if (!result || typeof result !== 'object') {
      return { valid: false, reason: 'Invalid analysis format' };
    }

    if (!result.polarity || !result.wuxing || !result.strategy) {
      return { valid: false, reason: 'Missing required analysis fields' };
    }

    return { valid: true };
  }
}

export default PatternAnalyzer;

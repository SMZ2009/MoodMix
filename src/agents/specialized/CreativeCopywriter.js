/**
 * Agent 4: CreativeCopywriter - 创意文案师
 * 
 * 职责：
 * 1. 生成有温度的UI文案
 * 2. 因果叙事，哲学润色
 * 3. 确保文案不重复
 * 
 * 输入：匹配饮品 + 用户状态
 * 输出：UI文案（推荐语、标签等）
 */

import { BaseAgent } from '../core/BaseAgent';
import { generatePhilosophyTags } from '../../engine/philosophyTags';

export class CreativeCopywriter extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'CreativeCopywriter',
      timeout: 5000,
      ...config
    });
  }

  /**
   * 输入验证
   */
  validateInput(context) {
    const matches = context.getIntermediate('matches');
    
    if (!matches || matches.length === 0) {
      return { valid: false, reason: 'No matched drinks available' };
    }
    
    return { valid: true };
  }

  /**
   * 核心处理：文案生成
   */
  async process(context) {
    const matches = context.getIntermediate('matches');
    const moodData = context.getIntermediate('moodData');
    const analysis = context.getIntermediate('patternAnalysis');
    
    // 获取最佳匹配
    const topMatch = matches[0];
    
    // 生成哲学标签
    const philosophy = generatePhilosophyTags(
      topMatch.drink.dimensions,
      moodData,
      topMatch.drink.name
    );
    
    // 生成个性化文案
    const copy = {
      quote: philosophy.quote,
      tags: philosophy.tags,
      drinkName: topMatch.drink.name,
      explanation: this.generateExplanation(topMatch, analysis),
      variations: this.generateVariations(topMatch, moodData, analysis)
    };
    
    // 存储到上下文
    context.setIntermediate('creativeCopy', copy);
    
    return copy;
  }

  /**
   * 生成推荐解释
   */
  generateExplanation(match, analysis) {
    const { drink, similarity } = match;
    const { strategy, wuxing } = analysis;
    
    const wuxingNames = {
      wood: '木',
      fire: '火',
      earth: '土',
      metal: '金',
      water: '水'
    };
    
    const strategyTexts = {
      counter: '这杯饮品以对冲之力，化解你当下的郁结',
      harmonize: '这杯饮品的温和之力，将抚平你的情绪波澜',
      correct: '这杯饮品的调理之效，助你恢复身心平衡',
      resonate: '这杯饮品的共鸣之力，将放大你的愉悦感受',
      balance: '这杯饮品的平衡之道，让你找到内心的宁静'
    };
    
    return {
      strategy: strategyTexts[strategy?.type] || '这杯饮品与你当下的状态相契合',
      wuxing: `${wuxingNames[wuxing?.user] || '土'}气相应`,
      similarity: Math.round(similarity * 100),
      abv: drink.abv
    };
  }

  /**
   * 生成文案变体（确保不重复）
   */
  generateVariations(match, moodData, analysis) {
    const variations = [];
    const { drink } = match;
    
    // 基于饮品特征生成变体
    if (drink.abv > 30) {
      variations.push('烈酒入喉，烦恼皆休');
      variations.push('一杯烈酒，足以慰风尘');
    } else if (drink.abv > 15) {
      variations.push('微醺之间，找到平衡');
      variations.push('恰到好处的酒意，正配此刻心情');
    } else if (drink.abv > 0) {
      variations.push('轻酒一杯，温润入心');
      variations.push('淡淡的酒意，轻轻的慰藉');
    } else {
      variations.push('无酒之饮，纯粹之味');
      variations.push('清新的滋味，如晨露般纯净');
    }
    
    // 基于温度生成变体
    const temp = drink.dimensions?.temperature?.value || 0;
    if (temp > 2) {
      variations.push('温热的触感，暖入心扉');
    } else if (temp < -2) {
      variations.push('冰凉的刺激，唤醒感官');
    }
    
    return variations;
  }

  /**
   * 输出验证
   */
  validateOutput(result) {
    if (!result || !result.quote) {
      return { valid: false, reason: 'Missing quote in copy' };
    }
    
    if (!result.tags || result.tags.length === 0) {
      return { valid: false, reason: 'Missing tags in copy' };
    }
    
    return { valid: true };
  }

  /**
   * 错误处理：使用本地模板
   */
  async handleError(error, context) {
    console.warn('[CreativeCopywriter] Using fallback copy:', error.message);
    
    const matches = context.getIntermediate('matches');
    if (!matches || matches.length === 0) {
      return null;
    }
    
    const topMatch = matches[0];
    const moodData = context.getIntermediate('moodData');
    
    // 使用本地哲学标签生成
    const philosophy = generatePhilosophyTags(
      topMatch.drink.dimensions,
      moodData,
      topMatch.drink.name
    );
    
    return {
      quote: philosophy.quote,
      tags: philosophy.tags,
      drinkName: topMatch.drink.name,
      explanation: {
        strategy: '这杯饮品与你当下的状态相契合',
        similarity: Math.round(topMatch.similarity * 100)
      },
      variations: [],
      _fallback: true
    };
  }
}

export default CreativeCopywriter;

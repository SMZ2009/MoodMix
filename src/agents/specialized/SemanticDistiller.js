/**
 * Agent 1: SemanticDistiller - 语义蒸馏器
 * 
 * 职责：
 * 1. 解析用户自然语言输入
 * 2. 提取六维生理/心理诊断数据
 * 3. 将非结构化文本转为结构化JSON
 * 
 * 输入：用户原始语段
 * 输出：结构化6维JSON (情绪、躯体、时间、认知、诉求、社交)
 */

import { BaseAgent } from '../core/BaseAgent';

export class SemanticDistiller extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'SemanticDistiller',
      timeout: 5000,  // 5秒超时
      maxRetries: 1,
      ...config
    });
  }

  /**
   * 输入验证 - 详细的错误分类
   */
  validateInput(context) {
    const input = context.userInput;
    
    // 提取原始用户输入（去除原料附加信息）
    const originalInput = input.split('\n')[0] || input;
    
    // 1. 空输入检查
    if (!originalInput || !originalInput.trim()) {
      return { 
        valid: false, 
        reason: 'empty',
        userMessage: '请告诉我你此刻的心情或状态，我才能为你推荐合适的饮品～'
      };
    }
    
    const trimmed = originalInput.trim();
    const lower = trimmed.toLowerCase();
    
    // 2. 长度检查
    if (trimmed.length > 200) {
      return {
        valid: false,
        reason: 'too_long',
        userMessage: '输入有点长呢😅 可以简单描述一下你的心情吗？（200字以内）'
      };
    }
    
    // 3. 纯数字
    if (/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'unsupported_format_numbers',
        userMessage: '纯数字我无法理解呢😅 可以描述一下你的心情吗？比如：开心、累、想放松'
      };
    }
    
    // 4. 纯字母
    if (/^[a-zA-Z]+$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'unsupported_format_letters',
        userMessage: '纯字母我无法理解呢😅 可以用中文描述一下你的心情吗？'
      };
    }
    
    // 5. 纯特殊字符
    if (/^[^\u4e00-\u9fa5a-zA-Z0-9]+$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'unsupported_format_special',
        userMessage: '特殊字符我无法理解呢😅 可以描述一下你的心情吗？'
      };
    }
    
    // 6. 无意义重复数字
    if (/^(\d)\1{2,}$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_numbers',
        userMessage: '看起来像是随机数字😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 7. 无意义重复字母
    if (/^([a-z])\1{2,}$/i.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_letters',
        userMessage: '看起来像是随机字母😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 8. 键盘乱序
    if (/^(asdf|qwer|zxcv|wasd|fdsa|rewq|vcxz|qwerty|asdfgh|zxcvbn)$/i.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_keyboard',
        userMessage: '看起来像是键盘乱按😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 9. 无意义重复汉字（排除情绪表达）
    const emotionalRepetitions = ['哈哈', '嘿嘿', '呵呵', '呜呜', '啊啊'];
    const isEmotional = emotionalRepetitions.some(emo => trimmed.includes(emo));
    if (!isEmotional && /^(啊|哦|嗯|呃|哎|哟|喂){3,}$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_chinese',
        userMessage: '看起来像是无意义的重复😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 10. 知识性问题
    if (/什么是|什么叫|怎么.*做|如何.*做|为什么.*会|解释.*一下|介绍一下|告诉我.*关于/.test(lower)) {
      return {
        valid: false,
        reason: 'knowledge_question',
        userMessage: '我擅长根据心情推荐饮品，而不是回答问题😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 11. 指令/任务
    if (/帮我.*(订|点|买|查|搜|找)|给我.*(推荐|建议)|打开.*(软件|应用|程序)|设置.*(提醒|闹钟)/.test(lower)) {
      return {
        valid: false,
        reason: 'command_task',
        userMessage: '我专注于根据心情推荐饮品😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 12. 天气/新闻/股票
    if (/天气.*怎么样|今天.*(下雨|晴天|多云)|.*(比赛|比分|赢了|输了)|.*(股票|基金|涨|跌)/.test(lower)) {
      return {
        valid: false,
        reason: 'weather_news_stock',
        userMessage: '我专注于根据心情推荐饮品😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 13. 技术/学术问题
    if (/(代码|编程|bug|算法|数据|模型|训练|神经网络|量子|物理|化学|数学).*(问题|怎么|为什么|是什么)/.test(lower)) {
      return {
        valid: false,
        reason: 'tech_academic',
        userMessage: '我专注于根据心情推荐饮品，而不是解答技术问题😅 可以告诉我你现在的心情吗？'
      };
    }
    
    // 14. 模糊多情绪（需要澄清）
    const emotions = ['开心', '难过', '生气', '焦虑', '累', '兴奋', '烦', '郁闷'];
    const foundEmotions = emotions.filter(e => lower.includes(e));
    if (foundEmotions.length >= 3) {
      return {
        valid: false,
        reason: 'ambiguous_multi_emotion',
        userMessage: '你提到了好几种情绪😅 可以告诉我此刻最强烈的一种感受吗？'
      };
    }
    
    // 15. 过长文本无关键词
    const relevantKeywords = [
      '心情', '情绪', '感觉', '感受', '开心', '快乐', '难过', '伤心', '生气', '愤怒', 
      '烦躁', '焦虑', '压力', '累', '疲惫', '舒服', '不爽', '郁闷', 'emo', '痛苦', 
      '身体', '头疼', '头晕', '冷', '热', '发烧', '感冒', '胃', '肚子', '饿', '渴', 
      '困', '失眠', '酸痛', '难受', '闷', '堵', '想', '要', '需要', '发泄', '放松', 
      '安静', '独处', '社交', '聚会', '庆祝', '安慰', '鼓励', '动力', '能量', '清醒', 
      '醉', '微醺', '今天', '刚才', '最近', '工作', '学习', '考试', '加班', '熬夜', 
      '约会', '失恋', '分手', '吵架', '成功', '失败', '早上', '上午', '中午', '下午', 
      '晚上', '深夜', '凌晨', '很', '非常', '特别', '有点', '稍微', '太', '超级'
    ];
    const hasRelevantKeyword = relevantKeywords.some(kw => lower.includes(kw));
    if (!hasRelevantKeyword && trimmed.length > 20) {
      return {
        valid: false,
        reason: 'no_keywords_long_text',
        userMessage: '你说了好多，但我有点没get到重点😅 可以简单说下你现在的心情或身体状态吗？'
      };
    }
    
    return { valid: true };
  }

  /**
   * 核心处理：调用API解析用户输入
   */
  async process(context) {
    const { userInput, currentTime } = context;
    
    // 调用后端API进行情绪分析
    const response = await fetch('/api/analyze_mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userInput,
        current_time: currentTime
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // 处理验证错误
      if (response.status === 400 && errorData.error) {
        throw new Error(`VALIDATION:${errorData.error}`);
      }
      
      // 处理超时错误
      if (response.status === 504 || errorData.error === 'timeout') {
        context.setIntermediate('timeoutOccurred', true);
        throw new Error('TIMEOUT');
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }

    // 存储结果到上下文
    context.setIntermediate('moodData', result.data);
    context.setIntermediate('rawResponse', result.raw_response);
    
    return result.data;
  }

  /**
   * 错误处理与降级
   */
  async handleError(error, context) {
    const isTimeout = error.name === 'AbortError' || 
                      error.message?.includes('timeout') ||
                      error.message === 'TIMEOUT';
    
    if (isTimeout) {
      console.error('[SemanticDistiller] API超时，使用本地降级分析');
      
      // 使用本地关键词分析作为降级
      const { localFallbackAnalysis } = await import('../../api/moodAnalyzer');
      const fallback = localFallbackAnalysis(context.userInput);
      
      context.setIntermediate('moodData', fallback);
      context.setIntermediate('usedFallback', true);
      context.setIntermediate('timeoutOccurred', true);
      
      return {
        ...fallback,
        _timeoutHandled: true,
        _fallbackMessage: '分析服务响应较慢，已使用本地智能继续推荐。如需更精准推荐，可简化输入后重试。'
      };
    }
    
    // 验证错误不需要降级，直接抛出
    if (error.message?.startsWith('VALIDATION:')) {
      throw error;
    }
    
    return null;
  }

  /**
   * 输出验证
   */
  validateOutput(result) {
    if (!result || typeof result !== 'object') {
      return { valid: false, reason: 'Invalid output format' };
    }
    
    // 检查必要的维度
    const requiredDimensions = ['emotion', 'somatic', 'time', 'cognitive', 'demand', 'socialContext'];
    const missing = requiredDimensions.filter(dim => !result[dim]);
    
    if (missing.length > 0) {
      return { valid: false, reason: `Missing dimensions: ${missing.join(', ')}` };
    }
    
    return { valid: true };
  }
}

export default SemanticDistiller;

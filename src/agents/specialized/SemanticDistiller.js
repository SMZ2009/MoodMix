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
      timeout: 45000,  // 增加到 45 秒超时，应对复杂流式解析
      maxRetries: 3,
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
        userMessage: '心里装着什么？说与我听，我为你寻一杯。'
      };
    }

    const trimmed = originalInput.trim();
    const lower = trimmed.toLowerCase();

    // 2. 长度检查
    if (trimmed.length > 200) {
      return {
        valid: false,
        reason: 'too_long',
        userMessage: '话多情深，但我只需知道——此刻，你是什么滋味？'
      };
    }

    // 3. 纯数字
    if (/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'unsupported_format_numbers',
        userMessage: '数字难解心意，用几个字告诉我你的心境吧。'
      };
    }

    // 4. 纯字母
    if (/^[a-zA-Z]+$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'unsupported_format_letters',
        userMessage: '字母难诉心绪，换几个汉字说说你此刻的感受？'
      };
    }

    // 5. 纯特殊字符
    if (/^[^\u4e00-\u9fa5a-zA-Z0-9]+$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'unsupported_format_special',
        userMessage: '符号无声，心情有味——用文字告诉我吧。'
      };
    }

    // 6. 无意义重复数字
    if (/^(\d)\1{2,}$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_numbers',
        userMessage: '这串数字，我读不懂。此刻心里是什么感觉？'
      };
    }

    // 7. 无意义重复字母
    if (/^([a-z])\1{2,}$/i.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_letters',
        userMessage: '这串字母，我读不懂。换个方式说说你的心情？'
      };
    }

    // 8. 键盘乱序
    if (/^(asdf|qwer|zxcv|wasd|fdsa|rewq|vcxz|qwerty|asdfgh|zxcvbn)$/i.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_keyboard',
        userMessage: '是心乱了吗？没关系，试着说说此刻的感受。'
      };
    }

    // 9. 无意义重复汉字（排除情绪表达）
    const emotionalRepetitions = ['哈哈', '嘿嘿', '呵呵', '呜呜', '啊啊'];
    const isEmotional = emotionalRepetitions.some(emo => trimmed.includes(emo));
    if (!isEmotional && /^(啊|哦|嗯|呃|哎|哟|喂){3,}$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'gibberish_chinese',
        userMessage: '话语兖了圈，说说你真正想表达的是什么？'
      };
    }

    // 10. 知识性问题
    if (/什么是|什么叫|怎么.*做|如何.*做|为什么.*会|解释.*一下|介绍一下|告诉我.*关于/.test(lower)) {
      return {
        valid: false,
        reason: 'knowledge_question',
        userMessage: '我只懂以饮识心。告诉我你此刻的心境，其余交给我。'
      };
    }

    // 11. 指令/任务
    if (/帮我.*(订|点|买|查|搜|找)|给我.*(推荐|建议)|打开.*(软件|应用|程序)|设置.*(提醒|闹钟)/.test(lower)) {
      return {
        valid: false,
        reason: 'command_task',
        userMessage: '我只做一件事——寻一杯与你此刻相配的饮品。'
      };
    }

    // 12. 天气/新闻/股票
    if (/天气.*怎么样|今天.*(下雨|晴天|多云)|.*(比赛|比分|赢了|输了)|.*(股票|基金|涨|跌)/.test(lower)) {
      return {
        valid: false,
        reason: 'weather_news_stock',
        userMessage: '世事纷扰，我只问你一句：此刻，心里是什么滋味？'
      };
    }

    // 13. 技术/学术问题
    if (/(代码|编程|bug|算法|数据|模型|训练|神经网络|量子|物理|化学|数学).*(问题|怎么|为什么|是什么)/.test(lower)) {
      return {
        valid: false,
        reason: 'tech_academic',
        userMessage: '学问之外，我只懂以味抚心。说说你的心境？'
      };
    }

    // 14. 模糊多情绪（需要澄清）
    const emotions = ['开心', '难过', '生气', '焦虑', '累', '兴奋', '烦', '郁闷'];
    const foundEmotions = emotions.filter(e => lower.includes(e));
    if (foundEmotions.length >= 3) {
      return {
        valid: false,
        reason: 'ambiguous_multi_emotion',
        userMessage: '情绪如水，几股交汇。此刻，哪一股最涌？'
      };
    }

    return { valid: true };
  }

  /**
   * 核心处理：通过 SSE 流式调用 API 解析用户输入
   */
  async process(context) {
    const { userInput, currentTime } = context;

    let lastError = null;
    let attempts = 0;

    while (attempts < this.maxRetries) {
      attempts++;
      try {
        const streamStart = performance.now();
        console.log(`[SemanticDistiller] 使用流式 SSE 端点 (尝试 ${attempts}/${this.maxRetries})`);

        // 使用流式端点
        const response = await fetch('/api/analyze_mood_stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_input: userInput,
            current_time: currentTime
          })
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // 消费 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let lineBuffer = '';
        let result = null;
        let tokenCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });

          let newlineIndex;
          while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
            const line = lineBuffer.slice(0, newlineIndex).trim();
            lineBuffer = lineBuffer.slice(newlineIndex + 1);

            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              if (data.done) {
                // 流结束
                if (data.error) {
                  throw new Error(data.error);
                }
                result = data.data;
                break;
              } else if (data.delta) {
                accumulated += data.delta;
                tokenCount++;
              }
            } catch (e) {
              // 忽略解析失败的中间片段，但记录日志方便排查
              console.debug('[SemanticDistiller] Chunk parse skipped:', line);
            }
          }

          if (result) break;
        }

        // 处理最后剩余的 lineBuffer (如果没有以 \n 结尾)
        if (!result && lineBuffer.trim().startsWith('data: ')) {
          try {
            const data = JSON.parse(lineBuffer.trim().slice(6));
            if (data.done) result = data.data;
          } catch (e) { }
        }

        // 如果流式没有返回解析好的 data，尝试从累积的文本自行解析
        if (!result && accumulated) {
          try {
            const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
            result = JSON.parse(jsonMatch ? jsonMatch[0] : accumulated);
          } catch (e) {
            throw new Error('无法从流式输出解析 JSON');
          }
        }

        if (!result) {
          throw new Error('流式返回空内容');
        }

        const streamEnd = performance.now();
        console.log(`[SemanticDistiller] 流式完成: ${tokenCount} tokens, ${Math.round(streamEnd - streamStart)}ms`);

        // 存储结果到上下文
        context.setIntermediate('moodData', result);

        return result;

      } catch (err) {
        lastError = err;
        console.warn(`[SemanticDistiller] 尝试 ${attempts} 失败: ${err.message}`);
        // 验证错误不需要重试，直接抛出
        if (err.message?.startsWith('VALIDATION:')) {
          throw err;
        }
        // 如果还有重试机会，等待一小段时间
        if (attempts < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay || 1000));
        }
      }
    }

    throw lastError || new Error('多次尝试均失败');
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
        _fallbackMessage: '网络响应较慢，已使用本地智能分析继续推荐～如果结果不太满意，可以稍微简化一下描述再试一次哦！',
        _userFriendlyMessage: '网络有点慢，但我已经根据你的描述给出了推荐！试试看这杯饮品是否符合你的心情～'
      };
    }

    // 验证错误不需要降级，直接抛出
    if (error.message?.startsWith('VALIDATION:')) {
      throw error;
    }

    return null;
  }

  /**
   * 输出验证 - 允许部分维度缺失，使用默认值填充
   */
  validateOutput(result) {
    if (!result || typeof result !== 'object') {
      return { valid: false, reason: 'Invalid output format' };
    }

    // 检查必要的维度
    const requiredDimensions = ['emotion', 'somatic', 'time', 'cognitive', 'demand', 'socialContext'];
    const missing = requiredDimensions.filter(dim => !result[dim]);

    if (missing.length > 0) {
      console.warn(`[SemanticDistiller] 缺少维度: ${missing.join(', ')}，使用默认值填充`);

      // 填充默认值
      const defaults = {
        cognitive: {
          physical: { state: '清晰', intensity: 0.5 },
          drinkMapping: { aromaScore: 5 }
        },
        demand: {
          physical: { state: '放松', intensity: 0.5 },
          drinkMapping: { actionScore: 3 }
        },
        socialContext: {
          physical: { state: '独处', intensity: 0.3 },
          drinkMapping: { ratioScore: 10 }
        }
      };

      missing.forEach(dim => {
        result[dim] = defaults[dim];
      });

      return { valid: true, filled: missing };
    }

    return { valid: true };
  }
}

export default SemanticDistiller;

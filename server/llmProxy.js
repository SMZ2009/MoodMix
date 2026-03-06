/**
 * DashScope (魔搭) API 代理服务器
 * 
 * 职责：
 * 1. 保护 API Key（从 .env 读取，不暴露到前端）
 * 2. 接收前端 POST /api/analyze_mood 请求
 * 3. 拼装 DashScope OpenAI 兼容接口请求并转发
 * 4. 返回大模型响应
 * 
 * 启动: node server/dashscopeProxy.js
 * 默认端口: 3001
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// 加载 .env 文件
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// SiliconFlow API 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

/**
 * 辅助函数：带重试机制的 fetch
 * 解决 SiliconFlow 等 API 偶发的网络连接重置 (ECONNRESET) 或 TLS 握手失败问题
 */
async function fetchWithRetry(url, options, maxRetries = 2, delay = 1000) {
  const fetch = (await import('node-fetch')).default;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Retry] 正在进行第 ${attempt} 次重试... (等待 ${delay * attempt}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }

      const response = await fetch(url, options);

      // 如果是 5xx 错误，也进行重试
      if (!response.ok && response.status >= 500 && attempt < maxRetries) {
        const errorText = await response.text();
        console.warn(`[Retry] API 返回 ${response.status}，准备重试。内容: ${errorText.slice(0, 100)}...`);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('socket disconnected') ||
        error.message.includes('TLS');

      if (isNetworkError && attempt < maxRetries) {
        console.warn(`[Retry] 网络连接异常: ${error.message}，准备重试。`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * 辅助函数：安全解析 JSON 块
 */
function safeParseJSON(content) {
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取 JSON 块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (innerError) {
        console.error('Failed to parse matched JSON block:', innerError.message);
      }
    }
  }
  return null;
}

/**
 * POST /api/analyze_mood
 * 
 * Body: { user_input: string, current_time?: string }
 * Response: { success: boolean, data?: object, error?: string }
 */
app.post('/api/analyze_mood', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({
      success: false,
      error: 'SILICONFLOW_API_KEY 未配置。请在 .env 文件中设置你的 API Key。'
    });
  }

  const { user_input, current_time } = req.body;

  if (!user_input || typeof user_input !== 'string' || !user_input.trim()) {
    return res.status(400).json({
      success: false,
      error: '缺少 user_input 参数'
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s超时

  try {
    const timeInfo = current_time || new Date().toISOString();
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(user_input.trim(), timeInfo);

    const response = await fetchWithRetry(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SiliconFlow API 错误 [${response.status}]:`, errorText);
      return res.status(502).json({
        success: false,
        error: `大模型 API 返回错误: ${response.status}`
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const parsed = safeParseJSON(content);

    if (!parsed) {
      return res.status(502).json({
        success: false,
        error: '无法从大模型输出中解析有效的 JSON 数据'
      });
    }

    console.log(`[${new Date().toLocaleTimeString()}] 分析完成: "${user_input.slice(0, 30)}..." → isNegative=${parsed.isNegative}`);
    res.json({ success: true, data: parsed });

  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] 分析请求失败:`, error);
    const status = error.name === 'AbortError' ? 504 : 500;
    // 强制包装成 JSON 结构返回，防止前端抛出不可捕获的 "HTTP 500" 杂乱字符串
    res.status(status).json({
      success: false,
      error: error.name === 'AbortError' ? '分析请求超时' : `分析失败: ${error.message || '未知内部错误'}`
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

// ═══════════════════════════════════════════
// 端点：动态文案批量生成 (Batch Quote Generator)
// ═══════════════════════════════════════════
/**
 * POST /api/generate_quotes
 * Body: { items: [ { id, name, wuxingLogic } ] }
 * Response: { success: true, quotes: { [id]: "「诗句」" } }
 */
app.post('/api/generate_quotes', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({ success: false, error: 'API Key 未配置' });
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的 items 数组' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s超时

  try {
    // 构造 Batch Prompt
    const systemPrompt = `你是一位深谙东方五行哲学与西方调酒艺术的诗人酒保。
我将提供给你一批饮品的名字，以及它与当前顾客发生的心境碰撞逻辑（五行生克）。

【核心质量要求】：
1. 每一句诗意短句必须【量身定制】，严禁使用模板化、同质化的套话。
2. 诗句应高度契合饮品的名字、口味特征及对应的五行哲学意境（如火的灼热、水的深邃、木的生机）。
3. 风格应像王维的禅意、李白的豪放或杜牧的清丽，且每杯酒之间风格应有所错落。
4. 字数控制在15-20字以内，不带标点，格式必须用「」包裹。
5. 你必须严格输出一个合法的 JSON Object，Key 是传入的 ID，Value 是对应诗句。禁止任何解释性文字！

【意境参考】：
- 水生木 (滋养)：以沉静之味，养住躁动的气
- 金克木 (压胜)：以肃杀之气，收住疯长的枝蔓
- 木遇木 (共振)：同气求索，让躁动找到最佳出口`;

    let userContent = "请为以下饮品（共计 ${items.length} 款）生成各具灵魂的专属定制文案：\n\n";
    items.forEach((item, index) => {
      userContent += `${index + 1}. [ID: ${item.id}] 饮品名: ${item.name}, 五行生克关联: ${item.wuxingLogic}\n`;
    });
    userContent += "\n请严格按 ID 映射返回 JSON 数据：";

    const response = await fetchWithRetry(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`QuoteGenerator API 错误 [${response.status}]:`, errorText);
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const parsedQuotes = safeParseJSON(content) || {};

    console.log(`[QuoteGenerator] Batch generated ${Object.keys(parsedQuotes).length} quotes successfully.`);
    res.json({ success: true, quotes: parsedQuotes });

  } catch (error) {
    console.error('[QuoteGenerator] Error:', error.message);
    const status = error.name === 'AbortError' ? 504 : 500;
    res.status(status).json({
      success: false,
      error: error.name === 'AbortError' ? '生成请求超时' : error.message
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

// ═══════════════════════════════════════════
// Prompt 工程
// ═══════════════════════════════════════════

function buildSystemPrompt() {
  return `你是 MoodMix 心境分析引擎。你的任务是分析用户输入的一句话，从六个维度进行深度解析。
每个维度同时包含"真实物理世界"和"东方哲学"两个层面。

你必须严格返回 JSON 格式，不要添加任何额外文字。

## 六维分析框架

### 1. 情绪维度 (emotion)
- 物理层面：识别用户语段中表达的具体情感状态（如：沮丧、愤怒、狂喜）及其对应的生理反应
- 东方哲学：映射至"五志"与五行归经
  - 肝（怒）→ 木 → 酸味、青/绿色
  - 心（喜）→ 火 → 苦味、红色
  - 脾（思）→ 土 → 甘味、黄色
  - 肺（悲）→ 金 → 辛味、白/透明
  - 肾（恐）→ 水 → 咸味、黑/深色
- 对应饮品画像维度：味觉、颜色

### 2. 躯体维度 (somatic)
- 物理层面：识别用户提到的生理感受（如发热、发冷、胸闷、肌肉紧绷、乏力）
- 东方哲学：分析"气机"运行状态（升、降、浮、沉）以及整体阴阳偏性
- 对应饮品画像维度：温度、触觉、比例

### 3. 时间维度 (time)
- 重要：如果用户明确输入具体时间（如"今晚"、"明天早上"），按用户输入时间为准；否则使用当前现实时间
- 物理层面：获取用户所处的现实物理时间及季节/天气
- 东方哲学：对应"天人相应"理论中的二十四节气与十二时辰律动
- 对应饮品画像维度：时序

### 4. 认知维度 (cognitive)
- 物理层面：识别用户当前的思维模式，如复盘工作、钻牛角尖、回忆往事或大脑空白
- 东方哲学：判断神志的清晰度与"神"的归位状态（如思虑过度伤脾、惊恐伤神）
- 对应饮品画像维度：嗅觉（经络走窜）

### 5. 诉求维度 (demand)
- 物理层面：提取用户明确表达的欲望或改变行为（如：想发泄、想静静、想找回动力）
- 东方哲学：寻找"道在日用"中的仪轨道场，将行为转化为心理能量转化契机
  - 止：安住不动
  - 动：主动宣发
  - 破：打破困境
- 对应饮品画像维度：动作

### 6. 社交/环境维度 (socialContext)
- 物理层面：识别用户当前所处的物理空间（办公室、深夜卧室、嘈杂派对）及人际状态（独处或群居）
- 东方哲学：判断"内外边界"的和谐度——是需要"纳气归根（内向）"还是"顺势宣发（外向）"
- 对应饮品画像维度：动作、比例

## 输出 JSON Schema

{
  "emotion": {
    "physical": {
      "state": "string — 具体情感状态描述",
      "intensity": "number 0.0-1.0 — 信号强度(I)，指示用户表达该维度的强烈程度"
    },
    "philosophy": {
      "wuxing": "string — 五行归属: 木/火/土/金/水",
      "organ": "string — 脏腑: 肝/心/脾/肺/肾",
      "志": "string — 五志: 怒/喜/思/悲/恐"
    },
    "drinkMapping": {
      "taste": "string — 推荐味道: 酸/苦/甘/辛/咸",
      "tasteScore": "number 0-10 — 味觉强度建议",
      "color": "string — 推荐颜色描述",
      "colorCode": "number 1-5 — 五行色彩编码(1=青绿/木,2=红/火,3=黄/土,4=白/金,5=黑/水)"
    }
  },
  "somatic": {
    "physical": {
      "sensation": "string — 躯体感受描述，若用户未提及则推断",
      "type": "string — 类型: heat/cold/tension/fatigue/numbness/none",
      "intensity": "number 0.0-1.0 — 信号强度(I)"
    },
    "philosophy": {
      "qiState": "string — 气机状态描述",
      "direction": "string — 气机方向: 升/降/浮/沉/郁结/通畅",
      "yinyang": "string — 阴阳偏性: 偏阴/偏阳/阴阳平和/阳郁/阴虚"
    },
    "drinkMapping": {
      "temperature": "number -5~5 — 温度倾向(-5极冰~5极热)",
      "texture": "string — 触觉描述: 气泡/丝滑/浓稠/清冽/温润",
      "textureScore": "number -3~3 — 气机方向值(正=升发,负=沉降)"
    }
  },
  "time": {
    "physical": {
      "hour": "number 0-23 — 时间(小时)",
      "period": "string — 时段: 清晨/上午/中午/下午/傍晚/晚上/深夜",
      "season": "string — 当前季节或节气",
      "intensity": "number 0.0-1.0 — 信号强度(I)"
    },
    "philosophy": {
      "shichen": "string — 十二时辰名称",
      "meridian": "string — 对应经络",
      "solarTerm": "string — 最近的节气"
    },
    "drinkMapping": {
      "temporality": "number 0-23 — 建议饮用时间"
    }
  },
  "cognitive": {
    "physical": {
      "mode": "string — 思维模式描述",
      "clarity": "number 1-10 — 思维清晰度",
      "intensity": "number 0.0-1.0 — 信号强度(I)"
    },
    "philosophy": {
      "shenState": "string — 神志状态描述",
      "归位": "boolean — 神是否归位"
    },
    "drinkMapping": {
      "aroma": "string — 推荐香气类型",
      "aromaScore": "number 0-10 — 香气强度建议"
    }
  },
  "demand": {
    "physical": {
      "desire": "string — 核心诉求描述",
      "direction": "string — 行为方向: 内向收敛/外向释放/寻求平衡",
      "intensity": "number 0.0-1.0 — 信号强度(I)"
    },
    "philosophy": {
      "ritual": "string — 仪轨类型描述",
      "type": "string — 止/动/破"
    },
    "drinkMapping": {
      "action": "string — 推荐调饮动作",
      "actionScore": "number 1-5 — 动作强度(1=静观/啜饮,2=搅拌,3=摇晃,4=捣碎,5=猛烈混合)"
    }
  },
  "socialContext": {
    "physical": {
      "space": "string — 物理空间描述",
      "people": "string — 人际状态: 独处/二人/小聚/派对/不明",
      "intensity": "number 0.0-1.0 — 信号强度(I)"
    },
    "philosophy": {
      "boundary": "string — 内外边界状态",
      "needDirection": "string — 纳气归根/顺势宣发/内外调和"
    },
    "drinkMapping": {
      "action": "string — 社交场景动作建议",
      "actionScore": "number 1-5",
      "ratio": "string — 比例倾向描述",
      "ratioScore": "number 0-95 — 建议ABV浓度"
    }
  },
  "isNegative": "boolean — 是否为负面/需要关怀的情绪",
  "summary": "string — 一句话总结用户当前身心状态（中文，不超过50字）"
}`;
}

function buildUserMessage(userInput, timeInfo) {
  return `当前时间: ${timeInfo}

用户说: "${userInput}"

请根据以上信息，按照系统提示中定义的六维框架进行分析，严格返回 JSON。
如果用户没有明确提及某个维度的信息，请根据上下文合理推断。`;
}

// ─── 启动服务器 ───
app.listen(PORT, () => {
  const hasKey = process.env.SILICONFLOW_API_KEY && process.env.SILICONFLOW_API_KEY !== 'your_key_here';
  console.log(`\n🍹 MoodMix SiliconFlow 代理服务已启动`);
  console.log(`   端口: ${PORT}`);
  console.log(`   模型: ${SILICONFLOW_MODEL}`);
  console.log(`   API Key: ${hasKey ? '✅ 已配置' : '❌ 未配置 — 请在 .env 中设置 SILICONFLOW_API_KEY'}`);
  console.log(`   端点: POST http://localhost:${PORT}/api/analyze_mood\n`);
});

// ═══════════════════════════════════════════
// 全局异常护城河 (Global Exception Guards)
// ═══════════════════════════════════════════
process.on('uncaughtException', (err) => {
  console.error('\n[CRITICAL ERROR] 捕获到未处理的异常 (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n[CRITICAL ERROR] 捕获到未处理的 Promise 拒绝 (Unhandled Rejection):', reason);
});


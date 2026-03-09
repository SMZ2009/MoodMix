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
const PORT = process.env.PORT || process.env.PROXY_PORT || 3001;

// 信任代理（用于云平台如Render.com）
app.set('trust proxy', 1);

// 中间件
app.use(cors({
  origin: true,  // 允许所有origin
  credentials: false  // 不允许credentials
}));
app.use(express.json());

// 处理host header
app.use((req, res, next) => {
  // 允许所有host header
  next();
});

// ═══════════════════════════════════════════
// TheCocktailDB API 代理（解决 CORS 问题）
// ═══════════════════════════════════════════
const COCKTAILDB_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

app.all('/api/cocktaildb/*', async (req, res) => {
  const endpoint = req.params[0];
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${COCKTAILDB_BASE}/${endpoint}${queryString}`;
  
  console.log('[CocktailDB Proxy]', req.method, targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[CocktailDB Proxy Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// SiliconFlow API 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

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

  try {
    // 动态 import node-fetch (ESM)
    const fetch = (await import('node-fetch')).default;

    const timeInfo = current_time || new Date().toISOString();

    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(user_input.trim(), timeInfo);

    // 设置后端物理截断超时 (50秒)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 50000);

    let response;
    try {
      response = await fetch(SILICONFLOW_API_URL, {
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
    } finally {
      clearTimeout(timeoutId);
    }

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

    if (!content) {
      return res.status(502).json({
        success: false,
        error: '大模型返回空内容'
      });
    }

    // 解析 JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      // 尝试提取 JSON 块
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error('无法从大模型输出中解析 JSON');
      }
    }

    console.log(`[${new Date().toLocaleTimeString()}] 分析完成: "${user_input.slice(0, 30)}..." → isNegative=${parsed.isNegative}`);

    res.json({ success: true, data: parsed });

  } catch (error) {
    console.error('分析请求失败:', error.message);
    res.status(500).json({
      success: false,
      error: `分析失败: ${error.message}`
    });
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

  try {
    const fetch = (await import('node-fetch')).default;

    // 构造 Batch Prompt
    const systemPrompt = `你是一位深谙东方五行哲学与西方调酒艺术的诗人酒保。
我将提供给你一批饮品的名字，以及它与当前顾客发生的心境碰撞逻辑。
请你针对每一组，写一句【高度契合这杯酒名字和意境的、不超过20个字】的诗意短句。
短句不带标点，格式必须用「」包裹。
你必须严格输出一个合法的 JSON Object，Key 是传入的饮品 ID，Value 是你写的句子。绝对不要输出其他任何文字！

【参考语境】：
- 辨证(用户状态)：清醒自在 → 策略：以木制衡 → 体感：凉爽·顺滑 → 「金风玉露一相逢」
- 辨证：郁气难舒 → 策略：借辛疏散 → 体感：辛香·开窍 → 「借酒浇愁更愁」
- 辨证：兴致正浓 → 策略：同火共振 → 体感：灼烈·冲击 → 「杯中火焰照丹心」

【重要】：每一杯酒的文案必须完全不同，基于饮品的名字、辨证、策略、体感、饮品profile综合构思！`;

    let userContent = "请为以下饮品生成专属文案：\n";
    items.forEach(item => {
      userContent += `ID: ${item.id}, 饮品名: ${item.name}, 辨证: ${item.diagnosis}, 策略: ${item.strategy}, 体感: ${item.sensory}, 饮品profile: ${item.contextPackage?.drinkProfile}\n`;
    });
    userContent += "\n请返回严格的 JSON 格式：\n{\n";
    items.forEach(item => {
      userContent += `  "${item.id}": "「诗歌」",\n`;
    });
    userContent += "}";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s超时

    let response;
    try {
      response = await fetch(SILICONFLOW_API_URL, {
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
          temperature: 0.7, // 稍微高一点，让诗句更有创造力
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    let parsedQuotes = {};
    if (content) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedQuotes = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        parsedQuotes = JSON.parse(content);
      }
    }

    console.log(`[QuoteGenerator] Batch generated ${Object.keys(parsedQuotes).length} quotes successfully.`);
    res.json({ success: true, quotes: parsedQuotes });

  } catch (error) {
    console.error('[QuoteGenerator] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
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

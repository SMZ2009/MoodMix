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

app.use('/api/cocktaildb', async (req, res) => {
  const path = req.originalUrl.replace('/api/cocktaildb', '') || '/';
  const targetUrl = `${COCKTAILDB_BASE}${path}`;

  console.log('[CocktailDB Proxy]', req.method, targetUrl);

  try {
    const response = await fetch(targetUrl);
    const status = response.status;
    const text = await response.text();
    console.log('[CocktailDB] Status:', status, 'Body:', text.substring(0, 200));

    if (status !== 200) {
      return res.status(status).json({ error: 'CocktailDB API error', status, body: text });
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error) {
    console.error('[CocktailDB Proxy Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// SiliconFlow API 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

// 优先使用原生 fetch (Node 18+)，否则回退到 node-fetch
const getFetch = async () => {
  if (typeof global !== 'undefined' && global.fetch) return global.fetch;
  try {
    return (await import('node-fetch')).default;
  } catch (e) {
    // 某些环境可能不支持 dynamic import
    return null;
  }
};

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
          max_tokens: 800,
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
// 端点：流式情绪分析 (SSE Streaming)
// ═══════════════════════════════════════════
app.post('/api/analyze_mood_stream', async (req, res) => {
  // 设置 SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    const { user_input, current_time } = req.body;
    if (!user_input || typeof user_input !== 'string' || !user_input.trim()) {
      res.write(`data: ${JSON.stringify({ error: '缺少 user_input', done: true })}\n\n`);
      res.end();
      return;
    }

    const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
    if (!apiKey || apiKey === 'your_key_here') {
      res.write(`data: ${JSON.stringify({ error: 'API Key 未配置', done: true })}\n\n`);
      res.end();
      return;
    }

    const currentFetch = await getFetch();
    if (!currentFetch) throw new Error('Fetch implementation not found');

    const timeInfo = current_time || new Date().toISOString();
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(user_input.trim(), timeInfo);

    console.log(`[Stream] 开始请求 SiliconFlow (${SILICONFLOW_MODEL})...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[Stream] 请求超时 (30s)');
      controller.abort();
    }, 30000);

    let response;
    try {
      response = await currentFetch(SILICONFLOW_API_URL, {
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
          max_tokens: 800,
          stream: true
        }),
        signal: controller.signal
      });
    } catch (err) {
      console.error('[Stream] Fetch 网络错误:', err.message);
      res.write(`data: ${JSON.stringify({ error: `网络连接失败: ${err.message}`, done: true })}\n\n`);
      res.end();
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Stream] API 响应错误 [${response.status}]:`, errorText);
      res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}`, done: true })}\n\n`);
      res.end();
      return;
    }

    console.log('[Stream] 收到响应头，正在读取流...');

    let accumulated = '';
    let lineBuffer = '';

    // 统一处理流的辅助函数
    const processChunk = (chunkText) => {
      lineBuffer += chunkText;
      let newlineIndex;
      while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
        const line = lineBuffer.slice(0, newlineIndex).trim();
        lineBuffer = lineBuffer.slice(newlineIndex + 1);

        if (!line.startsWith('data:')) continue;
        const data = line.replace(/^data:\s*/, '').trim();

        if (data === '[DONE]') {
          finishStream();
          return true;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulated += delta;
            res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`);
          }
        } catch (e) {
          // ignore incomplete json from delta
        }
      }
      return false;
    };

    const finishStream = () => {
      if (res.writableEnded) return;
      try {
        const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : accumulated);
        res.write(`data: ${JSON.stringify({ done: true, data: parsed })}\n\n`);
      } catch (e) {
        console.error('[Stream] Final parse error:', e.message);
        res.write(`data: ${JSON.stringify({ done: true, error: '解析失败', raw: accumulated })}\n\n`);
      }
      res.end();
    };

    const reader = response.body;

    if (typeof reader.getReader === 'function') {
      // 这里的 response.body 是 Web ReadableStream (原生 fetch)
      const webReader = reader.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await webReader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          if (processChunk(text)) break;
        }
      } finally {
        webReader.releaseLock();
        finishStream();
      }
    } else {
      // 这里的 response.body 是 Node.js Readable Stream (node-fetch)
      reader.on('data', (chunk) => {
        if (processChunk(chunk.toString())) {
          // done
        }
      });
      reader.on('end', () => {
        finishStream();
      });
      reader.on('error', (err) => {
        console.error('[Stream] Node stream error:', err.message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
          res.end();
        }
      });
    }

  } catch (error) {
    console.error('[Stream] 顶层捕获请求失败:', error.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true, error: error.message })}\n\n`);
      res.end();
    }
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
    const currentFetch = await getFetch();
    if (!currentFetch) throw new Error('Fetch implementation not found');

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
      userContent += `ID: ${item.id}, 饮品名: ${item.name || '未知'}, 辨证: ${item.diagnosis || '无'}, 策略: ${item.strategy || '无'}, 体感: ${item.sensory || '无'}, 饮品profile: ${item.contextPackage?.drinkProfile || '无'}\n`;
    });
    userContent += "\n请返回严格的 JSON 格式，不要包含任何 markdown 代码块标识，也不要有多余文字。注意不要有尾随逗号。格式示例：\n{\n";
    items.forEach((item, index) => {
      userContent += `  "${item.id}": "「诗歌」"${index === items.length - 1 ? '' : ','}\n`;
    });
    userContent += "}";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[QuoteGenerator] Timeout triggered (45s)');
      controller.abort();
    }, 45000); // 45s超时，因为 batch 可能耗时较长

    let response;
    try {
      console.log(`[QuoteGenerator] Requesting batch quotes from ${SILICONFLOW_MODEL}...`);
      response = await currentFetch(SILICONFLOW_API_URL, {
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
          max_tokens: 1000
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[QuoteGenerator] API error response [${response.status}]:`, errorText);
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const result = await response.json();
    const content = (result.choices?.[0]?.message?.content || '').trim();

    let parsedQuotes = {};
    if (content) {
      try {
        // 尝试提取 JSON 内容
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;

        // 健壮处理：移除 JSON 中的尾随逗号 (针对有些模型不听话的情况)
        const sanitizedJson = jsonStr.replace(/,\s*([}\]])/g, '$1');

        parsedQuotes = JSON.parse(sanitizedJson);
      } catch (e) {
        console.error('[QuoteGenerator] JSON Parse Error. Raw content:', content);
        throw new Error('解析生成文案失败: ' + e.message);
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
// 端点：自定义饮品维度生成 (Custom Drink Dimensions Generator)
// ═══════════════════════════════════════════
/**
 * POST /api/generate-drink-dimensions
 * Body: { name: string, description?: string, ingredients?: string[], isAlcoholic?: boolean }
 * Response: { success: boolean, vector?: number[], dimensions?: object, error?: string }
 */
app.post('/api/generate-drink-dimensions', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({ success: false, error: 'API Key 未配置' });
  }

  const { name, description, ingredients, isAlcoholic } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: '缺少饮品名称' });
  }

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) throw new Error('Fetch implementation not found');

    const systemPrompt = `你是一位调酒和饮品专家，精通东方五行哲学与饮品风味分析。
根据用户描述的饮品信息，生成8维风味向量。

你必须严格返回 JSON 格式，不要添加任何额外文字。

## 8维向量说明
1. taste (主味分值): 0-10 (0=无味, 5=适中, 10=浓烈)
2. texture (气机方向): -3~3 (-3=下沉, 0=平衡, 3=上扬)
3. temperature (阴阳): -5~5 (-5=极冰, 0=常温, 5=热饮)
4. element (五行): 1-5 (1=木/绿, 2=火/红, 3=土/黄, 4=金/白, 5=水/黑)
5. time (适饮时段): 0-23 (小时)
6. aroma (香气强度): 0-10
7. abv (酒精度%): 0-95
8. action (冥想类型): 1-5 (1=专注, 2=放松, 3=社交, 4=独处, 5=庆祝)

## 输出 JSON Schema
{
  "vector": [number, number, number, number, number, number, number, number],
  "dimensions": {
    "sweetness": { "value": number, "label": "string" },
    "sourness": { "value": number, "label": "string" },
    "bitterness": { "value": number, "label": "string" },
    "temperature": { "value": number, "label": "string" },
    "aroma": { "value": number, "label": "string" },
    "texture": { "value": number, "label": "string" },
    "strength": { "value": number, "label": "string" }
  },
  "reasoning": "string — 简短的分析理由"
}`;

    const userContent = `请为以下饮品生成8维风味向量：

饮品名称：${name.trim()}
口感描述：${description || '未提供'}
主要原料：${ingredients && Array.isArray(ingredients) && ingredients.length > 0 ? ingredients.join(', ') : '未提供'}
含酒精：${isAlcoholic ? '是' : '否'}

请根据以上信息，结合你的专业知识推断合理的风味向量。`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      console.log(`[DrinkDimensions] Requesting analysis for "${name}" using ${SILICONFLOW_MODEL}...`);
      response = await currentFetch(SILICONFLOW_API_URL, {
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
          temperature: 0.5
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
    const content = (result.choices?.[0]?.message?.content || '').trim();

    let parsed = {};
    if (content) {
      try {
        // 尝试提取 JSON 内容
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;

        // 健壮处理：移除 JSON 中的尾随逗号
        const sanitizedJson = jsonStr.replace(/,\s*([}\]])/g, '$1');

        parsed = JSON.parse(sanitizedJson);
      } catch (e) {
        console.error('[DrinkDimensions] JSON Parse Error. Raw content:', content);
        throw new Error('解析饮品维度失败: ' + e.message);
      }
    }

    // 验证向量格式
    if (!parsed.vector || !Array.isArray(parsed.vector) || parsed.vector.length !== 8) {
      console.error('[DrinkDimensions] Invalid vector format:', parsed.vector);
      throw new Error('生成的向量格式不正确');
    }

    console.log(`[DrinkDimensions] Generated vector for "${name}": [${parsed.vector.join(', ')}]`);
    res.json({
      success: true,
      vector: parsed.vector,
      dimensions: parsed.dimensions,
      reasoning: parsed.reasoning
    });

  } catch (error) {
    console.error('[DrinkDimensions] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// Prompt 工程
// ═══════════════════════════════════════════

function buildSystemPrompt() {
  return `你是 MoodMix 心境分析引擎。分析用户的一句话，从六个维度提取饮品推荐所需的结构化数据。
严格返回 JSON，不加任何额外文字。

## 六维框架（每个维度包含 physical + philosophy + drinkMapping）

1. **emotion** - 情绪 → 五行映射(木怒酸/火喜苦/土思甘/金悲辛/水恐咸)
2. **somatic** - 躯体感受 → 气机方向(升降浮沉) + 阴阳
3. **time** - 时间 → 时辰/节气（用户未提及则用当前时间）
4. **cognitive** - 认知/思维模式 → 神志状态
5. **demand** - 诉求(止/动/破) → 仪轨类型
6. **socialContext** - 社交环境 → 独处/群居

## 输出 JSON（严格遵循此结构）

{
  "emotion": {
    "physical": { "state": "string", "intensity": 0.0-1.0 },
    "philosophy": { "wuxing": "木/火/土/金/水", "organ": "肝/心/脾/肺/肾" },
    "drinkMapping": { "tasteScore": 0-10, "colorCode": 1-5 }
  },
  "somatic": {
    "physical": { "sensation": "string", "intensity": 0.0-1.0 },
    "philosophy": { "direction": "升/降/浮/沉/郁结/通畅", "yinyang": "偏阴/偏阳/阴阳平和" },
    "drinkMapping": { "temperature": -5到5, "textureScore": -3到3 }
  },
  "time": {
    "physical": { "hour": 0-23, "period": "string", "intensity": 0.0-1.0 },
    "drinkMapping": { "temporality": 0-23 }
  },
  "cognitive": {
    "physical": { "state": "string", "intensity": 0.0-1.0 },
    "drinkMapping": { "aromaScore": 0-10 }
  },
  "demand": {
    "physical": { "state": "string", "intensity": 0.0-1.0 },
    "philosophy": { "type": "止/动/破" },
    "drinkMapping": { "actionScore": 1-5 }
  },
  "socialContext": {
    "physical": { "state": "string", "intensity": 0.0-1.0 },
    "drinkMapping": { "ratioScore": 0-95 }
  },
  "isNegative": false,
  "negativeIntent": "vent/soothe/unclear",
  "summary": "一句话总结(中文≤30字)"
}`;
}

function buildUserMessage(userInput, timeInfo) {
  return `当前时间: ${timeInfo}

用户说: "${userInput}"

请根据以上信息，按照系统提示中定义的六维框架进行分析，严格返回 JSON。
如果用户没有明确提及某个维度的信息，请根据上下文合理推断。`;
}

// ═══════════════════════════════════════════
// 饮品制作助手 API
// ═══════════════════════════════════════════
app.post('/api/drink-assistant', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({
      success: false,
      error: 'SILICONFLOW_API_KEY 未配置'
    });
  }

  const { drink, question, userInventory } = req.body;

  if (!drink || !question) {
    return res.status(400).json({
      success: false,
      error: '缺少 drink 或 question 参数'
    });
  }

  try {
    const fetch = (await import('node-fetch')).default;

    // 构建配方信息
    const ingredientList = drink.ingredients?.map(ing =>
      `${ing.name || ing.ingredient}: ${ing.measure || ''}`
    ).join('\n') || '未知配方';

    // 构建用户库存信息
    const inventoryText = userInventory?.length > 0
      ? userInventory.join('、')
      : '未提供库存信息';

    const systemPrompt = `你是一位专业调酒师助手，擅长解决制作饮品时遇到的各种问题。

你的回答应该：
1. 简洁实用，控制在150字内
2. 具体到用量/比例
3. 口语化、友好亲切的语气
4. 如果是口味问题，给出具体调整建议
5. 如果是原料缺失，优先推荐用户库存中有的替代品，若无则推荐常见替代
6. 如果是工具问题，给出家庭常见物品的替代方案`;

    const userMessage = `用户正在制作: ${drink.name || '未知饮品'}

【饮品配方】
${ingredientList}

【用户库存】
${inventoryText}

【用户问题】
${question}

请给出实用建议。`;

    const response = await fetch(SILICONFLOW_API_URL, {
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
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Drink Assistant] API error:', errorText);
      return res.status(response.status).json({ success: false, error: errorText });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '抱歉，暂时无法回答。';

    res.json({ success: true, answer });
  } catch (error) {
    console.error('[Drink Assistant] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 启动服务器 ───
app.listen(PORT, () => {
  const hasKey = process.env.SILICONFLOW_API_KEY && process.env.SILICONFLOW_API_KEY !== 'your_key_here';
  console.log(`\n🍹 MoodMix SiliconFlow 代理服务已启动`);
  console.log(`   端口: ${PORT}`);
  console.log(`   模型: ${SILICONFLOW_MODEL}`);
  console.log(`   API Key: ${hasKey ? '✅ 已配置' : '❌ 未配置 — 请在 .env 中设置 SILICONFLOW_API_KEY'}`);
  console.log(`   端点: POST http://localhost:${PORT}/api/analyze_mood\n`);
});

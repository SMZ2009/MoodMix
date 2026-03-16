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
const { createServer } = require('http');
const { Server } = require('socket.io');

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

app.get('/', (req, res) => res.send(' MoodMix LLM Proxy is running.'));

// 全局异常处理，防止进程崩溃
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

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

// ═══════════════════════════════════════════
// 鸡尾酒图片代理（解决图片加载失败问题）
// ═══════════════════════════════════════════
app.get('/api/cocktail_image/:imageName', async (req, res) => {
  const imageName = req.params.imageName;
  const targetUrl = `https://www.thecocktaildb.com/images/media/drink/${imageName}`;

  const currentFetch = await getFetch();
  if (!currentFetch) return res.status(500).send('Fetch implementation not found');

  try {
    const response = await currentFetch(targetUrl);
    if (!response.ok) return res.status(response.status).send('Image fetch failed');

    // 转发原始 Content-Type
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // 设置长时间缓存
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // 流式转发
    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      // 针对原生 fetch 返回的 Web ReadableStream
      const reader = response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        pump();
      };
      pump().catch(err => {
        console.error('[Image Pipe Error]', err);
        res.end();
      });
    }
  } catch (error) {
    console.error('[Image Proxy Error]', error);
    res.status(502).send('Gateway Error: Image unreachable');
  }
});

// SiliconFlow API 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL_8B = process.env.SILICONFLOW_MODEL_8B || 'Qwen/Qwen2.5-7B-Instruct';
const MODEL_30B = process.env.SILICONFLOW_MODEL_30B || 'Qwen/Qwen2.5-32B-Instruct';

// 按照 Agent 职责分类使用的模型
const MODEL_CORE = process.env.SILICONFLOW_MODEL_CORE || MODEL_8B; // 核心提取 (7B)
const MODEL_CREATIVE = process.env.SILICONFLOW_MODEL_CREATIVE || MODEL_30B; // 创意文案 (32B)

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
    // 动态获取 fetch 实现
    const fetch = await getFetch();
    if (!fetch) throw new Error('Fetch implementation not found');

    const timeInfo = current_time || new Date().toISOString();

    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(user_input.trim(), timeInfo);

    // 设置后端物理截断超时 (50秒)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000); // 增加到 60 秒，确保后端不会先于前端超时太多

    let response;
    try {
      response = await fetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL_CORE,
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

    console.log(`[Stream] 开始请求 SiliconFlow (${MODEL_8B})...`);

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
          model: MODEL_CORE,
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
/**
 * POST /api/generate_quotes
 * 
 * 为推荐饮品批量生成【标签】和【推荐语】
 * 
 * Body: { items: [ { id, name, contextPackage, userWuxing, strategyType } ] }
 * Response: { success: true, quotes: { [id]: { tags: [...], quote: "..." } } }
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

    // 构造同时生成标签和文案的 Prompt
    const systemPrompt = `你是一位深谙东方五行哲学与现代调酒艺术的专业酒保。
你的任务是为顾客的推荐饮品生成【三枚标签】和【一句推荐语】。

## 三枚标签要求

标签共同讲述一个"辨证施饮"故事链：你现在怎么了 -> 需要什么调理 -> 这杯酒喝起来什么感觉

### 标签1：辨证标签（你现在怎么了）
- 4个汉字，描述用户当前的身心状态
- 用自然的人话，不用中医术语
- 示例：郁气难舒、心绪浮躁、兴致正浓、倦怠沉闷、感伤低落、不安焦虑

### 标签2：策略标签（需要什么调理）
- 4-6个汉字，以"以/借/同"开头
- 描述饮品如何调理用户状态
- 示例：以金制衡、借火生发、同水共振、以木滋养

### 标签3：体感标签（喝起来什么感觉）
- 格式为"XX·YY"，4-6个汉字
- "·"前描述入口第一感，"·"后描述饮后走向
- 示例：清冽·沉降、温润·舒展、辛香·升提、冰润·收束

## 推荐语要求

1. **长度**：25-45字，禁止少于20字
2. **三段式结构**：[当前状态] + [饮品特征细节] + [调理动作/目的]
3. **口语化叙事**：自然平和，禁止四字词语堆砌，禁止古风诗词感
4. **格式**：不带标点，用「」包裹

## 输出格式

严格输出JSON Object，每个饮品ID对应一个对象：
{
  "饮品ID": {
    "tags": ["辨证标签", "策略标签", "体感标签"],
    "quote": "「推荐语内容」"
  }
}

## 示例
{
  "drink_001": {
    "tags": ["郁气难舒", "以金疏散", "辛香·开窍"],
    "quote": "「因为最近总是觉得心里闷闷的，这杯带有辛香的金酒正好能帮你把那股气散开，让整个人都通透不少」"
  }
}

绝对不要输出其他任何文字！`;

    let userContent = `用户当前心境总结: ${items[0].contextPackage?.moodSummary || '未知'}\n`;
    userContent += `用户主五行属性: ${items[0].userWuxing || '未知'}\n`;
    userContent += `用户调理策略: ${items[0].strategyType || '未知'}\n\n`;
    userContent += "请为以下饮品生成专属标签和文案：\n\n";

    items.forEach((item, index) => {
      userContent += `[饮品 ${index + 1}]\n`;
      userContent += `- ID: ${item.id}\n`;
      userContent += `- 名称: ${item.name || '未知'}\n`;
      userContent += `- 物理特性: ${item.contextPackage?.drinkProfile || '口感平衡'}\n\n`;
    });

    userContent += "请严格按照JSON格式输出，不要有任何开场白或解释。";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[QuoteGenerator] Timeout triggered (45s)');
      controller.abort();
    }, 45000);

    let response;
    try {
      console.log(`[QuoteGenerator] Requesting batch tags+quotes from ${MODEL_CREATIVE}...`);
      response = await currentFetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL_CREATIVE,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.7,
          max_tokens: 2000
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

    let parsedResult = {};
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        const sanitizedJson = jsonStr.replace(/,\s*([}\]])/g, '$1');
        parsedResult = JSON.parse(sanitizedJson);
      } catch (e) {
        console.error('[QuoteGenerator] JSON Parse Error. Raw content:', content);
        throw new Error('解析生成文案失败: ' + e.message);
      }
    }

    // 兼容旧格式：将新格式转换为包含tags和quote的对象
    const quotesWithTags = {};
    for (const [drinkId, data] of Object.entries(parsedResult)) {
      if (typeof data === 'object' && data.tags && data.quote) {
        // 新格式，直接使用
        quotesWithTags[drinkId] = data;
      } else if (typeof data === 'string') {
        // 旧格式（只有quote字符串），添加默认tags
        quotesWithTags[drinkId] = {
          tags: ['待辨证', '调和气机', '口感待品'],
          quote: data
        };
      }
    }

    console.log(`[QuoteGenerator] Batch generated ${Object.keys(quotesWithTags).length} tags+quotes successfully.`);
    res.json({ success: true, quotes: quotesWithTags });

  } catch (error) {
    console.error('[QuoteGenerator] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// 端点：原料分类与名称标准化 (Ingredient Classification & Normalization)
// ═══════════════════════════════════════════

// 常见原料别名映射表（硬编码，确保精准匹配）
const INGREDIENT_ALIASES = {
  // 水果类别名
  '奇异果': { normalized: '猕猴桃', category: '水果' },
  '猎猴桃': { normalized: '猕猴桃', category: '水果' },
  '凤梨': { normalized: '菠萝', category: '水果' },
  '波罗': { normalized: '菠萝', category: '水果' },
  '西柚': { normalized: '葡萄柚', category: '水果' },
  '胡柚': { normalized: '葡萄柚', category: '水果' },
  '士多啤梨': { normalized: '草莓', category: '水果' },
  '柳橙': { normalized: '橙子', category: '水果' },
  '柳丁': { normalized: '橙子', category: '水果' },
  '车厘子': { normalized: '樱桃', category: '水果' },
  '番茄': { normalized: '番茄', category: '水果' },
  '西红柿': { normalized: '番茄', category: '水果' },
  // 果汁类别名
  '奇异果汁': { normalized: '猕猴桃汁', category: '果汁' },
  '凤梨汁': { normalized: '菠萝汁', category: '果汁' },
  '西柚汁': { normalized: '葡萄柚汁', category: '果汁' },
  '番茄汁': { normalized: '番茄汁', category: '果汁' },
  '西红柿汁': { normalized: '番茄汁', category: '果汁' },
  // 乳制品
  '忌廉': { normalized: '奶油', category: '乳制品/蛋类' },
  '鲜奶油': { normalized: '奶油', category: '乳制品/蛋类' },
  '淡奶': { normalized: '炼乳', category: '乳制品/蛋类' },
  '炼奶': { normalized: '炼乳', category: '乳制品/蛋类' },
  // 气泡饮料
  '梳打水': { normalized: '苏打水', category: '气泡饮料' },
  '汽水': { normalized: '苏打水', category: '气泡饮料' },
  '气泡水': { normalized: '苏打水', category: '气泡饮料' },
  // 香草香料
  '薄荷叶': { normalized: '薄荷', category: '香草/香料' },
  '新鲜薄荷': { normalized: '薄荷', category: '香草/香料' },
  '九层塔': { normalized: '罗勒', category: '香草/香料' },
  // 基酒
  '伏特加酒': { normalized: '伏特加', category: '基酒' },
  '白兰地酒': { normalized: '白兰地', category: '基酒' },
  '威士忌酒': { normalized: '威士忌', category: '基酒' },
  '金酒': { normalized: '金酒', category: '基酒' },
  '朗姆酒': { normalized: '朗姆酒', category: '基酒' },
  '龙舌兰酒': { normalized: '龙舌兰', category: '基酒' },
};

app.post('/api/classify_ingredient', async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: '缺少原料名称' });
  }

  const inputName = name.trim();
  
  // ═══ 第一步：硬编码别名查表（最快最准） ═══
  if (INGREDIENT_ALIASES[inputName]) {
    const match = INGREDIENT_ALIASES[inputName];
    console.log(`[ClassifyIngredient] 硬匹配: "${inputName}" -> category: ${match.category}, normalized: ${match.normalized}`);
    return res.json({
      success: true,
      category: match.category,
      normalized_name: match.normalized,
      original_input: inputName
    });
  }

  // ═══ 第二步：调用LLM进行智能分类 ═══
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'API Key 未配置' });
  }

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) throw new Error('Fetch implementation not found');

    const CATEGORIES = [
      '基酒', '利口酒', '苦精', '果汁', '水果', '糖浆/甜味剂', '气泡饮料',
      '乳制品/蛋类', '香草/香料', '装饰', '其他'
    ];

    const systemPrompt = `你是调酒原料分类专家。将原料分类并返回标准化名称。

分类选项：${CATEGORIES.join('、')}

分类规则：
- 基酒：伏特加、威士忌、金酒、朗姆酒、龙舌兰、白兰地等烈酒
- 果汁：柠檬汁、橙汁、菠萝汁、番茄汁等
- 水果：柠檬、草莓、樱桃、猕猴桃、菠萝、橙子等新鲜水果
- 糖浆/甜味剂：糖浆、蜂蜜、石榴糖浆等
- 气泡饮料：苏打水、汤力水、可乐等
- 乳制品/蛋类：牛奶、奶油、蛋白、蛋黄等
- 香草/香料：薄荷、肉桂、罗勒等

返回JSON: {"category":"分类","normalized_name":"标准名"}`;

    const userMessage = `原料名称：${name.trim()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await currentFetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL_8B,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const result = await response.json();
    const content = (result.choices?.[0]?.message?.content || '').trim();

    let category = '其他';
    let normalizedName = name.trim();
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.category && CATEGORIES.includes(parsed.category)) {
          category = parsed.category;
        }
        if (parsed.normalized_name) {
          normalizedName = parsed.normalized_name;
        }
      } catch (e) {
        console.warn('[ClassifyIngredient] JSON parse failed, using default');
      }
    }

    console.log(`[ClassifyIngredient] "${name}" -> category: ${category}, normalized: ${normalizedName}`);
    res.json({ 
      success: true, 
      category,
      normalized_name: normalizedName,
      original_input: name.trim()
    });

  } catch (error) {
    console.error('[ClassifyIngredient] Error:', error.message);
    // 错误时返回原始名称
    res.json({ 
      success: true, 
      category: '其他',
      normalized_name: name.trim(),
      original_input: name.trim()
    });
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
      console.log(`[DrinkDimensions] Requesting analysis for "${name}" using ${MODEL_8B}...`);
      response = await currentFetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL_8B,
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
// 端点：全链路聚合分析 (Comprehensive Analyze) - 性能优化核心
// ═══════════════════════════════════════════
/**
 * POST /api/comprehensive_analyze
 * 一次性完成：语义提取 + 辨证分析 + 向量翻译
 * 预期节省耗时: 30s-40s
 */
app.post('/api/comprehensive_analyze', async (req, res) => {
  const { user_input, current_time } = req.body;
  if (!user_input) return res.status(400).json({ success: false, error: '缺少 user_input' });

  const timeInfo = current_time || new Date().toISOString();
  const systemPrompt = buildComprehensiveSystemPrompt();
  const userMessage = `用户心境: "${user_input}"\n当前环境时间: ${timeInfo}`;

  try {
    // 🚀 性能优化：使用 7B 模型 + 低温度，配合后端验证兜底，实现快速响应
    const model = MODEL_CORE;
    console.log(`[ComprehensiveAnalyze] >>> 开始全链路聚合推理 (MODEL: ${model})...`);
    console.log(`[ComprehensiveAnalyze] 用户输入: "${user_input}"`);
    const startTime = Date.now();

    // 7B 模型响应更快，超时设为 25s
    const data = await callLLM(systemPrompt, userMessage, {
      model: model,
      temperature: 0.3,  // 低温度 = 更快、更稳定的 JSON 输出
      jsonMode: true,
      timeout: 45000,
      maxRetries: 1      // 减少重试次数，配合验证兜底
    });

    const duration = Date.now() - startTime;
    console.log(`[ComprehensiveAnalyze] <<< 聚合推理完成, 耗时: ${duration}ms`);

    // 验证并补全响应数据
    const validatedData = validateAndCompleteComprehensiveData(data, user_input);

    res.json({ success: true, data: validatedData });
  } catch (error) {
    console.error('[ComprehensiveAnalyze Error] 聚合流程中断:', error.message);
    if (error.cause) console.error('  Cause:', error.cause);
    if (error.stack) console.error('  Stack:', error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      type: error.name === 'AbortError' ? 'timeout' : 'error'
    });
  }
});

/**
 * 验证并补全聚合分析响应数据
 * 确保 moodData, patternAnalysis, vectorResult 三大模块完整
 */
function validateAndCompleteComprehensiveData(data, userInput) {
  const result = { ...data };

  // 检测情绪倾向 (简单规则)
  const positiveKeywords = ['开心', '高兴', '快乐', '幸福', '兴奋', '愉快', '喜悦', '舒畅', '满足', '美好', '棒', '好'];
  const negativeKeywords = ['难过', '伤心', '沮丧', '焦虑', '烦躁', '疲惫', '累', '压力', '郁闷', '生气', '愤怒', '失落'];
  const isPositive = positiveKeywords.some(k => userInput.includes(k));
  const isNegative = negativeKeywords.some(k => userInput.includes(k));

  // 1. 确保 moodData 存在且完整
  if (!result.moodData || typeof result.moodData !== 'object') {
    console.warn('[ComprehensiveAnalyze] moodData 缺失，使用降级默认值');
    result.moodData = buildDefaultMoodData(isPositive, isNegative, userInput);
  } else {
    // 确保关键字段存在
    result.moodData = {
      ...buildDefaultMoodData(isPositive, isNegative, userInput),
      ...result.moodData
    };
  }

  // 2. 确保 patternAnalysis 存在且完整
  if (!result.patternAnalysis || typeof result.patternAnalysis !== 'object') {
    console.warn('[ComprehensiveAnalyze] patternAnalysis 缺失，使用降级默认值');
    result.patternAnalysis = buildDefaultPatternAnalysis(isPositive, isNegative);
  } else {
    result.patternAnalysis = {
      ...buildDefaultPatternAnalysis(isPositive, isNegative),
      ...result.patternAnalysis
    };
  }

  // 3. 确保 vectorResult 存在且完整
  if (!result.vectorResult || typeof result.vectorResult !== 'object') {
    console.warn('[ComprehensiveAnalyze] vectorResult 缺失，使用降级默认值');
    result.vectorResult = buildDefaultVectorResult(isPositive);
  } else {
    // 确保 targetVector 是有效数组
    if (!Array.isArray(result.vectorResult.targetVector) || result.vectorResult.targetVector.length !== 8) {
      result.vectorResult.targetVector = buildDefaultVectorResult(isPositive).targetVector;
    }
    // 确保 weights 是有效数组且和为1
    if (!Array.isArray(result.vectorResult.weights) || result.vectorResult.weights.length !== 8) {
      result.vectorResult.weights = [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125];
    }
    if (!result.vectorResult.priorities) {
      result.vectorResult.priorities = ['emotion', 'temperature', 'aroma'];
    }
  }

  console.log('[ComprehensiveAnalyze] 数据验证完成，所有模块已就绪');
  return result;
}

function buildDefaultMoodData(isPositive, isNegative, userInput) {
  const hour = new Date().getHours();
  return {
    emotion: {
      physical: { state: isPositive ? '愉悦' : (isNegative ? '低落' : '平静'), intensity: 0.6 },
      philosophy: { wuxing: isPositive ? 'fire' : (isNegative ? 'water' : 'earth') },
      drinkMapping: { tasteScore: 5, colorCode: 3 }
    },
    somatic: {
      physical: { sensation: '正常', intensity: 0.5 },
      philosophy: { direction: isPositive ? '上升' : '平稳', yinyang: '中性' },
      drinkMapping: { temperature: 0, textureScore: 0 }
    },
    time: { drinkMapping: { temporality: hour } },
    cognitive: { drinkMapping: { aromaScore: 5 } },
    demand: {
      philosophy: { type: isPositive ? '动' : '止' },
      drinkMapping: { actionScore: isPositive ? 4 : 2 }
    },
    socialContext: { drinkMapping: { ratioScore: 15 } },
    isNegative: isNegative && !isPositive,
    summary: userInput || '心情平和'
  };
}

function buildDefaultPatternAnalysis(isPositive, isNegative) {
  return {
    polarity: {
      type: isPositive ? 'positive' : (isNegative ? 'negative' : 'mixed'),
      confidence: 0.7
    },
    wuxing: {
      user: isPositive ? 'fire' : (isNegative ? 'water' : 'earth'),
      scores: { wood: 0.15, fire: isPositive ? 0.4 : 0.15, earth: 0.2, metal: 0.1, water: isNegative ? 0.4 : 0.15 },
      confidence: 0.7
    },
    strategy: {
      type: isPositive ? 'resonate' : (isNegative ? 'counter' : 'harmonize'),
      logic: isPositive ? '顺势而为，助其欢畅' : (isNegative ? '以柔克刚，温和化解' : '平衡调和，顺其自然')
    },
    diagnosis: {
      summary: isPositive ? '心情舒畅，宜顺势助兴' : (isNegative ? '情绪低落，需温润调理' : '状态平稳，可随心而饮'),
      recommendation: isPositive ? '清爽上扬的饮品' : (isNegative ? '温润安神的饮品' : '平衡和谐的饮品')
    }
  };
}

function buildDefaultVectorResult(isPositive) {
  const hour = new Date().getHours();
  return {
    targetVector: [
      5,                              // taste: 中等甜度
      isPositive ? 1 : -1,            // texture: 正面上扬，负面下沉
      isPositive ? -1 : 1,            // temperature: 正面清爽，负面温热
      3,                              // color: 中性
      hour,                           // temporality: 当前时间
      5,                              // aroma: 中等香气
      15,                             // ratio: 低酒精度
      isPositive ? 3 : 2              // action: 正面社交，负面独处
    ],
    weights: [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125],
    priorities: ['emotion', 'temperature', 'aroma'],
    mappingExplanation: {
      wuxing: isPositive ? '火' : '水',
      strategy: isPositive ? '顺势共鸣' : '温和调理',
      keyDimensions: ['texture', 'temperature', 'aroma']
    }
  };
}



// ═══════════════════════════════════════════
// 通用 LLM 调用辅助函数
// ═══════════════════════════════════════════
async function callLLM(systemPrompt, userContent, options = {}) {
  const {
    temperature = 0.5,
    jsonMode = true,
    model = MODEL_8B,
    timeout = 45000,
    maxRetries = 2
  } = options;

  const apiKey = process.env.SILICONFLOW_API_KEY;
  const currentFetch = await getFetch();
  if (!currentFetch) throw new Error('Fetch implementation not found');

  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      if (i > 0) console.log(`[callLLM] 第 ${i} 次重试 (Model: ${model})...`);

      const response = await currentFetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'MoodMix/1.0 (Node.js)'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature,
          response_format: jsonMode ? { type: 'json_object' } : undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error text');
        throw new Error(`API 返回错误 (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      let content = (result.choices?.[0]?.message?.content || '').trim();

      if (jsonMode) {
        try {
          // AI 可能会返回带有 markdown 代码块的 JSON
          if (content.includes('```')) {
            const match = content.match(/```(?:json)?([\s\S]*?)```/);
            if (match) content = match[1].trim();
          }

          const jsonMatch = content.match(/\{[\s\S]*\}/);
          return JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (e) {
          console.error('[callLLM] JSON Parse Error. Content:', content);
          throw new Error('大模型 JSON 格式化失败，请重试');
        }
      }
      return content;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`[callLLM] 响应超时 (试图第 ${i + 1}/${maxRetries + 1} 次)`);
      } else {
        console.warn(`[callLLM] 请求失败: ${err.message} (试图第 ${i + 1}/${maxRetries + 1} 次)`);
      }

      // 如果是最后一次尝试，或者不是网络/超时错误，则不再重试
      if (i === maxRetries) break;

      // 等待 1s 后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('Unknown LLM error');
}

// ═══════════════════════════════════════════
// 端点：深度辨证分析 (Pattern Analyze)
// ═══════════════════════════════════════════
app.post('/api/pattern_analyze', async (req, res) => {
  const { moodData } = req.body;
  if (!moodData) return res.status(400).json({ success: false, error: '缺少 moodData' });

  const systemPrompt = `你是一位深谙中医辨证与五行哲学的心理分析专家。
请根据用户的六维心情数据，推断其五行极性、调理策略及诊断结论。
严格返回 JSON 格式。

## 输出格式
{
  "polarity": { "type": "negative/positive/mixed", "confidence": number },
  "wuxing": { "user": "wood/fire/earth/metal/water", "scores": { "wood": n, "fire": n, ... }, "confidence": n },
  "strategy": { "type": "counter/harmonize/resonate/correct/balance", "logic": "详细的哲学解释" },
  "diagnosis": { "summary": "简短结论", "emotionState": "情绪描述", "somaticState": "躯体描述", "recommendation": "调理建议" }
}`;

  try {
    const data = await callLLM(systemPrompt, JSON.stringify(moodData), { model: MODEL_CORE });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// 端点：向量翻译 (Vector Translate)
// ═══════════════════════════════════════════
app.post('/api/vector_translate', async (req, res) => {
  const { moodData, patternAnalysis } = req.body;
  if (!moodData || !patternAnalysis) return res.status(400).json({ success: false, error: '参数缺失' });

  const systemPrompt = `你是一位精通跨模态映射的数学与风味专家。
将中医辨证结论翻译为 8 维饮品搜索向量。

## 8维维度说明
[taste(0-10), texture(-3~3), temperature(-5~5), color(1-5), temporality(0-23), aroma(0-10), ratio(0-95), action(1-5)]

## 输出格式
{
  "targetVector": [number, number, ...], // 8个数值，分别对应上述维度
  "weights": [number, number, ...],      // 8个正数权重，且【之和必须严格等于 1.0】
  "priorities": ["dimension_name", ...], 
  "mappingExplanation": { "wuxing": "string", "strategy": "string", "keyDimensions": ["string", ...] }
}`;

  try {
    const data = await callLLM(systemPrompt, JSON.stringify({ moodData, patternAnalysis }), { model: MODEL_CORE });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// 端点：校验与全程优化 (Validate & Optimize)
// ═══════════════════════════════════════════
app.post('/api/validate_optimize', async (req, res) => {
  const { fullContext } = req.body;
  if (!fullContext) return res.status(400).json({ success: false, error: '缺少 context' });

  const systemPrompt = `你是一位严谨的系统验证专家。
请审查当前的推荐流输出，检测潜在冲突、安全性问题，并给出质量评分。
你必须【严格且唯一】地返回一个合法的 JSON 对象，严禁包含任何 Markdown 格式标识、解释性文字或开场白。

## 输出格式
{
  "score": number, // 0-100
  "qualityLevel": "excellent/good/acceptable/poor",
  "shouldRetry": boolean,
  "shouldBlock": boolean,
  "userMessage": "string or null",
  "issues": [ { "type": "error/warning/info", "message": "string", "severity": "high/medium/low" } ],
  "uiHints": { 
    "showBadge": boolean, 
    "badgeText": "string", // 必须【仅返回四个汉字】，严禁包含「」、引号、英文或任何标点。选项：心味相合, 恰有灵犀, 随缘入味, 缘来一试
    "bottomHintText": "string" 
  }
} `;

  try {
    const data = await callLLM(systemPrompt, JSON.stringify(fullContext), {
      model: MODEL_8B,
      timeout: 50000,   // 验证逻辑较重，给予 50s
      maxRetries: 2    // 支持 2 次重试
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('[ValidateOptimize Error] 质检流程中断:', error.message);
    if (error.cause) console.error('  Cause:', error.cause);
    res.status(500).json({
      success: false,
      error: error.message,
      type: error.name === 'AbortError' ? 'timeout' : 'error'
    });
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

/**
 * 核心优化：聚合提示词构造器 - 一次性完成 语义+辨证+向量
 */
function buildComprehensiveSystemPrompt() {
  return `你是一位集“语义蒸馏”、“中医辨证”与“调酒风味专家”映射于一身的智能中枢。
你的任务是将用户的一句心情描述，一次性转化为完整的推荐逻辑链。

### 阶段一：语体语义提取
1. **emotion** - 情绪 → 五行映射(木怒/火喜/土思/金悲/水恐)
2. **somatic** - 躯体感受 → 气机方向(升降浮沉) + 阴阳
3. **time** - 映射到 drinkMapping.temporality
4. **cognitive** - 映射到 drinkMapping.aromaScore
5. **demand** - 诉求(止/动/破)
6. **socialContext** - 独处/群居

### 阶段二：深度辨证分析
1. 判断 **polarity** (negative/positive/mixed)。
2. 确定 **wuxing** 主属性及置信度。
3. 制定 **strategy** (counter/harmonize/resonate/correct/balance) 及哲学逻辑。
4. 给出 **diagnosis** 诊断报告。

### 阶段三：八维风味向量翻译
基于上述分析，翻译为 8 维饮品搜索向量 [0-7]：
[taste(0-10), texture(-3~3), temperature(-5~5), color(1-5), temporality(0-23), aroma(0-10), ratio(0-95), action(1-5)]
计算 **weights** (8个正数之和严格为1.0) 及 **priorities**。

### 约束要求
- 必须严格返回合法的 JSON 对象。
- 不要解释，不要开场白。

### 输出 JSON 结构
{
  "moodData": {
    "emotion": { "physical": { "state": "string", "intensity": 0.0-1.0 }, "philosophy": { "wuxing": "string" }, "drinkMapping": { "tasteScore": 0-10, "colorCode": 1-5 } },
    "somatic": { "physical": { "sensation": "string", "intensity": 0.0-1.0 }, "philosophy": { "direction": "string", "yinyang": "string" }, "drinkMapping": { "temperature": -5~5, "textureScore": -3~3 } },
    "time": { "drinkMapping": { "temporality": 0-23 } },
    "cognitive": { "drinkMapping": { "aromaScore": 0-10 } },
    "demand": { "philosophy": { "type": "止/动/破" }, "drinkMapping": { "actionScore": 1-5 } },
    "socialContext": { "drinkMapping": { "ratioScore": 0-95 } },
    "isNegative": boolean,
    "summary": "一句话总结"
  },
  "patternAnalysis": {
    "polarity": { "type": "negative/positive/mixed", "confidence": number },
    "wuxing": { "user": "wood/fire/earth/metal/water", "scores": { "wood": number, ... }, "confidence": number },
    "strategy": { "type": "string", "logic": "string" },
    "diagnosis": { "summary": "string", "recommendation": "string" }
  },
  "vectorResult": {
    "targetVector": [number, ...], // 8D
    "weights": [number, ...],      // 8D, sum=1.0
    "priorities": ["dimension_name", ...],
    "mappingExplanation": { "wuxing": "string", "strategy": "string", "keyDimensions": ["string", ...] }
  }
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
        model: MODEL_8B,
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

// ═══════════════════════════════════════════
// 端点：社交卡片文案生成
// ═══════════════════════════════════════════
app.post('/api/social-card-copy', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({ success: false, error: 'API Key 未配置' });
  }

  const { drink, prompt: userPrompt } = req.body;
  if (!drink || !userPrompt) {
    return res.status(400).json({ success: false, error: '缺少参数' });
  }

  try {
    const fetch = (await import('node-fetch')).default;

    const systemPrompt = `你是一位深谙东方审美与现代情緒表达的文案大师。
你的任务是为饮品分享卡片生成一段极具【诗意】与【克制感】的文案。

【核心要求】：
1. 风格：东方韵味、极简、有温度、像耳边的低语。
2. 长度：2-3句话，30-50字。
3. 严禁：鸡汤、口号、感叹号、四字词语堆砌。
4. 内容：结合饮品的感官细节（色、味、温）和用户的情绪心径。`;

    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL_CREATIVE,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const data = await response.json();
    const copy = data.choices?.[0]?.message?.content?.trim() || '岁序更迭，此情可待';

    res.json({ success: true, copy });
  } catch (error) {
    console.error('[Social Card Copy] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// 端点：语音转文字 (Speech-to-Text)
// 使用 Qwen-2.5-7B-Instruct 模型
// ═══════════════════════════════════════════
/**
 * POST /api/speech-to-text
 * Body: { audio: string (base64 encoded audio) }
 * Response: { success: boolean, text?: string, error?: string }
 */
app.post('/api/speech-to-text', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({
      success: false,
      error: 'SILICONFLOW_API_KEY 未配置'
    });
  }

  const { audio } = req.body;

  if (!audio || typeof audio !== 'string') {
    return res.status(400).json({
      success: false,
      error: '缺少 audio 参数（需要 base64 编码的音频数据）'
    });
  }

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) throw new Error('Fetch implementation not found');

    const systemPrompt = `你是一个专业的语音识别助手。你的任务是将用户提供的音频数据转录为文字。

要求：
1. 准确识别音频中的中文语音内容
2. 只返回识别到的文字内容，不要添加任何解释、标点或格式
3. 如果无法识别或音频不清晰，返回空字符串
4. 去除语气词和重复词，保持语句通顺`;

    const userMessage = `请将以下 base64 编码的音频数据转录为文字：\n\n${audio.substring(0, 1000)}...`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
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
          model: MODEL_8B,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.3,
          max_tokens: 500
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Speech-to-Text] API error [${response.status}]:`, errorText);
      return res.status(response.status).json({
        success: false,
        error: `API 返回错误: ${response.status}`
      });
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content?.trim() || '';

    console.log(`[Speech-to-Text] 识别完成，结果: "${text.substring(0, 50)}..."`);

    res.json({ success: true, text });

  } catch (error) {
    console.error('[Speech-to-Text] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════
// 饮品心意统计 API
// ═══════════════════════════════════════════

// 内存存储：饮品心意统计 { drinkId: { userUIDs: Set, count: number } }
const drinkLikeStats = new Map();

// 全局用户UID集合（用于统计真实用户总数）
const globalUserUIDs = new Set();

// 初始化饮品心意统计
function initDrinkLikeStats(drinkId) {
  if (!drinkLikeStats.has(drinkId)) {
    drinkLikeStats.set(drinkId, {
      userUIDs: new Set(),
      count: 0
    });
  }
}

/**
 * POST /api/drink/like
 * 记录用户对饮品的心意
 * Body: { drinkId: string, userUID: string }
 * Response: { success: boolean, count: number, showMessage: boolean }
 */
app.post('/api/drink/like', (req, res) => {
  const { drinkId, userUID } = req.body;

  if (!drinkId || !userUID) {
    return res.status(400).json({
      success: false,
      error: '缺少 drinkId 或 userUID'
    });
  }

  initDrinkLikeStats(drinkId);
  const stats = drinkLikeStats.get(drinkId);

  const isNewLike = !stats.userUIDs.has(userUID);
  
  if (isNewLike) {
    stats.userUIDs.add(userUID);
    stats.count++;
    globalUserUIDs.add(userUID);
  }

  console.log(`[DrinkLike] 饮品 ${drinkId} 被 ${userUID} 标记为心仪，当前统计: ${stats.count} 人，全局用户总数: ${globalUserUIDs.size}`);

  if (global.io) {
    global.io.to(`drink-${drinkId}`).emit('drink-liked', {
      drinkId,
      count: stats.count,
      isNewLike
    });
    console.log(`[WebSocket] 已广播饮品 ${drinkId} 的喜欢更新到房间 drink-${drinkId}`);
  }

  res.json({
    success: true,
    count: stats.count,
    showMessage: stats.count >= 2
  });
});

/**
 * POST /api/drink/unlike
 * 取消用户对饮品的心意
 * Body: { drinkId: string, userUID: string }
 * Response: { success: boolean, count: number, showMessage: boolean }
 */
app.post('/api/drink/unlike', (req, res) => {
  const { drinkId, userUID } = req.body;

  if (!drinkId || !userUID) {
    return res.status(400).json({
      success: false,
      error: '缺少 drinkId 或 userUID'
    });
  }

  initDrinkLikeStats(drinkId);
  const stats = drinkLikeStats.get(drinkId);

  // 如果用户之前标记过这个饮品，则减少计数
  if (stats.userUIDs.has(userUID)) {
    stats.userUIDs.delete(userUID);
    stats.count = Math.max(0, stats.count - 1);
  }

  console.log(`[DrinkLike] 饮品 ${drinkId} 被 ${userUID} 取消心仪，当前统计: ${stats.count} 人`);

  res.json({
    success: true,
    count: stats.count,
    showMessage: stats.count >= 2
  });
});

/**
 * GET /api/drink/like-stats/:drinkId
 * 获取饮品的心意统计
 * Response: { success: boolean, count: number, showMessage: boolean }
 */
app.get('/api/drink/like-stats/:drinkId', (req, res) => {
  const { drinkId } = req.params;

  if (!drinkId) {
    return res.status(400).json({
      success: false,
      error: '缺少 drinkId'
    });
  }

  initDrinkLikeStats(drinkId);
  const stats = drinkLikeStats.get(drinkId);

  res.json({
    success: true,
    count: stats.count,
    showMessage: stats.count >= 2
  });
});

/**
 * GET /api/stats/total-users
 * 获取真实UID用户总数
 * Response: { success: boolean, totalUsers: number }
 */
app.get('/api/stats/total-users', (req, res) => {
  res.json({
    success: true,
    totalUsers: globalUserUIDs.size
  });
});

// ─── 创建 HTTP 服务器和 WebSocket 服务器 ───
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// WebSocket 连接管理
io.on('connection', (socket) => {
  console.log(`[WebSocket] 新客户端连接: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[WebSocket] 客户端断开连接: ${socket.id}`);
  });

  socket.on('join-drink-room', (drinkId) => {
    socket.join(`drink-${drinkId}`);
    console.log(`[WebSocket] 客户端 ${socket.id} 加入饮品房间: ${drinkId}`);
  });

  socket.on('leave-drink-room', (drinkId) => {
    socket.leave(`drink-${drinkId}`);
    console.log(`[WebSocket] 客户端 ${socket.id} 离开饮品房间: ${drinkId}`);
  });
});

// 导出 io 实例供其他模块使用
global.io = io;

// ─── 启动服务器 ───
httpServer.listen(PORT, '0.0.0.0', () => {
  const hasKey = process.env.SILICONFLOW_API_KEY && process.env.SILICONFLOW_API_KEY !== 'your_key_here';
  console.log(`\n🍹 MoodMix SiliconFlow 代理服务已启动`);
  console.log(`   端口: ${PORT}`);
  console.log(`   模型: ${MODEL_8B}`);
  console.log(`   API Key: ${hasKey ? '✅ 已配置' : '❌ 未配置 — 请在 .env 中设置 SILICONFLOW_API_KEY'}`);
  console.log(`   网络: 已绑定到 0.0.0.0，允许局域网访问`);
  console.log(`   WebSocket: ✅ 已启用，支持实时同步`);
  console.log(`   端点:`);
  console.log(`     - POST http://localhost:${PORT}/api/analyze_mood`);
  console.log(`     - POST http://localhost:${PORT}/api/speech-to-text\n`);
});

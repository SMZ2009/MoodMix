/**
 * 生产服务器
 * 
 * 职责：
 * 1. 提供优化的 React 前端构建文件（从 ./build）
 * 2. 为前端路由应用 SPA 重定向
 * 3. 代理 /api/* 请求给 LLM 代理服务
 * 
 * 启动: npm run serve-prod
 * 端口: 3000 (可通过 PORT 环境变量配置)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { existsSync } = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理（用于 Render.com 等云平台）
app.set('trust proxy', 1);

// 中间件
app.use(cors({
  origin: true,
  credentials: false
}));
app.use(express.json());

// 处理 Host header（允许所有 Host）
app.use((req, res, next) => {
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

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ═══════════════════════════════════════════
// LLM 代理路由
// ═══════════════════════════════════════════

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

/**
 * POST /api/analyze_mood
 * 分析用户输入的心情，生成个性化饮品推荐维度
 */
app.post('/api/analyze_mood', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  console.log('[API] /api/analyze_mood - API Key 状态:', apiKey ? '已配置' : '未配置');

  if (!apiKey || apiKey === 'your_key_here') {
    console.error('[API] /api/analyze_mood - API Key 未配置!');
    return res.status(500).json({
      success: false,
      error: 'API Key not configured. Please set SILICONFLOW_API_KEY in environment.'
    });
  }

  const { user_input, current_time } = req.body;

  console.log('[API] /api/analyze_mood called, user_input:', user_input);

  if (!user_input) {
    return res.status(400).json({
      success: false,
      error: 'user_input is required'
    });
  }

  try {
    // 构建 system prompt
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(user_input, current_time);

    console.log('[API] Calling SiliconFlow API, model:', SILICONFLOW_MODEL);

    // 调用 SiliconFlow API
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SiliconFlow API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: `SiliconFlow API returned ${response.status}`
      });
    }

    const result = await response.json();
    const aiMessage = result.choices?.[0]?.message?.content || '';

    // 解析 AI 响应
    const analysis = parseAIResponse(aiMessage);

    return res.json({
      success: true,
      data: analysis,
      raw_response: aiMessage
    });
  } catch (error) {
    console.error('Error in /api/analyze_mood:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

app.post('/api/generate_quotes', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({
      success: false,
      error: 'API Key not configured'
    });
  }

  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'items must be a non-empty array'
    });
  }

  try {
    console.log('[API] /api/generate_quotes called for', items.length, 'items');

    const quotes = {};
    const BATCH_SIZE = 3;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      // 构建更清晰的上下文
      const contextDescriptions = batch.map((item, index) => {
        const ctx = item.contextPackage || {};
        const userState = ctx.userState || item.diagnosis || '气机失调';
        const drinkProfile = ctx.drinkProfile || item.name;
        const sensory = ctx.sensory || '口感平衡';

        return `${index + 1}. 饮品：${item.name}
用户状态：${userState}
风味特征：${drinkProfile}
体感体验：${sensory}`;
      }).join('\n\n');

      // Prompt优化
      const systemPrompt = `
你是一位东方情绪酒馆的调酒师。

任务：
为每杯饮品写一句具有画面感的推荐语。

要求：
1. 每句20-30字
2. 每句必须明显不同
3. 不要重复句式
4. 不要使用相同开头
5. 使用不同的表达方式（情绪 / 画面 / 味道 / 气味）
6. 每句必须使用「」包裹

示例风格（仅参考氛围，不要模仿句式）：
「柑橘的锋利在杯口亮了一下，把胸口的闷气慢慢带走。」
「气泡在杯中升起，这杯Mule适合让思绪落地。」
「橙子的甜味有点温柔，让夜晚慢慢松一口气。」
`;

      const userMessage = `
请为以下饮品分别写一句推荐语：

${contextDescriptions}

按编号输出：

1.
2.
3.
`;

      const response = await fetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: SILICONFLOW_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.9,
          max_tokens: 600
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('SiliconFlow API error:', response.status, errorData);
        continue;
      }

      const result = await response.json();
      const aiMessage = result.choices?.[0]?.message?.content || '';

      console.log('========== LLM返回 ==========');
      console.log(aiMessage);
      console.log('=============================');

      // 稳定解析「xxx」
      const matches = aiMessage.match(/「[^」]+」/g) || [];

      batch.forEach((item, index) => {
        if (matches[index]) {
          quotes[item.id] = matches[index];
        } else {
          quotes[item.id] = `「这杯${item.name}，今晚或许正适合你。」`;
        }
      });
    }

    return res.json({
      success: true,
      quotes
    });

  } catch (error) {
    console.error('Error in /api/generate_quotes:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
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

    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey || apiKey === 'your_key_here') {
      res.write(`data: ${JSON.stringify({ error: 'API Key 未配置', done: true })}\n\n`);
      res.end();
      return;
    }

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
          return false; // 流结束
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulated += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        } catch (e) {
          // 忽略解析失败的片段
        }
      }
      return true;
    };

    // 读取流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunkText = decoder.decode(value, { stream: true });
      const shouldContinue = processChunk(chunkText);
      if (!shouldContinue) break;
    }

    // 处理最后剩余的 buffer
    if (lineBuffer.trim()) {
      processChunk('\n');
    }

    // 解析最终结果
    let parsed;
    try {
      const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有完整的 JSON，返回默认分析
        parsed = parseAIResponse(accumulated);
      }
    } catch (e) {
      console.error('[Stream] 解析最终结果失败:', e);
      parsed = parseAIResponse(accumulated);
    }

    console.log(`[Stream] 分析完成: "${user_input.slice(0, 30)}..."`);

    // 发送最终结果
    res.write(`data: ${JSON.stringify({ data: parsed, done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[Stream] 流式处理错误:', error);
    res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════════════════
// 端点：全链路聚合分析 (Comprehensive Analysis)
// ═══════════════════════════════════════════
app.post('/api/comprehensive_analyze', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({
      success: false,
      error: 'API Key not configured'
    });
  }

  const { user_input, current_time } = req.body;

  if (!user_input || typeof user_input !== 'string' || !user_input.trim()) {
    return res.status(400).json({
      success: false,
      error: 'user_input is required'
    });
  }

  try {
    console.log('[API] /api/comprehensive_analyze called');

    const timeInfo = current_time || new Date().toISOString();

    // 构建聚合分析的系统提示词
    const systemPrompt = `你是一个专业的东方养生顾问和混调师。你需要分析用户的当前心理和肉体状态，
并用一个结构化的中文 JSON 格式来返回分析结果，用于推荐适合的饮品。

你的分析应该涵盖以下维度：
1. 情绪（emotion）- 用户的心理状态和五行属性
2. 体感（somatic）- 用户的身体感受
3. 时间（time）- 当前的时间相关信息
4. 认知（cognitive）- 用户的思维状态
5. 诉求（demand）- 用户的需求和期望
6. 社交/环境（socialContext）- 社交和环境因素

同时提供：
- 中医辨证结论（patternAnalysis）
- 八维特征向量（vectorResult）

返回格式必须是有效的 JSON，包含 moodData、patternAnalysis 和 vectorResult 三个主要部分。`;

    const userMessage = `请全面分析我当前的状态（${timeInfo}）：

${user_input.trim()}

请返回包含以下内容的 JSON：
1. moodData: 六维心境数据（情绪、体感、时间、认知、诉求、社交）
2. patternAnalysis: 中医辨证结论
3. vectorResult: 八维特征向量`;

    // 调用 SiliconFlow API
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SiliconFlow API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: `SiliconFlow API returned ${response.status}`
      });
    }

    const result = await response.json();
    const aiMessage = result.choices?.[0]?.message?.content || '';

    // 解析 AI 响应，提取三个部分
    let moodData, patternAnalysis, vectorResult;
    
    try {
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        moodData = parsed.moodData || parsed;
        patternAnalysis = parsed.patternAnalysis || generateDefaultPatternAnalysis(moodData);
        vectorResult = parsed.vectorResult || generateDefaultVectorResult(moodData);
      } else {
        throw new Error('无法解析 AI 响应');
      }
    } catch (e) {
      console.error('解析 AI 响应失败:', e);
      // 使用默认数据
      moodData = parseAIResponse(aiMessage);
      patternAnalysis = generateDefaultPatternAnalysis(moodData);
      vectorResult = generateDefaultVectorResult(moodData);
    }

    console.log('[API] 全链路聚合分析完成');

    return res.json({
      success: true,
      data: {
        moodData,
        patternAnalysis,
        vectorResult
      }
    });

  } catch (error) {
    console.error('Error in /api/comprehensive_analyze:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ═══════════════════════════════════════════
// 端点：生成饮品维度向量
// ═══════════════════════════════════════════
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

    console.log(`[DrinkDimensions] Requesting analysis for "${name}"...`);
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
          { role: 'user', content: userContent }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DrinkDimensions] API error:', errorText);
      return res.status(response.status).json({ success: false, error: errorText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 解析 JSON
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return res.json({ success: true, ...result });
      }
    } catch (e) {
      console.error('[DrinkDimensions] Failed to parse JSON:', e);
    }

    // 返回默认结果
    return res.json({
      success: true,
      vector: [5, 0, 0, 3, 12, 5, 0, 2],
      dimensions: {
        sweetness: { value: 5, label: "适中" },
        sourness: { value: 3, label: "轻微" },
        bitterness: { value: 1, label: "极低" },
        temperature: { value: 0, label: "常温" },
        aroma: { value: 5, label: "清香" },
        texture: { value: 0, label: "平衡" },
        strength: { value: 0, label: "无酒精" }
      },
      reasoning: "已应用经典平衡配比"
    });

  } catch (error) {
    console.error('[DrinkDimensions] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// 端点：饮品制作助手
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

// ═══════════════════════════════════════════
// 端点：验证优化
// ═══════════════════════════════════════════
app.post('/api/validate_optimize', async (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(500).json({
      success: false,
      error: 'SILICONFLOW_API_KEY 未配置'
    });
  }

  const { fullContext } = req.body;

  if (!fullContext) {
    return res.status(400).json({
      success: false,
      error: '缺少 fullContext 参数'
    });
  }

  try {
    console.log('[API] /api/validate_optimize called');

    const systemPrompt = `你是一位专业的东方养生顾问和饮品验证专家。

任务：
对全流程分析结果进行验证和优化，确保推荐的饮品与用户状态高度匹配。

要求：
1. 分析用户的情绪、体感、时间等维度
2. 检查推荐饮品与用户状态的匹配度
3. 检测潜在的冲突（五行生克、时段温度、情绪酒精等）
4. 计算综合质量评分
5. 提供优化建议
6. 返回结构化的验证报告

输出格式：
必须返回有效的 JSON，包含以下字段：
- valid: boolean - 是否通过验证
- score: number - 质量评分 (0-100)
- qualityLevel: string - 质量等级 (excellent/good/acceptable/poor)
- issues: array - 发现的问题
- optimizations: array - 优化建议
- recommendations: array - 改进建议
- timestamp: string - 时间戳`;

    const userMessage = `请验证并优化以下分析结果：

${JSON.stringify(fullContext, null, 2)}

请返回详细的验证报告和优化建议。`;

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
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SiliconFlow API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: `SiliconFlow API returned ${response.status}`
      });
    }

    const result = await response.json();
    const aiMessage = result.choices?.[0]?.message?.content || '';

    // 解析 AI 响应
    let validationReport;
    try {
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validationReport = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有完整的 JSON，返回默认报告
        validationReport = {
          valid: true,
          score: 75,
          qualityLevel: 'good',
          issues: [],
          optimizations: [],
          recommendations: ['验证完成'],
          timestamp: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error('解析 AI 响应失败:', e);
      // 使用默认报告
      validationReport = {
        valid: true,
        score: 70,
        qualityLevel: 'good',
        issues: [],
        optimizations: [],
        recommendations: ['验证完成'],
        timestamp: new Date().toISOString()
      };
    }

    return res.json({
      success: true,
      data: validationReport
    });

  } catch (error) {
    console.error('Error in /api/validate_optimize:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ═══════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════

function buildSystemPrompt() {
  return `你是一个专业的东方养生顾问和混调师。你需要分析用户的当前心理和肉体状态，
并用一个结构化的中文 JSON 格式来返回分析结果，用于推荐适合的饮品。

你的分析应该涵盖以下8个维度：
1. 情绪（emotion）- 用户的心理状态和五行属性
2. 体感（somatic）- 用户的身体感受
3. 时间（time）- 当前的时间相关信息
4. 季节（season）- 季节相关的调理建议
5. 颜色偏好（color）- 推荐的饮品颜色
6. 味觉需求（taste）- 推荐的主要味道
7. 温度（temperature）- 推荐的饮品温度
8. 强度（intensity）- 饮品的强度和浓度

返回格式必须是有效的 JSON，包含以上所有维度的数据。`;
}

function buildUserMessage(input, currentTime) {
  const timeStr = currentTime || new Date().toLocaleString('zh-CN');
  return `请分析我当前的状态（${timeStr}）并推荐合适的饮品维度：\n\n${input}`;
}

function parseAIResponse(aiMessage) {
  try {
    // 尝试从响应中提取 JSON
    const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse AI response as JSON:', e);
  }

  // 返回默认分析结构
  return {
    emotion: { physical: { state: '平静' }, philosophy: { wuxing: '土' } },
    somatic: { physical: { sensation: '正常' }, philosophy: { qiState: '通畅' } },
    time: { hour: new Date().getHours(), period: '中午' },
    season: { current: '春夏秋冬'[Math.floor(new Date().getMonth() / 3)] },
    color: { primary: '黄/琥珀' },
    taste: { dominant: '甘' },
    temperature: { value: 20 },
    intensity: { level: 'medium' },
    raw_ai_response: aiMessage
  };
}

// 生成默认的中医辨证分析
function generateDefaultPatternAnalysis(moodData) {
  const wuxing = moodData?.emotion?.philosophy?.wuxing || '土';
  const emotion = moodData?.emotion?.physical?.state || '平静';
  
  const wuxingPatterns = {
    '木': { pattern: '肝气郁结', element: '木', recommendation: '疏肝理气' },
    '火': { pattern: '心火偏旺', element: '火', recommendation: '清心降火' },
    '土': { pattern: '脾胃不和', element: '土', recommendation: '健脾和胃' },
    '金': { pattern: '肺气不足', element: '金', recommendation: '润肺益气' },
    '水': { pattern: '肾阴亏虚', element: '水', recommendation: '滋阴补肾' }
  };
  
  const pattern = wuxingPatterns[wuxing] || wuxingPatterns['土'];
  
  return {
    diagnosis: pattern.pattern,
    element: pattern.element,
    emotion: emotion,
    recommendation: pattern.recommendation,
    confidence: 0.75
  };
}

// 生成默认的八维特征向量
function generateDefaultVectorResult(moodData) {
  const wuxing = moodData?.emotion?.philosophy?.wuxing || '土';
  
  const wuxingVectors = {
    '木': [0.8, 0.3, 0.4, 0.2, 0.5, 0.3, 0.6, 0.4],
    '火': [0.3, 0.9, 0.5, 0.3, 0.6, 0.4, 0.5, 0.3],
    '土': [0.4, 0.3, 0.7, 0.5, 0.4, 0.6, 0.4, 0.5],
    '金': [0.2, 0.4, 0.3, 0.8, 0.3, 0.5, 0.7, 0.4],
    '水': [0.3, 0.2, 0.4, 0.3, 0.8, 0.4, 0.3, 0.7]
  };
  
  return {
    vector: wuxingVectors[wuxing] || wuxingVectors['土'],
    dimensions: ['情绪', '体感', '时间', '季节', '颜色', '味道', '温度', '强度'],
    normalized: true
  };
}

// ═══════════════════════════════════════════
// 前端静态文件服务
// ═══════════════════════════════════════════

// 提供静态文件
const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));

// SPA 重定向：所有非 API 请求都返回 index.html
app.get('*', (req, res) => {
  // 除了 .js, .css, .json, .png, .ico 等文件外，其他请求都返回 index.html
  if (req.url.match(/\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.status(404).send('Not found');
  } else {
    res.sendFile(path.join(buildPath, 'index.html'));
  }
});

// ═══════════════════════════════════════════
// 启动服务器
// ═══════════════════════════════════════════

// 确保 build 目录存在
if (!existsSync(buildPath)) {
  console.error(`❌ 错误: build 目录不存在，请先运行 npm run build`);
  process.exit(1);
}

app.listen(PORT, '0.0.0.0', () => {
  const hasKey = process.env.SILICONFLOW_API_KEY && process.env.SILICONFLOW_API_KEY !== 'your_key_here';
  console.log(`\n🍹 MoodMix 生产服务器已启动`);
  console.log(`   端口: ${PORT}`);
  console.log(`   前端: 从 ${buildPath} 提供`);
  console.log(`   API: /api/analyze_mood, /api/analyze_mood_stream, /api/generate_quotes, /api/comprehensive_analyze, /api/generate-drink-dimensions, /api/drink-assistant, /api/validate_optimize`);
  console.log(`   模型: ${SILICONFLOW_MODEL}`);
  console.log(`   API Key: ${hasKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   访问地址: http://0.0.0.0:${PORT}\n`);
});

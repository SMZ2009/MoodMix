/**
 * MoodMix LLM Proxy Server
 * 
 * 职责：
 * 1. 保护 API Key（从 .env 读取，不暴露到前端）
 * 2. 提供统一的 LLM API 代理服务
 * 3. 实现请求限流、错误处理、日志记录
 * 4. 支持多种 LLM 功能：情绪分析、文案生成、饮品助手等
 * 
 * 启动: node server/llmProxy.js
 * 默认端口: 3001
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// 加载 .env 文件
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});
const PORT = process.env.PORT || process.env.PROXY_PORT || 3001;
const AGENT_DEBUG_LOG = path.join(__dirname, '..', '.cursor', 'debug.log');

// ═══════════════════════════════════════════
// 配置常量
// ═══════════════════════════════════════════
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL_8B = process.env.SILICONFLOW_MODEL_8B || 'Qwen/Qwen2.5-7B-Instruct';
const MODEL_30B = process.env.SILICONFLOW_MODEL_30B || 'Qwen/Qwen2.5-32B-Instruct';
const MODEL_CORE = process.env.SILICONFLOW_MODEL_CORE || MODEL_8B;
const MODEL_CREATIVE = process.env.SILICONFLOW_MODEL_CREATIVE || MODEL_30B;
const COCKTAILDB_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

// 限流配置
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 60; // 每分钟最多60个请求
const requestCounts = new Map();

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

/**
 * 获取 fetch 实现（优先原生 fetch，回退到 node-fetch）
 */
const getFetch = async () => {
  if (typeof global !== 'undefined' && global.fetch) return global.fetch;
  try {
    return (await import('node-fetch')).default;
  } catch (e) {
    return null;
  }
};

/** 将 SiliconFlow 非 2xx 响应体转为可展示文案（避免只显示 API error: 403） */
function formatSiliconflowUpstreamError(status, errorText) {
  const raw = (errorText || '').trim();
  let upstream = '';
  try {
    const j = JSON.parse(raw);
    if (j && typeof j.message === 'string') upstream = j.message;
    else if (j && typeof j.error === 'string') upstream = j.error;
  } catch (_) {
    if (raw) upstream = raw.slice(0, 400);
  }
  if (!upstream) upstream = `HTTP ${status}`;

  if (/balance is insufficient|余额不足|insufficient balance/i.test(upstream) || /30001/.test(raw)) {
    return '大模型服务账户余额不足，请前往 SiliconFlow 控制台充值后重试。';
  }
  if (/invalid api key|incorrect api key|api key not valid|invalid.*api\s*key/i.test(upstream)) {
    return '大模型 API Key 无效或已过期，请检查 .env 中的 SILICONFLOW_API_KEY。';
  }
  const short = upstream.length > 220 ? `${upstream.slice(0, 220)}…` : upstream;
  return `服务暂时不可用（${status}）：${short}`;
}

/**
 * 统一的成功响应格式
 */
const successResponse = (res, data, meta = {}) => {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
};

/**
 * 统一的错误响应格式
 */
const errorResponse = (res, statusCode, error, details = null) => {
  const response = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString()
    }
  };
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  res.status(statusCode).json(response);
};

/**
 * 请求日志记录
 */
const logRequest = (req, res, next) => {
  const start = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: clientIp,
      userAgent: req.get('user-agent')?.substring(0, 50)
    };
    
    if (res.statusCode >= 400) {
      console.error('[Request Error]', JSON.stringify(logData));
    } else {
      console.log('[Request]', JSON.stringify(logData));
    }
  });
  
  next();
};

/**
 * 简单的内存限流中间件
 */
const rateLimiter = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // 清理过期的请求记录
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.resetTime > RATE_LIMIT_WINDOW) {
      requestCounts.delete(ip);
    }
  }
  
  // 获取或创建当前 IP 的请求记录
  let clientData = requestCounts.get(clientIp);
  if (!clientData || now > clientData.resetTime) {
    clientData = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    requestCounts.set(clientIp, clientData);
  }
  
  // 检查限流
  if (clientData.count >= RATE_LIMIT_MAX) {
    return errorResponse(res, 429, '请求过于频繁，请稍后再试', {
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  clientData.count++;
  
  // 添加限流响应头
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - clientData.count));
  res.setHeader('X-RateLimit-Reset', new Date(clientData.resetTime).toISOString());
  
  next();
};

/**
 * API Key 验证中间件
 */
const validateApiKey = (req, res, next) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  
  if (!apiKey || apiKey === 'your_key_here') {
    // #region agent log
    try {
      fs.appendFileSync(AGENT_DEBUG_LOG, JSON.stringify({ location: 'llmProxy.js:validateApiKey', message: 'missing or placeholder SILICONFLOW_API_KEY', data: { hasKey: !!apiKey, isPlaceholder: apiKey === 'your_key_here', path: req.path }, timestamp: Date.now(), hypothesisId: 'H1', runId: 'pre-fix' }) + '\n');
    } catch (_) {}
    // #endregion
    return errorResponse(res, 500, 'SILICONFLOW_API_KEY 未配置。请在 .env 文件中设置你的 API Key。');
  }
  
  req.apiKey = apiKey;
  next();
};

/**
 * 通用的 LLM 调用函数
 */
async function callLLM(systemPrompt, userContent, options = {}) {
  const {
    temperature = 0.5,
    jsonMode = true,
    model = MODEL_8B,
    timeout = 45000,
    maxRetries = 2,
    maxTokens = 800
  } = options;

  const apiKey = process.env.SILICONFLOW_API_KEY;
  const currentFetch = await getFetch();
  
  if (!currentFetch) throw new Error('Fetch implementation not found');
  if (!apiKey || apiKey === 'your_key_here') throw new Error('API Key 未配置');

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
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature,
          max_tokens: maxTokens,
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
          // 处理 markdown 代码块
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

      if (i === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('Unknown LLM error');
}

// ═══════════════════════════════════════════
// 中间件配置
// ═══════════════════════════════════════════

// 信任代理（用于云平台如 Render.com）
app.set('trust proxy', 1);

// CORS 配置
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(logRequest);
app.use(rateLimiter);

app.post('/api/debug-ingest', (req, res) => {
  try {
    console.log('[NDJSON_DEBUG]', JSON.stringify(req.body));
  } catch (e) {
    console.log('[NDJSON_DEBUG]', String(req.body));
  }
  res.status(204).end();
});

// ═══════════════════════════════════════════
// 全局异常处理
// ═══════════════════════════════════════════

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// ═══════════════════════════════════════════
// 基础端点
// ═══════════════════════════════════════════

/**
 * 健康检查端点
 */
app.get('/health', (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      llm: (!!apiKey && apiKey !== 'your_key_here') ? 'connected' : 'not_configured'
    }
  };
  
  const statusCode = health.services.llm === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * 根端点
 */
app.get('/', (req, res) => {
  res.json({
    name: 'MoodMix LLM Proxy',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      { path: '/health', method: 'GET', description: '健康检查' },
      { path: '/api/analyze-mood', method: 'POST', description: '情绪分析' },
      { path: '/api/analyze-mood/stream', method: 'POST', description: '流式情绪分析' },
      { path: '/api/comprehensive-analyze', method: 'POST', description: '综合分析' },
      { path: '/api/pattern-analyze', method: 'POST', description: '深度辨证分析' },
      { path: '/api/vector-translate', method: 'POST', description: '向量翻译' },
      { path: '/api/validate-optimize', method: 'POST', description: '校验与优化' },
      { path: '/api/generate-quotes', method: 'POST', description: '批量生成文案' },
      { path: '/api/drink-assistant', method: 'POST', description: '饮品制作助手' },
      { path: '/api/social-card-copy', method: 'POST', description: '社交卡片文案' },
      { path: '/api/speech-to-text', method: 'POST', description: '语音转文字' },
      { path: '/api/cocktaildb/*', method: 'ALL', description: 'CocktailDB 代理' },
      { path: '/api/cocktail-image/:imageName', method: 'GET', description: '鸡尾酒图片代理' },
      { path: '/api/amap/nearby', method: 'GET', description: '附近酒吧搜索' },
      { path: '/api/amap/regeo', method: 'GET', description: '逆地理编码' }
    ]
  });
});

// ═══════════════════════════════════════════
// CocktailDB API 代理
// ═══════════════════════════════════════════

app.all('/api/cocktaildb/*', async (req, res) => {
  const targetPath = req.originalUrl.replace('/api/cocktaildb', '') || '/';
  const targetUrl = `${COCKTAILDB_BASE}${targetPath}`;

  console.log('[CocktailDB Proxy]', req.method, targetUrl);

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) {
      return errorResponse(res, 500, 'Fetch implementation not found');
    }

    const response = await currentFetch(targetUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const status = response.status;
    const text = await response.text();
    
    console.log('[CocktailDB] Status:', status, 'Body:', text.substring(0, 200));

    if (status !== 200) {
      return errorResponse(res, status, 'CocktailDB API error', { status, body: text });
    }

    const data = JSON.parse(text);
    successResponse(res, data);
  } catch (error) {
    console.error('[CocktailDB Proxy Error]', error);
    errorResponse(res, 500, 'CocktailDB 代理请求失败', error.message);
  }
});

// ═══════════════════════════════════════════
// 鸡尾酒图片代理
// ═══════════════════════════════════════════

app.get('/api/cocktail-image/:imageName', async (req, res) => {
  const imageName = req.params.imageName;
  
  // 验证图片名称安全性
  if (!imageName || !/^[\w\-\.]+\.(jpg|jpeg|png|gif)$/i.test(imageName)) {
    return errorResponse(res, 400, '无效的图片名称');
  }
  
  const targetUrl = `https://www.thecocktaildb.com/images/media/drink/${imageName}`;

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) {
      return errorResponse(res, 500, 'Fetch implementation not found');
    }

    const response = await currentFetch(targetUrl);
    
    if (!response.ok) {
      return errorResponse(res, response.status, '图片获取失败');
    }

    // 转发原始 Content-Type
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // 设置长时间缓存
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // 流式转发
    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              return;
            }
            res.write(Buffer.from(value));
          }
        } catch (err) {
          console.error('[Image Pipe Error]', err);
          res.end();
        }
      };
      pump();
    }
  } catch (error) {
    console.error('[Image Proxy Error]', error);
    errorResponse(res, 502, '图片代理请求失败', error.message);
  }
});

// ═══════════════════════════════════════════
// LLM API 端点
// ═══════════════════════════════════════════

/**
 * 情绪分析处理器
 */
async function handleMoodAnalysis(req, res) {
  const { user_input, current_time } = req.body;

  if (!user_input || typeof user_input !== 'string' || !user_input.trim()) {
    return errorResponse(res, 400, '缺少 user_input 参数或参数无效');
  }

  try {
    const timeInfo = current_time || new Date().toISOString();
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(user_input.trim(), timeInfo);

    const parsed = await callLLM(systemPrompt, userMessage, {
      model: MODEL_CORE,
      temperature: 0.5,
      maxTokens: 800,
      timeout: 60000
    });

    console.log(`[${new Date().toLocaleTimeString()}] 分析完成: "${user_input.slice(0, 30)}..." → isNegative=${parsed.isNegative}`);

    successResponse(res, parsed);
  } catch (error) {
    console.error('分析请求失败:', error.message);
    errorResponse(res, 500, `分析失败: ${error.message}`);
  }
}

/**
 * POST /api/analyze-mood
 * POST /api/analyze_mood (向后兼容)
 * 情绪分析
 */
app.post('/api/analyze-mood', validateApiKey, handleMoodAnalysis);
app.post('/api/analyze_mood', validateApiKey, handleMoodAnalysis);

/**
 * 流式情绪分析处理器
 */
async function handleStreamMoodAnalysis(req, res) {
  // 设置 SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const { user_input, current_time, user_profile } = req.body;
    
    if (!user_input || typeof user_input !== 'string' || !user_input.trim()) {
      sendEvent({ error: '缺少 user_input 参数或参数无效', done: true });
      res.end();
      return;
    }

    const currentFetch = await getFetch();
    if (!currentFetch) {
      sendEvent({ error: 'Fetch implementation not found', done: true });
      res.end();
      return;
    }

    const timeInfo = current_time || new Date().toISOString();
    // 使用增强型 Prompt，确保包含辨证分析
    const systemPrompt = `你是一位深谙东方玄学与调酒艺术的智者。你的任务是将用户的一句心情描述，化作一段富有诗意的【心灵引导】。

### 阶段一：灵犀感应 (Thought Process)
当用户倾诉时，你需以心神会之，将心绪化作如下六个维度的意象感知（请用古典优雅的文言风格描述，不要使用现代结构化语言）：

1. 【情绪流转】感应用户心中之气：或是木之怒发，或是火之喜悦，或是土之思虑，或是金之悲戚，或是水之惊恐。描述时如品茗论道，以意象示之。
2. 【气机态势】感知躯体气机：是升发太过，还是沉降不足；是浮越于外，还是郁结于中。以经脉气血之言叙之。
3. 【时空呼应】观照当下时辰与节气：晨昏交替、二十四节气流转，此情此景与天时如何相应。以星象历法之意喻之。
4. 【神志状态】洞悉思维模式：念头是纷繁缠绕，还是清明朗照；是执着不放，还是散乱无根。以禅意佛理之言道之。
5. 【心之所向】明辨用户潜意识之诉求：欲止欲动，欲破欲立。以易经八卦之理推之。
6. 【场域感应】感知周遭能量场：独处之静谧，抑或众人之喧嚣，气场如何流转。以风水堪舆之术言之。

描述时请引经据典，化用诗词典故，如沐春风，如饮甘露，使闻者心领神会。

### 阶段二：天机呈现 (Final Result)
感应完毕，以[RESULT]标记呈现最终洞见，随后紧跟严格的JSON对象（此JSON仅作技术对接之用，用户不会看到）。

## JSON 结构示例（必须包含所有 Key）：
[RESULT]
{
  "moodData": {
    "emotion": { "physical": { "state": "思虑过多", "intensity": 0.8 }, "philosophy": { "wuxing": "土", "organ": "脾" }, "drinkMapping": { "tasteScore": 6, "colorCode": 3 } },
    "somatic": { "physical": { "sensation": "胸口闷堵", "intensity": 0.6 }, "philosophy": { "direction": "郁结", "yinyang": "偏阴" }, "drinkMapping": { "temperature": 0, "textureScore": 1 } },
    "time": { "physical": { "hour": 22, "period": "深夜", "intensity": 0.9 }, "drinkMapping": { "temporality": 22 } },
    "cognitive": { "physical": { "state": "思绪萦绕", "intensity": 0.7 }, "drinkMapping": { "aromaScore": 8 } },
    "demand": { "physical": { "state": "破局", "intensity": 0.8 }, "philosophy": { "type": "破" }, "drinkMapping": { "actionScore": 5 } },
    "socialContext": { "physical": { "state": "独自", "intensity": 1.0 }, "drinkMapping": { "ratioScore": 95 } }
  },
  "patternAnalysis": {
    "polarity": { "type": "negative", "confidence": 0.9 },
    "wuxing": { "user": "earth" },
    "strategy": { "type": "counter", "logic": "以木克土，借辛散之味破开脾土郁结" }
  },
  "summary": "思虑深重致气机郁结，宜以辛散之味破局。"
}`;
    const profileContextBlock = buildProfileContextBlock(user_profile);
    const userMessage = buildUserMessage(user_input.trim(), timeInfo) + profileContextBlock;

    console.log(`[Stream] 开始请求 SiliconFlow (${MODEL_CREATIVE})...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[Stream] 请求超时 (40s)');
      controller.abort();
    }, 40000);

    let response;
    try {
      response = await currentFetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.apiKey}`
        },
        body: JSON.stringify({
          model: MODEL_CREATIVE,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1500,
          stream: true
        }),
        signal: controller.signal
      });
    } catch (err) {
      console.error('[Stream] Fetch 网络错误:', err.message);
      sendEvent({ error: `网络连接失败: ${err.message}`, done: true });
      res.end();
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Stream] API 响应错误 [${response.status}]:`, errorText);
      sendEvent({ error: formatSiliconflowUpstreamError(response.status, errorText), done: true });
      res.end();
      return;
    }

    console.log('[Stream] 收到响应头，正在读取流...');

    let accumulated = '';
    let lineBuffer = '';

    const processChunk = (chunkText) => {
      lineBuffer += chunkText;
      let newlineIndex;
      
      while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
        const line = lineBuffer.slice(0, newlineIndex).trim();
        lineBuffer = lineBuffer.slice(newlineIndex + 1);

        if (!line.startsWith('data:')) continue;
        
        const data = line.replace(/^data:\s*/, '').trim();

        if (data === '[DONE]') {
          return true;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulated += delta;
            sendEvent({ delta, done: false });
          }
        } catch (e) {
          // 忽略不完整的 JSON
        }
      }
      return false;
    };

    const finishStream = () => {
      if (res.writableEnded) {
        console.warn('[Stream] finishStream skipped: response already ended (client disconnect or double-close); terminal SSE frame not sent');
        return;
      }

      try {
        const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : accumulated);
        // Deterministic debug marker (server-side, not controlled by LLM).
        try {
          const profileApplied = !!user_profile?.profileApplied && !!user_profile?.birthdayWuxing;
          if (parsed?.moodData && typeof parsed.moodData === 'object') {
            parsed.moodData.profileApplied = profileApplied;
            parsed.moodData.profileContextSummary = {
              profileApplied,
              longTermCity: user_profile?.longTermCity || '',
              birthplace: user_profile?.birthplace || '',
              birthdayWuxingDominantCn: user_profile?.birthdayWuxing?.dominantCn || null
            };
          }
        } catch (e) {
          // ignore marker failures
        }
        sendEvent({ done: true, data: parsed });
      } catch (e) {
        console.error('[Stream] Final parse error:', e.message);
        sendEvent({ done: true, error: '解析失败', raw: accumulated });
      }
      if (!res.writableEnded) {
        res.end();
      }
    };

    const reader = response.body;

    if (typeof reader.getReader === 'function') {
      // Web ReadableStream (原生 fetch)
      const webReader = reader.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await webReader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          if (processChunk(text)) break;
        }
        const upstreamTail = decoder.decode(new Uint8Array(), { stream: false });
        if (upstreamTail) processChunk(upstreamTail);
      } finally {
        webReader.releaseLock();
        finishStream();
      }
    } else {
      // Node.js Readable Stream (node-fetch)
      reader.on('data', (chunk) => {
        processChunk(chunk.toString());
      });
      reader.on('end', finishStream);
      reader.on('error', (err) => {
        console.error('[Stream] Node stream error:', err.message);
        if (!res.writableEnded) {
          sendEvent({ done: true, error: err.message });
          res.end();
        }
      });
    }

  } catch (error) {
    console.error('[Stream] 顶层捕获请求失败:', error.message);
    if (!res.writableEnded) {
      sendEvent({ done: true, error: error.message });
      res.end();
    }
  }
}

/**
 * POST /api/analyze-mood/stream
 * POST /api/analyze_mood_stream (向后兼容)
 * 流式情绪分析 (SSE)
 */
app.post('/api/analyze-mood/stream', validateApiKey, handleStreamMoodAnalysis);
app.post('/api/analyze_mood_stream', validateApiKey, handleStreamMoodAnalysis);

/**
 * POST /api/comprehensive-analyze
 * POST /api/comprehensive_analyze (向后兼容)
 * 综合分析（一次性完成语义+辨证+向量）
 */
async function handleComprehensiveAnalyze(req, res) {
  const { user_input, current_time, user_profile } = req.body;

  if (!user_input || typeof user_input !== 'string' || !user_input.trim()) {
    return errorResponse(res, 400, '缺少 user_input 参数或参数无效');
  }

  try {
    const timeInfo = current_time || new Date().toISOString();
    const systemPrompt = buildComprehensiveSystemPrompt();
    const profileContextBlock = buildProfileContextBlock(user_profile);
    const userMessage = buildUserMessage(user_input.trim(), timeInfo) + profileContextBlock;

    const parsed = await callLLM(systemPrompt, userMessage, {
      model: MODEL_CORE,
      temperature: 0.5,
      maxTokens: 1200,
      timeout: 60000
    });

    // Deterministic debug marker (server-side, not controlled by LLM).
    try {
      const profileApplied = !!user_profile?.profileApplied && !!user_profile?.birthdayWuxing;
      if (parsed?.moodData && typeof parsed.moodData === 'object') {
        parsed.moodData.profileApplied = profileApplied;
        parsed.moodData.profileContextSummary = {
          profileApplied,
          longTermCity: user_profile?.longTermCity || '',
          birthplace: user_profile?.birthplace || '',
          birthdayWuxingDominantCn: user_profile?.birthdayWuxing?.dominantCn || null
        };
      }
    } catch (e) {
      // ignore marker failures
    }

    successResponse(res, parsed);
  } catch (error) {
    console.error('综合分析请求失败:', error.message);
    errorResponse(res, 500, `综合分析失败: ${error.message}`);
  }
}

app.post('/api/comprehensive-analyze', validateApiKey, handleComprehensiveAnalyze);
app.post('/api/comprehensive_analyze', validateApiKey, handleComprehensiveAnalyze);

/**
 * POST /api/pattern-analyze
 * POST /api/pattern_analyze (向后兼容)
 * 深度辨证分析
 */
async function handlePatternAnalyze(req, res) {
  const { moodData } = req.body;
  
  if (!moodData) {
    return errorResponse(res, 400, '缺少 moodData 参数');
  }

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
    successResponse(res, data);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
}

app.post('/api/pattern-analyze', validateApiKey, handlePatternAnalyze);
app.post('/api/pattern_analyze', validateApiKey, handlePatternAnalyze);

/**
 * POST /api/vector-translate
 * POST /api/vector_translate (向后兼容)
 * 向量翻译
 */
async function handleVectorTranslate(req, res) {
  const { moodData, patternAnalysis } = req.body;
  
  if (!moodData || !patternAnalysis) {
    return errorResponse(res, 400, '缺少 moodData 或 patternAnalysis 参数');
  }

  const systemPrompt = `你是一位精通跨模态映射的数学与风味专家。
将中医辨证结论翻译为 8 维饮品搜索向量。

## 8维维度说明
[taste(0-10), texture(-3~3), temperature(-5~5), color(1-5), temporality(0-23), aroma(0-10), ratio(0-95), action(1-5)]

## 输出格式
{
  "targetVector": [number, number, ...],
  "weights": [number, number, ...],
  "priorities": ["dimension_name", ...], 
  "mappingExplanation": { "wuxing": "string", "strategy": "string", "keyDimensions": ["string", ...] }
}`;

  try {
    const data = await callLLM(systemPrompt, JSON.stringify({ moodData, patternAnalysis }), { model: MODEL_CORE });
    successResponse(res, data);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
}

app.post('/api/vector-translate', validateApiKey, handleVectorTranslate);
app.post('/api/vector_translate', validateApiKey, handleVectorTranslate);

/**
 * POST /api/validate-optimize
 * POST /api/validate_optimize (向后兼容)
 * 校验与优化
 */
async function handleValidateOptimize(req, res) {
  const { fullContext } = req.body;
  
  if (!fullContext) {
    return errorResponse(res, 400, '缺少 fullContext 参数');
  }

  const systemPrompt = `你是一位严谨的系统验证专家。
请审查当前的推荐流输出，检测潜在冲突、安全性问题，并给出质量评分。
你必须【严格且唯一】地返回一个合法的 JSON 对象，严禁包含任何 Markdown 格式标识、解释性文字或开场白。

## 输出格式
{
  "score": number,
  "qualityLevel": "excellent/good/acceptable/poor",
  "shouldRetry": boolean,
  "shouldBlock": boolean,
  "userMessage": "string or null",
  "issues": [ { "type": "error/warning/info", "message": "string", "severity": "high/medium/low" } ],
  "uiHints": { 
    "showBadge": boolean, 
    "badgeText": "string",
    "bottomHintText": "string" 
  }
}`;

  try {
    const data = await callLLM(systemPrompt, JSON.stringify(fullContext), {
      model: MODEL_8B,
      timeout: 50000,
      maxRetries: 2
    });
    successResponse(res, data);
  } catch (error) {
    console.error('[ValidateOptimize Error] 质检流程中断:', error.message);
    errorResponse(res, 500, error.message, {
      type: error.name === 'AbortError' ? 'timeout' : 'error'
    });
  }
}

app.post('/api/validate-optimize', validateApiKey, handleValidateOptimize);
app.post('/api/validate_optimize', validateApiKey, handleValidateOptimize);

/**
 * POST /api/quality-eval
 * POST /api/quality_eval (向后兼容)
 * 单款饮品质量评估 — 五行相合度 + 情绪一致性
 */
async function handleQualityEval(req, res) {
  const { moodSummary, userWuxing, drinkName, drinkWuxing, currentTime } = req.body;

  if (!drinkName) {
    return errorResponse(res, 400, '缺少 drinkName 参数');
  }

  const systemPrompt = `你是 MoodMix 的质量评估师。请评估以下饮品推荐的合理性。

用户情绪：${moodSummary || '未知'}
用户五行：${userWuxing || '未知'}
推荐饮品：${drinkName}
饮品五行：${drinkWuxing || '未知'}
当前时间：${currentTime || '未知'}

请从以下两个维度打分（0-100）：
1. 五行相合度：推荐饮品的五行与用户五行是否相生相合（相生=高分，相克=低分）
2. 情绪一致性：饮品的特性是否回应了用户的情绪需求（契合=高分，矛盾=低分）

直接输出 JSON，不要任何解释：
{"wuxingScore": 85, "emotionScore": 90}`;

  try {
    const data = await callLLM(systemPrompt, '请评估并返回JSON', {
      model: MODEL_8B,
      timeout: 15000,
      maxRetries: 1
    });
    successResponse(res, data);
  } catch (error) {
    console.error('[QualityEval Error]', error.message);
    errorResponse(res, 500, error.message, {
      type: error.name === 'AbortError' ? 'timeout' : 'error'
    });
  }
}

app.post('/api/quality-eval', validateApiKey, handleQualityEval);
app.post('/api/quality_eval', validateApiKey, handleQualityEval);

/**
 * POST /api/generate-quotes
 * POST /api/generate_quotes (向后兼容)
 * 批量生成文案
 */
async function handleGenerateQuotes(req, res) {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return errorResponse(res, 400, '缺少有效的 items 数组');
  }

  if (items.length > 10) {
    return errorResponse(res, 400, '单次最多生成 10 条文案');
  }

  try {
    const systemPrompt = `你是一位深谙东方五行哲学与现代调酒艺术的专业酒保，正在 MoodMix 吧台为客人提供“灵魂推荐”。
你的任务是为客人的推荐饮品写一句具有【东方哲学桥梁】感的短语。

【核心叙事架构 - 必须遵循】：
你必须构建一个逻辑桥梁：[客人的生理/心理失调状态 (辨证)] → [调和与转化的逻辑 (策略)] → [饮品具体的物理反馈 (体感与画像)]。

【严格避坑指南 - 违反其中任何一项将导致灾难】：
1. **彻底戒断“模式化”开头**：
   - **绝对禁止使用“因为...”、“看你...”、“最近...”等作为句头**。
   - 每一句的开头必须【非线性】化。可以直接从冰块的撞击声、香气的掠过、或者五行生克的哲学观察直接切入。
   - **绝对禁止复读用户输入或辨证标签的原文**。
2. **拒绝“四字词汇”堆砌**：不要说“清新脱俗”，要说“带着草本初露的凉意”。
3. **东方韵味 vs 现代逻辑**：
   - 语气要像一位智慧、平和、懂生活的【高级调酒师】。
   - 必须包含五行的调护逻辑（木、火、土、金、水）及其转化（如：以火克金，以水生木），但要通过饮品的物理特征（温度、色调、烈度）来体现。
4. **格式与长度**：
   - 长度控制在 **25-45 字**。
   - 不带标点，必须用「」包裹。
5. **动态多样性惩罚**：
   - 同一批次的 9 杯酒，必须呈现出完全不同的视角。有的从嗅觉、有的从视觉、有的从人生况味、有的从季节变换切入。

【示例（仅供参考魂魄，禁止抄袭骨架）】：
- 辨证:气郁; 策略:疏肝理气 → 「胸臆间那股化不开的闷，最宜用金酒中那抹透亮的杜松子辛香去引，让气息顺着冰块的裂纹重新流淌开来」
- 辨证:心火; 策略:清热降火 → 「掌心的燥热在触碰到这杯凝着霜雾的薄荷苏打时便已收敛了三分，清冽的凉意能把乱了节奏的呼吸重新压实」

你必须严格输出一个合法的 JSON Object，Key 是饮品 ID，Value 是你写的句子。`;

    let userContent = `【核心上下文】
心境: ${items[0].contextPackage?.moodSummary || '未知'} | 五行: ${items[0].userWuxing || '未知'}

【待分析清单】\n`;
    
    items.forEach((item, index) => {
      userContent += `ID:${item.id} | 名称:${item.name} | 辨证:${item.diagnosis || item.contextPackage?.userState} | 策略:${item.strategy || item.contextPackage?.strategy} | 画像:${item.contextPackage?.drinkProfile} | 体感:${item.sensory || item.contextPackage?.sensory}\n\n`;
    });

    userContent += "请严格以 JSON 格式输出，确保每一句都独一无二，绝不重复开头。";

    const parsedQuotes = await callLLM(systemPrompt, userContent, {
      model: MODEL_CREATIVE,
      temperature: 0.9,
      maxTokens: 1200,
      timeout: 55000
    });

    console.log(`[QuoteGenerator] Batch generated ${Object.keys(parsedQuotes).length} quotes successfully.`);
    successResponse(res, parsedQuotes);

  } catch (error) {
    console.error('[QuoteGenerator] Error:', error.message);
    errorResponse(res, 500, error.message);
  }
}

app.post('/api/generate-quotes', validateApiKey, handleGenerateQuotes);
app.post('/api/generate_quotes', validateApiKey, handleGenerateQuotes);

/**
 * POST /api/drink-assistant
 * POST /api/drink_assistant (向后兼容)
 * 饮品制作助手
 */
async function handleDrinkAssistant(req, res) {
  const { drink, question, userInventory } = req.body;

  if (!drink || !question) {
    return errorResponse(res, 400, '缺少 drink 或 question 参数');
  }

  try {
    const ingredientList = drink.ingredients?.map(ing =>
      `${ing.name || ing.ingredient}: ${ing.measure || ''}`
    ).join('\n') || '未知配方';

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

    const answer = await callLLM(systemPrompt, userMessage, {
      model: MODEL_8B,
      temperature: 0.7,
      jsonMode: false,
      maxTokens: 500
    });

    successResponse(res, { answer });
  } catch (error) {
    console.error('[Drink Assistant] Error:', error);
    errorResponse(res, 500, error.message);
  }
}

app.post('/api/drink-assistant', validateApiKey, handleDrinkAssistant);
app.post('/api/drink_assistant', validateApiKey, handleDrinkAssistant);

/**
 * POST /api/social-card-copy
 * POST /api/social_card_copy (向后兼容)
 * 社交卡片文案生成（有情绪输入）
 */
async function handleSocialCardCopy(req, res) {
  const { drink, prompt: userPrompt } = req.body;
  
  if (!drink || !userPrompt) {
    return errorResponse(res, 400, '缺少 drink 或 prompt 参数');
  }

  try {
    const systemPrompt = `你是一位深谙东方审美与现代情绪表达的文案大师。
你的任务是为饮品分享卡片生成一段极具【诗意】与【克制感】的文案。

【核心要求】：
1. 风格：东方韵味、极简、有温度、像耳边的低语。
2. 长度：2-3句话，30-50字。
3. 严禁：鸡汤、口号、感叹号、四字词语堆砌。
4. 内容：结合饮品的感官细节（色、味、温）和用户的情绪心径。`;

    const copy = await callLLM(systemPrompt, userPrompt, {
      model: MODEL_CREATIVE,
      temperature: 0.8,
      jsonMode: false,
      maxTokens: 300
    });

    successResponse(res, { copy });
  } catch (error) {
    console.error('[Social Card Copy] Error:', error);
    errorResponse(res, 500, error.message);
  }
}

app.post('/api/social-card-copy', validateApiKey, handleSocialCardCopy);
app.post('/api/social_card_copy', validateApiKey, handleSocialCardCopy);

/**
 * POST /api/social-card-no-mood
 * POST /api/social_card_no_mood (向后兼容)
 * 社交卡片文案生成（无情绪输入，仅基于饮品画像）
 * - 返回结构化 JSON：{ tagEmotion, tagScene, copy }
 */
async function handleSocialCardNoMood(req, res) {
  const { drink } = req.body || {};

  if (!drink) {
    return errorResponse(res, 400, '缺少 drink 参数');
  }

  try {
    const systemPrompt = `你是一位东方情绪酒馆的策展人兼文案。

场景条件：
- 用户此刻没有提供任何情绪输入。
- 你只知道这杯饮品本身的风味与属性。

你的任务：
基于【饮品本身】，为分享卡片生成：
1) 一枚描述这杯酒「气质/氛围」的短标签 tagEmotion（3-6个汉字，不要标点，不要出现“你”“我”“现在”等指代用户的词）。
2) 一枚描述这杯酒「适合的场景/节奏」的短标签 tagScene（4-10个汉字，例如“下班后小酌”“周末放空”“深夜收尾”等，不要医学或“调理中”字眼）。
3) 一段分享文案 copy，用于卡片正文（2-3句，30-50字，风格克制、有画面感，结合饮品的颜色/温度/口感/香气，并轻轻暗示适合的饮用时刻；不要推测用户心情，不要使用感叹号）。

重要限制：
- 语气要像朋友间的低语，东方审美，避免鸡汤和励志口号。
- 不要使用“待辨证”“调理中”“疗愈”“治愈”这类医学感或过重的词汇。

你必须严格只输出一个 JSON 对象，不要任何解释或自然语言。JSON 结构如下：
{
  "tagEmotion": "夜航微醺",
  "tagScene": "下班后小酌",
  "copy": "……30-50字文案……"
}`;

    const userMessage = `以下是这杯饮品的关键信息，请据此完成任务：
- 名称：${drink.name || '未知饮品'}
- 中文名：${drink.name_cn || '（可能为空）'}
- 类型：${drink.category || drink.categoryName || '未知类型'}
- 酒精度（ABV）：${typeof drink.abv === 'number' ? drink.abv + '%' : '未知'}
- 主要风味/原料：${Array.isArray(drink.briefIngredients) && drink.briefIngredients.length > 0
  ? drink.briefIngredients.map(i => i.label || i.name).join('、')
  : (drink.ingredients || []).map(i => i.name).join('、') || '未标注'}
- 推荐理由：${drink.reason || '暂无'}

请根据上述信息，生成符合要求的 tagEmotion、tagScene 和 copy。`;

    const result = await callLLM(systemPrompt, userMessage, {
      model: MODEL_CREATIVE,
      temperature: 0.8,
      jsonMode: true,
      maxTokens: 400
    });

    const safe = {
      tagEmotion: typeof result.tagEmotion === 'string' ? result.tagEmotion.trim() : null,
      tagScene: typeof result.tagScene === 'string' ? result.tagScene.trim() : null,
      copy: typeof result.copy === 'string' ? result.copy.trim() : ''
    };

    // 兜底：确保 copy 总是有值
    if (!safe.copy) {
      safe.copy = '这一杯，适合在你愿意停下来的时候，慢慢喝完。';
    }

    successResponse(res, safe);
  } catch (error) {
    console.error('[Social Card No Mood] Error:', error);
    errorResponse(res, 500, error.message);
  }
}

app.post('/api/social-card-no-mood', validateApiKey, handleSocialCardNoMood);
app.post('/api/social_card_no_mood', validateApiKey, handleSocialCardNoMood);

/**
 * POST /api/speech-to-text
 * POST /api/speech_to_text (向后兼容)
 * 语音转文字 - 使用多模态模型处理音频
 */
async function handleSpeechToText(req, res) {
  const { audio, format = 'webm' } = req.body;

  if (!audio) {
    return errorResponse(res, 400, '缺少 audio 参数');
  }

  // 验证音频格式
  const validFormats = ['wav', 'mp3', 'm4a', 'webm', 'ogg'];
  if (!validFormats.includes(format.toLowerCase())) {
    return errorResponse(res, 400, `不支持的音频格式: ${format}。支持的格式: ${validFormats.join(', ')}`);
  }

  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    const currentFetch = await getFetch();
    
    if (!currentFetch) throw new Error('Fetch implementation not found');
    if (!apiKey || apiKey === 'your_key_here') {
      return errorResponse(res, 500, 'API Key 未配置，无法使用语音识别功能');
    }

    // 构建音频的 data URL
    const mimeType = format === 'webm' ? 'audio/webm' : `audio/${format}`;
    const audioDataUrl = `data:${mimeType};base64,${audio}`;

    const systemPrompt = `你是一位语音识别专家。请仔细聆听用户提供的音频内容，将其转录为文字。
要求：
1. 准确识别中文语音内容
2. 如果音频质量不佳或无法识别，返回 "[无法识别]"
3. 只返回转录的文字内容，不要添加任何解释或标点符号建议`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await currentFetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'MoodMix/1.0 (Node.js)'
      },
      body: JSON.stringify({
        model: MODEL_8B,
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: '请转录这段语音内容：' },
              { type: 'audio_url', audio_url: { url: audioDataUrl } }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text');
      throw new Error(`API 返回错误 (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    const text = (result.choices?.[0]?.message?.content || '').trim();

    // 检查是否为无法识别
    if (text.includes('[无法识别]') || text.length === 0) {
      return errorResponse(res, 422, '无法识别语音内容，请重试');
    }

    successResponse(res, { text, format });
  } catch (error) {
    console.error('[Speech-to-Text] Error:', error);
    if (error.name === 'AbortError') {
      errorResponse(res, 504, '语音识别请求超时，请重试');
    } else {
      errorResponse(res, 500, `语音识别失败: ${error.message}`);
    }
  }
}

app.post('/api/speech-to-text', validateApiKey, handleSpeechToText);
app.post('/api/speech_to_text', validateApiKey, handleSpeechToText);

// ═══════════════════════════════════════════
// Prompt 工程函数
// ═══════════════════════════════════════════

function buildSystemPrompt() {
  return `你是一位集"语义蒸馏"、"中医辨证"与"调酒风味专家"映射于一身的智能中枢。
你的任务是将用户的一句心情描述，演变为一场深度的【流态辨证】。

### 核心任务指引
在输出最终的 JSON 结构之前，你必须先输出一段具有东方哲学韵味的【心绪拆解】，以帮助用户理解推荐背后的哲学逻辑。

### 阶段一：流态辨证 (Thought Process)
请按以下 6 个维度中用户提到或暗示的部分进行拆解输出（以 [THOUGHT] 开头）：
1. 【情绪】映射五行(木怒/火喜/土思/金悲/水恐)的消长。
2. 【气机】躯体状态在升降浮沉中的偏移。
3. 【时空】当前时辰/节气对心境的微妙影响。
4. 【神志】认知与思维模式的凝滞或散乱。
5. 【仪轨】用户潜在的诉求(止/动/破)逻辑。
6. 【场域】社交环境对能量场的干预。

### 阶段二：结构化输出 (Final Result)
拆解完成后，输出 [RESULT] 标记，随后紧跟严格的 JSON 对象。

## JSON 结构要求：
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

function buildComprehensiveSystemPrompt() {
  return `你是一位集"语义蒸馏"、"中医辨证"与"调酒风味专家"映射于一身的智能中枢。
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
  "moodData": { /* 六维数据 */ },
  "patternAnalysis": { /* 辨证分析 */ },
  "vectorResult": { /* 向量结果 */ }
}`;
}

function buildUserMessage(userInput, timeInfo) {
  return `当前时间: ${timeInfo}

用户说: "${userInput}"

请根据以上信息，按照系统提示中定义的六维框架进行分析，严格返回 JSON。
如果用户没有明确提及某个维度的信息，请根据上下文合理推断。`;
}

function buildProfileContextBlock(user_profile) {
  const profileApplied = !!user_profile?.profileApplied && !!user_profile?.birthdayWuxing;
  if (!profileApplied) {
    return `

[ProfileContext]
profileApplied: false
Rules:
- Do not apply any profile-derived constraints.
`;
  }

  const birthdayWuxing = user_profile?.birthdayWuxing || {};
  const derived = birthdayWuxing?.derivedMoodMapping || {};
  const fullScores = birthdayWuxing?.full_scores || {};

  const dominantCn = birthdayWuxing?.dominantCn || '土';
  const tasteScore = derived?.tasteScore ?? 6;
  const colorCode = derived?.colorCode ?? 3;
  const textureScore = derived?.textureScore ?? 0;
  const temperature = derived?.temperature ?? 0;
  const temporality = derived?.temporality ?? 12;

  const longTermCity = user_profile?.longTermCity || '';
  const birthplace = user_profile?.birthplace || '';

  const southKeywords = [
    '广东', '广西', '海南', '福建', '浙江', '江西', '湖南', '湖北', '重庆', '四川',
    '云南', '贵州', '上海', '江苏', '台', '香港', '澳门'
  ];
  const southKeywordList = southKeywords.join('、');

  return `

[ProfileContext]
profileApplied: true
longTermCity: ${longTermCity}
birthplace: ${birthplace}
birthdayWuxing.dominantCn: ${dominantCn}
birthdayWuxing.full_scores: ${JSON.stringify(fullScores)}

[ProfileRules - MUST FOLLOW]
1) Birthday fixed constraints (authoritative; override any inference):
- moodData.emotion.philosophy.wuxing = "${dominantCn}"
- moodData.emotion.drinkMapping.tasteScore = ${tasteScore}
- moodData.emotion.drinkMapping.colorCode = ${colorCode}
- moodData.somatic.drinkMapping.textureScore = ${textureScore}
- moodData.somatic.drinkMapping.temperature = ${temperature}
- moodData.time.drinkMapping.temporality = ${temporality}

2) ConstitutionBias from longTermCity/birthplace (substring match):
- If (longTermCity OR birthplace) contains any keyword in [${southKeywordList}] then constitutionBias = "偏阳"
- Else constitutionBias = "偏阴"

3) ConstitutionBias fixed assignments:
- moodData.somatic.philosophy.yinyang = constitutionBias
- moodData.socialContext.drinkMapping.ratioScore = 75 if constitutionBias="偏阳" else 35
- moodData.demand.drinkMapping.actionScore = 4 if constitutionBias="偏阳" else 2

4) Conflict resolution:
- If inferred values conflict with the fixed constraints above, always use the fixed constraints above.
`;
}

// ═══════════════════════════════════════════
// 全局错误处理中间件
// ═══════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  errorResponse(res, err.status || 500, err.message || '服务器内部错误');
});

// ═══════════════════════════════════════════
// 饮品心意统计 API
// ═══════════════════════════════════════════

const drinkLikeStats = new Map();

function initDrinkLikeStats(drinkId) {
  if (!drinkLikeStats.has(drinkId)) {
    drinkLikeStats.set(drinkId, {
      userUIDs: new Set(),
      count: 0
    });
  }
}

app.post('/api/drink/like', (req, res) => {
  const { drinkId, userUID } = req.body;
  if (!drinkId || !userUID) return errorResponse(res, 400, '缺少 drinkId 或 userUID');
  initDrinkLikeStats(drinkId);
  const stats = drinkLikeStats.get(drinkId);
  const isNewLike = !stats.userUIDs.has(userUID);
  if (isNewLike) {
    stats.userUIDs.add(userUID);
    stats.count++;
  }
  io.to(`drink-${drinkId}`).emit('drink-liked', { drinkId, count: stats.count, isNewLike });
  res.json({ success: true, count: stats.count, showMessage: stats.count >= 2 });
});

app.post('/api/drink/unlike', (req, res) => {
  const { drinkId, userUID } = req.body;
  if (!drinkId || !userUID) return errorResponse(res, 400, '缺少 drinkId 或 userUID');
  initDrinkLikeStats(drinkId);
  const stats = drinkLikeStats.get(drinkId);
  if (stats.userUIDs.has(userUID)) {
    stats.userUIDs.delete(userUID);
    stats.count = Math.max(0, stats.count - 1);
  }
  io.to(`drink-${drinkId}`).emit('drink-liked', { drinkId, count: stats.count, isNewLike: false });
  res.json({ success: true, count: stats.count, showMessage: stats.count >= 2 });
});

app.get('/api/drink/like-stats/:drinkId', (req, res) => {
  const { drinkId } = req.params;
  initDrinkLikeStats(drinkId);
  const stats = drinkLikeStats.get(drinkId);
  res.json({ success: true, count: stats.count, showMessage: stats.count >= 2 });
});

// ═══════════════════════════════════════════
// Socket.IO 实时通信
// ═══════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('[Socket] 客户端已连接:', socket.id);
  socket.on('join-drink-room', (drinkId) => {
    socket.join(`drink-${drinkId}`);
    console.log(`[Socket] ${socket.id} 加入饮品房间: drink-${drinkId}`);
  });
  socket.on('leave-drink-room', (drinkId) => {
    socket.leave(`drink-${drinkId}`);
    console.log(`[Socket] ${socket.id} 离开饮品房间: drink-${drinkId}`);
  });
  socket.on('disconnect', () => {
    console.log('[Socket] 客户端已断开:', socket.id);
  });
});

// ═══════════════════════════════════════════
// 高德地图 API 代理（附近可以喝功能）
// ═══════════════════════════════════════════

const AMAP_KEY = process.env.AMAP_KEY || process.env.REACT_APP_AMAP_KEY || '';

/**
 * GET /api/amap/nearby
 * 搜索附近酒吧（高德 POI 周边搜索）
 */
app.get('/api/amap/nearby', async (req, res) => {
  const { lng, lat, radius = 3000, keywords } = req.query;

  if (!lng || !lat) {
    return errorResponse(res, 400, '缺少 lng 或 lat 参数');
  }

  if (!AMAP_KEY) {
    return errorResponse(res, 500, '高德 API Key 未配置。请在 .env 中设置 AMAP_KEY。');
  }

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) {
      return errorResponse(res, 500, 'Fetch implementation not found');
    }

    // 注意：`keywords` 在 Amap 中可能作为“名称过滤”，会导致即使 `types=071301` 有结果，
    // 仍然返回空 pois。这里默认不传 keywords，仅在显式提供 keywords 时才附加。
    const urlBase = `https://restapi.amap.com/v3/place/around?`
      + `key=${AMAP_KEY}`
      + `&location=${lng},${lat}`
      + `&types=071301`
      + `&radius=${radius}`
      + `&offset=10`
      + `&sortrule=distance`;

    const keywordStr = typeof keywords === 'string' ? keywords.trim() : '';
    const url = keywordStr
      ? `${urlBase}&keywords=${encodeURIComponent(keywordStr)}`
      : urlBase;

    console.log('[Amap Nearby] Requesting:', url.replace(AMAP_KEY, '***'));

    const response = await currentFetch(url);
    const data = await response.json();

    const mapPoisToBars = (pois) => (pois || []).map((poi) => ({
      id: poi.id,
      name: poi.name,
      address: poi.address,
      distance: parseInt(poi.distance),
      location: poi.location,
      tel: poi.tel || '',
    }));

    const poisCount = data?.pois?.length ?? 0;
    if (data?.status === '1' && poisCount > 0) {
      const bars = mapPoisToBars(data.pois);
      successResponse(res, bars, {
        amapStatus: data.status,
        amapInfo: data.info,
        poisCount,
        usedFallback: false,
      });
      return;
    }

    // Fallback：如果 types 过滤后为空，尝试用 keywords-only 再搜一次（更贴近地图 UI 的“附近酒吧”搜索体验）
    const keywordFallback = keywordStr || '酒吧';
    const urlFallback = `https://restapi.amap.com/v3/place/around?`
      + `key=${AMAP_KEY}`
      + `&location=${lng},${lat}`
      + `&keywords=${encodeURIComponent(keywordFallback)}`
      + `&radius=${radius}`
      + `&offset=10`
      + `&sortrule=distance`;

    console.log('[Amap Nearby Fallback] Requesting:', urlFallback.replace(AMAP_KEY, '***'));
    const response2 = await currentFetch(urlFallback);
    const data2 = await response2.json();
    const poisCount2 = data2?.pois?.length ?? 0;

    if (data2?.status === '1' && poisCount2 > 0) {
      const bars = mapPoisToBars(data2.pois);
      successResponse(res, bars, {
        amapStatus: data2.status,
        amapInfo: data2.info,
        poisCount: poisCount2,
        usedFallback: true,
        initialAmapStatus: data?.status,
        initialAmapInfo: data?.info,
        initialPoisCount: poisCount,
      });
      return;
    }

    successResponse(res, [], {
      amapStatus: data?.status ?? data2?.status,
      amapInfo: data?.info ?? data2?.info,
      poisCount: poisCount2,
      usedFallback: true,
      initialPoisCount: poisCount,
    });
  } catch (error) {
    console.error('[Amap Nearby] Error:', error);
    errorResponse(res, 500, '附近搜索失败', error.message);
  }
});

/**
 * GET /api/amap/regeo
 * 逆地理编码 — 经纬度转地名
 */
app.get('/api/amap/regeo', async (req, res) => {
  const { lng, lat } = req.query;

  if (!lng || !lat) {
    return errorResponse(res, 400, '缺少 lng 或 lat 参数');
  }

  if (!AMAP_KEY) {
    return errorResponse(res, 500, '高德 API Key 未配置');
  }

  try {
    const currentFetch = await getFetch();
    if (!currentFetch) {
      return errorResponse(res, 500, 'Fetch implementation not found');
    }

    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng},${lat}`;
    const response = await currentFetch(url);
    const data = await response.json();

    if (data.status === '1') {
      const comp = data.regeocode?.addressComponent;
      const name = comp?.neighborhood?.name || comp?.township || '当前位置';
      successResponse(res, name);
    } else {
      successResponse(res, '当前位置');
    }
  } catch (error) {
    console.error('[Amap Regeo] Error:', error);
    successResponse(res, '当前位置');
  }
});

// 404 处理
app.use((req, res) => {
  errorResponse(res, 404, `未找到端点: ${req.method} ${req.path}`);
});

// ═══════════════════════════════════════════
// 启动服务器
// ═══════════════════════════════════════════

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    MoodMix LLM Proxy                         ║
╠══════════════════════════════════════════════════════════════╣
║  服务状态: 运行中                                              ║
║  端口: ${PORT}                                               ║
║  环境: ${process.env.NODE_ENV || 'development'}                          ║
║  API Key: ${process.env.SILICONFLOW_API_KEY ? '已配置 ✓' : '未配置 ✗'}                          ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

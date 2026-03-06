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

  if (!apiKey || apiKey === 'your_key_here') {
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

  const { items, variation } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'items is required and must be a non-empty array'
    });
  }

  try {
    console.log('[API] /api/generate_quotes called for', items.length, 'items');

    const quotes = {};
    const BATCH_SIZE = 3;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchNames = batch.map(item => item.name).join('、');

      const systemPrompt = `你是一个富有诗意的酒饮文案大师。请为以下鸡尾酒生成简短富有意境的文案（8-12个中文字符）。
要求：
1. 直接输出文案，不要任何解释或格式
2. 每行一个，不要编号
3. 文案要富有诗意、意境优美
4. 结合酒名本身的意象`;

      const userMessage = `请为以下鸡尾酒生成文案：${batchNames}`;

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
          temperature: 0.8,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('SiliconFlow API error:', response.status, errorData);
        continue;
      }

      const result = await response.json();
      const aiMessage = result.choices?.[0]?.message?.content || '';

      const lines = aiMessage.split('\n').filter(line => line.trim());
      batch.forEach((item, index) => {
        if (lines[index]) {
          let quote = lines[index].trim();
          if (!quote.startsWith('「') && !quote.startsWith('"') && !quote.startsWith('「')) {
            quote = `「${quote}」`;
          }
          quotes[item.id] = quote;
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
  console.log(`   API: /api/analyze_mood`);
  console.log(`   模型: ${SILICONFLOW_MODEL}`);
  console.log(`   API Key: ${hasKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   访问地址: http://0.0.0.0:${PORT}\n`);
});

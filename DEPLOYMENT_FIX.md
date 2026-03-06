# 🍹 MoodMix 部署指南 - Render.com 修复

## 问题诊断

当在 Render.com 上部署时，你看到了 **"Invalid Host header"** 错误。这是由于：

1. **Webpack 开发服务器的主机验证**：`react-scripts start` 运行的 Webpack 开发服务器有内置的主机头验证
2. **域名不匹配**：Render.com 分配的域名（如 `moodmix-brve.onrender.com`）与本地开发时使用的主机不匹配
3. **配置问题**：原始的 `render.yaml` 配置不适合生产部署

## 解决方案概览

### 为开发环境（本地）修复

如果你想在本地使用 `npm start` 开发，使用新创建的 `.env` 文件：

```bash
# .env 文件中已设置
DANGEROUSLY_DISABLE_HOST_CHECK=true
HOST=0.0.0.0
```

这将禁用 Webpack 的主机头检查，允许你从任何主机访问开发服务器。

**运行开发服务器：**
```bash
npm start
```

### 为生产环境（Render.com）修复

新的部署流程：

1. **构建阶段**：`npm install && npm run build`
   - 创建优化的生产构建（在 `./build` 目录中）
   - 删除 Webpack 开发服务器的依赖

2. **启动阶段**：`npm run serve-prod`
   - 启动 `prodServer.js`（Express 服务器）
   - 提供静态构建文件（SPA 重定向）
   - 为 `/api/*` 请求代理给 LLM 后端

## 文件更改说明

### 1. `.env` 文件（新文件）
```
SILICONFLOW_API_KEY=your_key_here      # 你的 SiliconFlow API Key
SILICONFLOW_MODEL=Qwen/Qwen2.5-72B-Instruct
NODE_ENV=development                   # 开发/生产
PORT=3000                              # 前端端口
PROXY_PORT=3001                        # API 代理端口
DANGEROUSLY_DISABLE_HOST_CHECK=true    # 禁用主机检查
HOST=0.0.0.0                          # 允许所有主机访问
```

### 2. `package.json` 更新
添加了新的脚本：
```json
"serve-prod": "node server/prodServer.js"
```

这在生产环境中启动 Express 服务器。

### 3. `server/prodServer.js`（新文件）
一个完整的 Express 服务器，提供：
- 前端静态文件服务（来自 `./build`）
- SPA 路由重定向（单页应用支持）
- `/api/analyze_mood` 端点（LLM 代理）
- CORS 支持
- Host 头处理

### 4. `render.yaml` 更新
简化为单个 Web 服务（不再分离 API 和静态服务）：
```yaml
- type: web
  name: moodmix-frontend
  buildCommand: npm install && npm run build
  startCommand: npm run serve-prod
```

## 部署步骤

### 第一次部署

1. **更新 Render.com 连接**：
   - 确保你的 GitHub 仓库包含更新的 `render.yaml`、`.env` 和新的 `server/prodServer.js`
   - 推送所有更改

2. **在 Render.com 上配置环境变量**：
   - 访问你的 Render 仪表板
   - 找到 `moodmix-frontend` Web 服务
   - 设置环境变量：
     - `SILICONFLOW_API_KEY`: 你的实际 API Key
     - `SILICONFLOW_MODEL`: `Qwen/Qwen2.5-72B-Instruct`（或其他型号）
     - `NODE_ENV`: `production`
     - `PORT`: `3000`

3. **触发部署**：
   - 推送代码更改时，Render 会自动重新部署
   - 或在 Render 仪表板手动触发部署

4. **验证部署**：
   - 访问你的 Render URL（例如 `https://moodmix-brve.onrender.com`）
   - 应该看到 MoodMix 应用加载，而不是"Invalid Host header"

### 本地开发

#### 方式 1：运行开发服务器（推荐用于开发）
```bash
# 启动 React 开发服务器（带热重载）
npm start

# 在另一个终端启动 API 代理（可选，用于测试 API 调用）
npm run server
```

#### 方式 2：运行生产构建（测试生产环境）
```bash
# 构建优化版本
npm run build

# 启动生产服务器（与 Render 环境相同）
npm run serve-prod

# 访问 http://localhost:3000
```

## 常见问题解决

### Q1: 仍然看到 "Invalid Host header"

**原因**：环境变量设置不正确或 `.env` 文件没有被加载

**解决**：
1. 检查 `.env` 文件是否存在于项目根目录
2. 在 Render 仪表板中验证环境变量
3. 清除 Render 缓存并重新部署

### Q2: API 调用返回错误 (HTTP 500)

**原因**：API Key 未设置或无效

**解决**：
1. 在 Render 仪表板验证 `SILICONFLOW_API_KEY` 环境变量
2. 确保 API Key 有效（访问 https://docs.siliconflow.cn/）
3. 查看 Render 日志排查详细错误

### Q3: 前端无法加载资源（CSS、JS）

**原因**：`PUBLIC_URL` 配置不正确或静态文件服务有问题

**解决**：
1. 确保 `npm run build` 成功完成（check `./build` 文件夹）
2. 验证 `prodServer.js` 中的静态文件路径
3. 清除浏览器缓存

### Q4: 想使用不同的 LLM 模型

**解决**：
1. 在 `.env` 中更改 `SILICONFLOW_MODEL` 变量
2. 或在 Render 仪表板上更改 `SILICONFLOW_MODEL` 环境变量
3. 重新部署

## 本地运行的快速参考

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npm start

# 生产构建
npm run build

# 运行生产版本（本地测试）
npm run serve-prod

# 运行 API 代理服务器
npm run server
```

## 架构现状

### 开发环境
```
用户 → Webpack 开发服务器 (localhost:3000)
      ↓
      React 应用 + 热重载
      ↓
      API 调用 → API 代理服务器 (localhost:3001)
      ↓
      SiliconFlow LLM API
```

### 生产环境 (Render.com)
```
用户 → Express 服务器 (Render URL)
      ↓
      1. 静态文件服务 (React 构建)
      2. SPA 路由处理
      ↓
      API 调用 → /api/analyze_mood
      ↓
      SiliconFlow LLM API
```

## 总结

- ✅ 移除了 Webpack 开发服务器从生产环境
- ✅ 添加了生产专用的 Express 服务器
- ✅ 简化了 Render.com 配置（单个 Web 服务）
- ✅ 保留了本地开发的灵活性
- ✅ 集成了前端和 API 代理到一个服务中

你现在应该能够在 Render.com 上成功部署 MoodMix！🎉

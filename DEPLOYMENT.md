# 部署指南

## 部署流程

### 1. 本地构建前端

在本地运行构建命令：

```bash
npm run build
```

这会生成 `build/` 文件夹，包含优化后的静态文件。

### 2. 提交代码

```bash
git add .
git commit -m "更新构建文件"
git push
```

**重要**：确保 `build/` 文件夹被提交到 Git 仓库。

### 3. Render 自动部署

推送代码后，Render 会自动：
- 安装依赖（`npm install`）
- 启动生产服务器（`npm run serve-prod`）

## 为什么这样做？

- **内存优化**：Render 只需运行后端服务器，内存消耗 <100MB
- **稳定性**：避免在 512MB RAM 环境中构建导致内存溢出
- **速度快**：部署时间从几分钟缩短到几十秒

## 代码更新流程

每次修改代码后：

```bash
# 1. 本地构建
npm run build

# 2. 提交并推送
git add build/ src/ server/ package.json
git commit -m "更新"
git push
```

## 注意事项

- 不要修改 `build/` 文件夹的内容
- 确保 `.env` 中的 API Key 已在 Render 环境变量中配置
- `build/` 文件夹已包含在 Git 仓库中（未在 .gitignore 中）

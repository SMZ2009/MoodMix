# MoodMix | 心绪调饮

> AI 驱动的情绪化饮品推荐引擎，融合东方哲学与现代调酒艺术

## 简介

MoodMix 是一款基于**多智能体协作 (MAS)** 与 **中医辨证哲学** 的 AI 特调引擎。通过分析用户的主观情绪，将模糊的心境映射为高维风味空间中的精准坐标，推荐最适合此刻的饮品。

## 核心特性

- **情绪智能解析** - 基于中医五行理论，理解身心状态与情绪需求
- **8维向量匹配** - 将饮品抽象为味觉、温度、五行、时辰等8个维度，精准匹配心境
- **多智能体协作** - 4个专业 Agent 分工协作：聚合分析、创意文案、质量验证、调饮指导
- **语音输入** - 支持语音识别，说出你的心情
- **分享卡片** - 生成东方美学风格的分享卡片，记录每一次心绪与饮品的相遇
- **库存管理** - 管理你的原料库存，获取可制作的饮品推荐

## 技术栈

- **前端**: React 19 + Tailwind CSS
- **后端**: Node.js + Express + Socket.io
- **AI 模型**: Qwen2.5 (7B/32B) via SiliconFlow API
- **图像处理**: html2canvas
- **语音识别**: Web Speech API

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env` 文件：

```env
SILICONFLOW_API_KEY=your_api_key
SILICONFLOW_MODEL_CORE=Qwen/Qwen2.5-7B-Instruct
SILICONFLOW_MODEL_CREATIVE=Qwen/Qwen2.5-32B-Instruct
```

### 启动开发服务器

```bash
# 终端 1: 启动前端
npm start

# 终端 2: 启动后端代理
npm run server
```

### 生产构建

```bash
npm run build
npm run serve-prod
```

## 项目结构

```
src/
├── agents/              # 多智能体系统
│   ├── core/            # 核心框架 (Context, Orchestrator, BaseAgent)
│   └── specialized/     # 专业智能体
├── api/                 # API 接口层
├── components/          # React 组件
├── engine/              # 核心引擎 (向量搜索、实体提取、五行映射)
├── hooks/               # 自定义 Hooks
├── store/               # 本地存储管理
└── utils/               # 工具函数

server/
└── llmProxy.js          # LLM API 代理层
```

## 智能体架构

| 智能体 | 职责 | 模型 |
|--------|------|------|
| ComprehensiveAnalyzer | 全链路聚合分析 | 32B |
| CreativeCopywriter | 意境文案生成 | 32B |
| ValidatorOptimizer | 质量验证与优化 | 7B |
| MixologyExpert | 调饮指导 | 7B |

## 饮品维度系统

每款饮品被映射为 8 个数值维度：

| 维度 | 说明 | 范围 |
|------|------|------|
| Taste | 主味强度 | 0-10 |
| Texture | 气机感 | -3~3 |
| Temperature | 阴阳属性 | -5~5 |
| Element | 五行坐标 | 1-5 |
| Time | 最佳时辰 | 0-23 |
| Aroma | 香气穿透力 | 0-10 |
| ABV | 酒精百分比 | 0-95 |
| Action | 场景指数 | 1-5 |

## 许可证

MIT

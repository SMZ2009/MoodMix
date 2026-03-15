# MoodMix 多智能体驱动架构 (Multi-Agent Architecture)

## 1. 核心架构概述 (Architectural Principles)

MoodMix 是一款基于 **多代理协作 (MAS)** 与 **TCM 辨证哲学** 的 AI 特调引擎。项目核心旨在将人类模糊的主观情感，通过多级 Agent 蒸馏与逻辑重构，映射为高维物理风味空间中的精准坐标。

### 技术选型原则

- **高吞吐核心**: 基础处理链路采用 7B 级模型 (`Qwen/Qwen2.5-7B-Instruct`) 实现毫秒级响应。
- **高品质内容**: 创意与诗意文案路由至 32B 级模型 (`Qwen/Qwen2.5-32B-Instruct`) 以确保输出质量。
- **关注点分离 (SoC)**: 每个 Agent 仅负责单一认知领域，通过统一的 `AgentContext` 互操作。

### 模型配置 (`.env`)

```bash
SILICONFLOW_MODEL_CORE=Qwen/Qwen2.5-7B-Instruct      # 核心推理 (语义/辨证/向量)
SILICONFLOW_MODEL_CREATIVE=Qwen/Qwen2.5-32B-Instruct # 创意文案 (诗意/卡片)
SILICONFLOW_MODEL_8B=Qwen/Qwen2.5-7B-Instruct        # 通用任务
SILICONFLOW_MODEL_30B=Qwen/Qwen2.5-32B-Instruct      # 复杂任务
```

---

## 2. 智能体分工与模型矩阵 (Agent Matrix)

| 智能体 | 职责角色 | 驱动模型 | 后端端点 | 核心任务 |
| :--- | :--- | :--- | :--- | :--- |
| **ComprehensiveAnalyzer** | 全链路聚合分析师 | `MODEL_CREATIVE` (32B) | `/api/comprehensive_analyze` | 一次请求完成：六维语义提取 + 中医辨证 + 八维向量翻译 |
| **CreativeCopywriter** | 意境文案师 | `MODEL_CREATIVE` (32B) | `/api/generate_quotes`<br>`/api/social-card-copy` | 生成三段式感性推荐语、分享卡片诗意文案 |
| **ValidatorOptimizer** | 质量质检员 | `MODEL_8B` (7B) | `/api/validate_optimize` | 审查五行生克、时段温度、情绪酒精安全，授予质量勋章 |
| **MixologyExpert** | 调饮专家 | `MODEL_8B` (7B) | `/api/generate-drink-dimensions`<br>`/api/drink-assistant` | 自定义饮品维度分析、制作指导 |

---

## 3. 智能体详细说明

### 3.1 ComprehensiveAnalyzer (全链路聚合分析师)

**文件位置**: `src/agents/specialized/ComprehensiveAnalyzer.js`

**设计目标**: 性能优化核心 —— 将原本需要 3 次 API 调用的串行流程压缩为 1 次，减少 60%+ 的网络往返延迟。

**驱动模型**: `MODEL_CREATIVE` (`Qwen/Qwen2.5-32B-Instruct`) — 聚合推理逻辑复杂，需要大参数量模型保证准确率。

**调用端点**: `POST /api/comprehensive_analyze`

**输入**:
```json
{
  "user_input": "今天有点累，想来点放松的",
  "current_time": "2026-03-15T20:30:00Z"
}
```

**输出结构** (一次性返回三大模块):
```json
{
  "moodData": {
    "emotion": { "physical": { "state": "疲惫", "intensity": 0.7 }, "philosophy": { "wuxing": "土" } },
    "somatic": { "philosophy": { "direction": "下沉", "yinyang": "偏阴" } },
    "demand": { "philosophy": { "type": "止" } },
    "isNegative": false,
    "summary": "身心疲惫，渴望安宁"
  },
  "patternAnalysis": {
    "polarity": { "type": "mixed", "confidence": 0.8 },
    "wuxing": { "user": "earth", "scores": { "wood": 0.1, "fire": 0.1, "earth": 0.5, "metal": 0.2, "water": 0.1 } },
    "strategy": { "type": "harmonize", "logic": "土气过盛需柔和调理，不宜激烈对冲" },
    "diagnosis": { "summary": "脾土郁滞，宜温润化解" }
  },
  "vectorResult": {
    "targetVector": [5, -1, 1, 3, 20, 6, 15, 2],
    "weights": [0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1],
    "priorities": ["temperature", "aroma", "ratio"]
  }
}
```

**上下文映射**: 将结果透明分发到 `AgentContext`，模拟原有级联产出：
- `context.setIntermediate('moodData', ...)` — 供向量搜索使用
- `context.setIntermediate('patternAnalysis', ...)` — 供验证器使用
- `context.setIntermediate('vectorResult', ...)` — 供匹配引擎使用

---

### 3.2 CreativeCopywriter (意境文案师)

**文件位置**: `src/agents/specialized/CreativeCopywriter.js`

**设计目标**: 生成具有东方诗意、克制感的情绪文案，结合饮品感官细节回应用户心境。

**驱动模型**: `MODEL_CREATIVE` (`Qwen/Qwen2.5-32B-Instruct`) — 文案生成需要高品质语言理解能力。

**工作模式**:

#### 模式 1: 推荐文案生成 (`/api/generate_quotes`)

为匹配的饮品批量生成三段式推荐语：`[当前状态] + [饮品特征] + [调理动作]`

**Prompt 核心约束**:
- 长度：25-45 字
- 风格：口语化叙事，严禁四字词语堆砌
- 结构：必须包含状态描述 + 具体特征 + 调理目的

**示例输出**:
```
「因为最近总是觉得心里闷闷的，这杯带有辛香的金酒正好能帮你把那股气散开，让整个人都通透不少」
```

#### 模式 2: 分享卡片文案 (`/api/social-card-copy`)

为社交分享卡片生成诗意短文案。

**调用端点**: `POST /api/social-card-copy`

**Prompt 要求**:
- 风格：东方韵味、极简、有温度、像耳边的低语
- 长度：2-3 句话，30-50 字
- 禁止：鸡汤、口号、感叹号、四字词语堆砌

**输入**:
```json
{
  "drink": { "name": "Mojito", "dimensions": { "wuxing": "木" } },
  "prompt": "饮品名：Mojito\n用户情绪：轻松愉悦\n五行属性：木"
}
```

**降级策略**: API 失败时返回默认文案 `"岁序更迭，此情可待。在这个瞬间，找到属于你的宁静。"`

---

### 3.3 ValidatorOptimizer (质量质检员)

**文件位置**: `src/agents/specialized/ValidatorOptimizer.js`

**设计目标**: 全流程质量守门员 —— 确保推荐结果的逻辑一致性、安全性，并授予可视化质量勋章。

**驱动模型**: `MODEL_8B` (`Qwen/Qwen2.5-7B-Instruct`) — 规则验证逻辑相对固定，7B 模型即可胜任。

**调用端点**: `POST /api/validate_optimize`

**验证维度** (共 8 项检查):

| 检查项 | 说明 | 严重程度 |
| :--- | :--- | :--- |
| 一致性验证 | 情绪极性与策略是否匹配（负面情绪不应用共鸣策略） | Medium |
| 冲突检测 | 高温 + 高烈度组合是否过于刺激 | Low |
| 五行生克验证 | 推荐酒五行是否克用户五行 | Medium |
| 时段温度合理性 | 深夜推荐冰饮、早晨推荐高酒精度 | Low-Medium |
| 情绪酒精安全性 | 极度负面情绪下推荐高酒精度（>40%）会被阻断 | Critical |
| 向量范围验证 | 8 维向量是否在有效区间内 | Error |
| 权重归一化验证 | 权重之和是否为 1.0 | Error |
| 原料可行性计算 | 用户库存能制作多少推荐饮品 | Info |

**质量评分算法** (加权多维度):
```javascript
weights = {
  consistency: 0.25,   // 一致性
  relevance: 0.30,     // 情绪匹配度
  feasibility: 0.20,   // 原料可行性
  safety: 0.15,        // 安全性
  creativity: 0.10     // 文案质量
}
```

**质量勋章** (UI 展示):
| 评分 | 等级 | 勋章文案 |
| :--- | :--- | :--- |
| ≥80 | excellent | 心味相合 |
| 60-79 | good | 恰有灵犀 |
| 40-59 | acceptable | 随缘入味 |
| <40 | poor | 缘来一试 |

**降级策略**: AI 验证失败时，自动回退到本地规则引擎 (`processLocal`)，确保验证流程不中断。

---

### 3.4 MixologyExpert (调饮专家)

**文件位置**: `src/agents/specialized/MixologyExpert.js`

**设计目标**: 专业调酒顾问 —— 支持自定义饮品分析和制作过程中的即时问答。

**驱动模型**: `MODEL_8B` (`Qwen/Qwen2.5-7B-Instruct`)

**工作模式**:

#### 模式 1: ANALYZE (自定义饮品维度生成)

**调用端点**: `POST /api/generate-drink-dimensions`

**输入**:
```json
{
  "name": "自制柠檬茶",
  "description": "清爽解渴",
  "ingredients": ["柠檬", "红茶", "蜂蜜"],
  "isAlcoholic": false
}
```

**输出**:
```json
{
  "vector": [4, 1, -2, 1, 14, 6, 0, 3],
  "dimensions": {
    "sweetness": { "value": 4, "label": "微甜" },
    "sourness": { "value": 6, "label": "明显" },
    "temperature": { "value": -2, "label": "冰凉" }
  },
  "reasoning": "柠檬带来酸爽，红茶提供茶香底蕴，蜂蜜平衡酸度"
}
```

#### 模式 2: ASSIST (制作指导)

**调用端点**: `POST /api/drink-assistant`

**输入**:
```json
{
  "drink": { "name": "Mojito", "ingredients": [...] },
  "question": "没有新鲜薄荷叶怎么办？",
  "userInventory": ["干薄荷", "青柠"]
}
```

**输出**: 简洁实用的替代建议（≤150 字）

---

## 4. 核心执行工作流 (Workflow)

### 4.1 主推荐流程 (executeRecommendationPipeline)

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: 实体提取与候选池筛选 (Local, <50ms)                  │
│  - extractEntities() 提取饮品名、品类、风味关键词              │
│  - filterDrinkPool() 缩小候选池 (500+ → 50-100)              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: 全链路聚合分析 (API, 3-8s)                          │
│  - ComprehensiveAnalyzer 调用 /api/comprehensive_analyze    │
│  - 一次请求完成：语义提取 + 辨证分析 + 向量翻译               │
│  - 模型: Qwen2.5-32B-Instruct                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 向量语义搜索 (Local, <100ms)                        │
│  - evaluateAndSortDrinks() 加权余弦相似度计算                │
│  - 返回 Top 9 匹配饮品                                       │
│  >>> 首屏渲染完成，用户可见推荐结果 <<<                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (异步，不阻塞 UI)
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: 异步后置优化                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 4a. CreativeCopywriter 生成个性化推荐语               │    │
│  │     模型: Qwen2.5-32B-Instruct                       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 4b. ValidatorOptimizer 质量验证                      │    │
│  │     模型: Qwen2.5-7B-Instruct                        │    │
│  │     完成后动态点亮质量勋章                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 分享卡片生成流程

```
用户点击分享/打卡
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CreativeCopywriter.fetchSocialCardCopy()                 │
│    - 调用 /api/social-card-copy                             │
│    - 模型: Qwen2.5-32B-Instruct                             │
│    - 生成诗意文案 (30-50字)                                  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ShareCard 组件渲染 (DOM)                                  │
│    - 品牌栏 + 图片 + 饮品名 + 情绪标签 + 文案 + 二维码         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. html2canvas 截图导出 (scale: 2x)                          │
│    - 二维码嵌入卡片内部一起截图                               │
│    - 移动端优先调用 navigator.share API                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 目录职能划分 (Directory Concerns)

```
src/
├── agents/
│   ├── core/
│   │   ├── AgentContext.js       # Agent 间数据共享上下文
│   │   ├── AgentOrchestrator.js  # 工作流编排器
│   │   └── BaseAgent.js          # Agent 基类 (超时/重试/日志)
│   └── specialized/
│       ├── ComprehensiveAnalyzer.js  # 聚合分析师
│       ├── CreativeCopywriter.js     # 文案师
│       ├── ValidatorOptimizer.js     # 质检员
│       └── MixologyExpert.js         # 调饮专家
├── engine/
│   ├── vectorEngine.js           # 8D 向量搜索引擎
│   ├── entityExtractor.js        # 实体提取 (饮品名/品类/风味)
│   ├── poolFilter.js             # 候选池过滤
│   ├── wuxingMapper.js           # 五行生克计算
│   └── philosophyTags.js         # 哲学标签生成
└── store/
    └── localStorageAdapter.js    # 持久化 (收藏/打卡记录/库存)

server/
└── llmProxy.js                   # API 代理层 (模型路由/Key 隔离)
```

---

## 6. 饮品维度说明 (8-Dimension Vector)

饮品在系统中被抽象为以下 8 个数值维度：

| 索引 | 维度名 | 范围 | 说明 |
| :---: | :--- | :--- | :--- |
| 0 | Taste | 0-10 | 主味强度（酸甜苦辛综合） |
| 1 | Texture | -3~3 | 气机感（-3 下沉/静谧，3 上扬/灵动） |
| 2 | Temperature | -5~5 | 阴阳属性（-5 极冰，0 常温，5 极热） |
| 3 | Element | 1-5 | 五行映射坐标（1木 2火 3土 4金 5水） |
| 4 | Time | 0-23 | 最佳适饮时辰映射（小时） |
| 5 | Aroma | 0-10 | 香气穿透力 |
| 6 | ABV | 0-95 | 酒精百分比 |
| 7 | Action | 1-5 | 场景指数（1专注 2放松 3社交 4独处 5庆祝） |

---

## 7. API 端点汇总

| 端点 | 方法 | 模型 | 用途 |
| :--- | :--- | :--- | :--- |
| `/api/comprehensive_analyze` | POST | 32B | 全链路聚合分析（语义+辨证+向量） |
| `/api/analyze_mood` | POST | 7B | 单独情绪分析（已被聚合接口替代） |
| `/api/analyze_mood_stream` | POST | 7B | 流式情绪分析 (SSE) |
| `/api/generate_quotes` | POST | 32B | 批量推荐文案生成 |
| `/api/social-card-copy` | POST | 32B | 分享卡片诗意文案 |
| `/api/validate_optimize` | POST | 7B | 全流程质量验证 |
| `/api/generate-drink-dimensions` | POST | 7B | 自定义饮品维度分析 |
| `/api/drink-assistant` | POST | 7B | 制作问答助手 |
| `/api/pattern_analyze` | POST | 7B | 单独辨证分析（已被聚合接口替代） |
| `/api/vector_translate` | POST | 7B | 单独向量翻译（已被聚合接口替代） |

---

## 8. 开发与演进计划

- [x] 多智能体框架搭建 (MAS Core)
- [x] 聚合分析端点优化 (Compression) — 3 合 1 减少 60% RTT
- [x] 东方美学分享卡片重构 (DOM-to-Image with html2canvas)
- [x] 实体提取与候选池预筛选 (Entity Extraction + Pool Filter)
- [x] 异步后置优化架构 (Async Post-Processing)
- [ ] 离线 RAG 辅助配方搜索
- [ ] 个人专属 AI 调酒师模型微调 (LoRA)
- [ ] 多轮对话式情绪探索

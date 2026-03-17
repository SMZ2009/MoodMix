# MoodMix 多智能体驱动架构 (Multi-Agent Architecture)

## 1. 核心架构概述

MoodMix 是一款基于 **多智能体协作 (MAS)** 与 **TCM 辨证哲学** 的 AI 特调推荐引擎。系统将用户模糊的主观情绪描述，通过多级 Agent 级联蒸馏、中医辨证推理与向量语义搜索，映射到 8 维饮品风味空间中进行精准匹配。

### 1.1 技术选型原则

- **高吞吐核心**: 主推荐链路（聚合分析、辨证、向量翻译、验证）采用 7B 级模型，确保低延迟响应。
- **高品质内容**: 创意文案、流式辨证等需要高语言质量的场景路由到 32B 级模型。
- **关注点分离**: 每个 Agent 只负责单一认知领域，通过统一的 `AgentContext` 共享中间数据。
- **渐进式渲染**: 核心推荐结果先返回，文案生成和质量验证异步执行、不阻塞 UI。

### 1.2 模型配置

后端代理 (`server/llmProxy.js`) 从 `.env` 读取模型配置，所有 API Key 不暴露到前端。

```
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_MODEL_8B=Qwen/Qwen2.5-7B-Instruct       # 轻量任务
SILICONFLOW_MODEL_30B=Qwen/Qwen2.5-32B-Instruct      # 高品质任务
SILICONFLOW_MODEL_CORE=<默认同 MODEL_8B>              # 核心推理链路
SILICONFLOW_MODEL_CREATIVE=<默认同 MODEL_30B>         # 创意与流式推理
```

实际模型路由关系（代码实现）：

| 变量名 | 默认值 | 用途 |
| :--- | :--- | :--- |
| `MODEL_CORE` | `Qwen/Qwen2.5-7B-Instruct` | 聚合分析、辨证、向量翻译 |
| `MODEL_CREATIVE` | `Qwen/Qwen2.5-32B-Instruct` | 流式分析、推荐文案、社交卡片文案 |
| `MODEL_8B` | `Qwen/Qwen2.5-7B-Instruct` | 质量验证、制作助手 |

---

## 2. 智能体总览 (Agent Matrix)

系统包含 **4 个专用 Agent**，分为「核心推理链」和「辅助功能」两组：

### 核心推理链 (主推荐流程使用)

| Agent | 角色 | 驱动模型 | 后端端点 | 核心职责 |
| :--- | :--- | :--- | :--- | :--- |
| **ComprehensiveAnalyzer** | 全链路聚合分析师 | `MODEL_CORE` (7B) | `/api/comprehensive_analyze` | 一次请求完成：六维语义提取 + 中医辨证 + 八维向量翻译 |
| **CreativeCopywriter** | 意境文案师 | `MODEL_CREATIVE` (32B) / 本地 | `/api/generate_quotes`、`/api/social-card-copy`、`/api/social-card-no-mood` | 推荐文案、分享卡片诗意文案、无情绪场景文案 |
| **ValidatorOptimizer** | 质量质检员 | `MODEL_8B` (7B) / 本地 | `/api/validate_optimize` | 审查五行生克、时段温度、情绪酒精安全，授予质量勋章 |

### 独立功能 Agent

| Agent | 角色 | 驱动模型 | 后端端点 | 核心职责 |
| :--- | :--- | :--- | :--- | :--- |
| **MixologyExpert** | 调饮专家 | `MODEL_8B` (7B) | `/api/generate-drink-dimensions`、`/api/drink-assistant` | 自定义饮品维度分析、制作过程即时问答 |

### 遗留端点（保留为独立 API 工具）

这些端点仍然有用，但**不再通过前端 Agent 类调用**，而是作为独立的后端工具存在：

| 端点 | 模型 | 当前用途 |
| :--- | :--- | :--- |
| `/api/analyze_mood_stream` | `MODEL_CREATIVE` (32B) | SSE 流式六维语义蒸馏，直接由 `StreamingAnalysisCard` 调用 |
| `/api/pattern_analyze` | `MODEL_CORE` (7B) | 独立辨证分析调试接口（可用于运维/研究） |
| `/api/vector_translate` | `MODEL_CORE` (7B) | 独立 8D 向量翻译调试接口（可用于运维/研究） |

---

## 3. 智能体详细说明

### 3.1 ComprehensiveAnalyzer (全链路聚合分析师)

**文件**: `src/agents/specialized/ComprehensiveAnalyzer.js`

**设计目标**: 性能优化核心——将原本需要 SemanticDistiller → PatternAnalyzer → VectorTranslator 三次串行 API 调用压缩为一次，减少 60%+ 的网络往返延迟。

**驱动模型**: `MODEL_CORE` (`Qwen/Qwen2.5-7B-Instruct`)

> 注意：虽然聚合推理逻辑复杂，但实际代码 (`llmProxy.js:handleComprehensiveAnalyze`) 使用的是 `MODEL_CORE`。后端通过精心设计的 System Prompt (`buildComprehensiveSystemPrompt()`) 在 7B 模型上实现了三阶段推理（语义提取 → 辨证分析 → 向量翻译）。

**调用端点**: `POST /api/comprehensive_analyze`

**超时**: 45,000ms（Agent 端），60,000ms（后端 `callLLM`）

**执行流程**:

1. 接收 `context.userInput` 和 `context.currentTime`
2. 调用后端 `/api/comprehensive_analyze`，后端将用户输入包装成三阶段 Prompt 发送给 LLM
3. LLM 一次性返回包含 `moodData`（六维语义）、`patternAnalysis`（辨证结论）、`vectorResult`（8D 向量 + 权重）的 JSON
4. 将三部分结果透明地写入 `AgentContext`：
   - `context.setIntermediate('moodData', ...)` → 供向量搜索引擎使用
   - `context.setIntermediate('patternAnalysis', ...)` → 供验证器和哲学标签使用
   - `context.setIntermediate('vectorResult', ...)` → 供匹配引擎使用

**输入**:
```json
{
  "user_input": "今天有点累，想来点放松的",
  "current_time": "2026-03-15T20:30:00Z"
}
```

**输出** (一次性返回三大模块):
```json
{
  "moodData": {
    "emotion": { "physical": { "state": "疲惫", "intensity": 0.7 }, "philosophy": { "wuxing": "土" }, "drinkMapping": { "tasteScore": 6, "colorCode": 3 } },
    "somatic": { "physical": { "sensation": "沉重", "intensity": 0.6 }, "philosophy": { "direction": "下沉", "yinyang": "偏阴" }, "drinkMapping": { "temperature": 0, "textureScore": 1 } },
    "time": { "physical": { "hour": 20, "period": "夜晚", "intensity": 0.5 }, "drinkMapping": { "temporality": 20 } },
    "cognitive": { "physical": { "state": "迟缓", "intensity": 0.5 }, "drinkMapping": { "aromaScore": 6 } },
    "demand": { "physical": { "state": "放松", "intensity": 0.7 }, "philosophy": { "type": "止" }, "drinkMapping": { "actionScore": 2 } },
    "socialContext": { "physical": { "state": "独处", "intensity": 0.5 }, "drinkMapping": { "ratioScore": 15 } }
  },
  "patternAnalysis": {
    "polarity": { "type": "mixed", "confidence": 0.8 },
    "wuxing": { "user": "earth" },
    "strategy": { "type": "harmonize", "logic": "土气过盛需柔和调理" }
  },
  "vectorResult": {
    "targetVector": [6, 1, 0, 3, 20, 6, 15, 2],
    "weights": [0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1],
    "priorities": ["temperature", "aroma", "ratio"]
  }
}
```

**输出验证**: `validateOutput` 检查 `moodData`、`patternAnalysis`、`vectorResult` 三者是否全部存在。

---

### 3.2 CreativeCopywriter (意境文案师)

**文件**: `src/agents/specialized/CreativeCopywriter.js`

**设计目标**: 生成具有东方诗意和克制感的情绪文案，结合饮品感官细节回应用户心境。支持三种工作模式。

**驱动模型**: `MODEL_CREATIVE` (`Qwen/Qwen2.5-32B-Instruct`) / 本地引擎

#### 模式 1: 推荐文案生成 (主推荐流程中使用)

在主推荐流程的异步阶段执行。`process()` 方法读取 `context.getIntermediate('matches')` 中的匹配饮品列表，调用本地 `generatePhilosophyTags()` 生成三枚哲学标签和推荐语，再组装解释和变体文案。

**不直接调用 LLM**，而是依赖本地 `philosophyTags.js` 引擎。

**间接 LLM 调用**: 外部模块 `quoteGenerator.js` 的 `fetchLiveQuotes()` 函数会批量调用 `/api/generate_quotes` (MODEL_CREATIVE, 32B) 为 Top 饮品生成 LLM 级个性化推荐语，覆盖本地模板。

`/api/generate_quotes` 的 Prompt 核心约束：
- 叙事架构: `[辨证失调状态] → [调和转化逻辑] → [饮品物理反馈]`
- 长度: 25-45 字，用「」包裹
- 禁止: 模式化开头（"因为..."、"看你..."）、四字词语堆砌、复读用户输入
- 同一批次 9 杯饮品必须呈现完全不同的切入视角

#### 模式 2: 社交卡片文案 (`SOCIAL_CARD` 任务类型)

**调用端点**: `POST /api/social-card-copy` → `MODEL_CREATIVE` (32B)

Prompt 要求：
- 风格: 东方韵味、极简、有温度、像耳边的低语
- 长度: 2-3 句话，30-50 字
- 禁止: 鸡汤、口号、感叹号、四字词语堆砌
- 内容: 结合饮品感官细节（色、味、温）和用户情绪心径

**降级文案**: `"岁序更迭，此情可待。在这个瞬间，找到属于你的宁静。"`

#### 模式 3: 无情绪场景卡片文案 (`SOCIAL_CARD_NO_MOOD` 任务类型)

**调用端点**: `POST /api/social-card-no-mood` → `MODEL_CREATIVE` (32B)

适用于用户未进行情绪输入、直接从收藏或浏览中分享饮品的场景。后端 LLM 仅基于饮品自身属性（名称、品类、ABV、风味原料）生成结构化 JSON：

```json
{
  "tagEmotion": "夜航微醺",
  "tagScene": "下班后小酌",
  "copy": "……30-50字文案……"
}
```

**降级文案**: `"这一杯，适合在你愿意停下来的时候慢慢喝完。"`

---

### 3.3 ValidatorOptimizer (质量质检员)

**文件**: `src/agents/specialized/ValidatorOptimizer.js`

**设计目标**: 全流程质量守门员——确保推荐结果的逻辑一致性、安全性，并授予可视化质量勋章。

**驱动模型**: `MODEL_8B` (`Qwen/Qwen2.5-7B-Instruct`) / 本地规则引擎

**调用端点**: `POST /api/validate_optimize`

**执行流程**:

1. 收集全链路上下文（moodData、patternAnalysis、vectorResult、matches Top5、creativeCopy）
2. 先尝试调用后端 `/api/validate_optimize`，由 LLM 进行全局审查
3. LLM 返回 `score`、`qualityLevel`、`issues`、`uiHints` 等
4. 存储结果: `context.setIntermediate('validationReport', report)`

**降级策略**: API 失败时，`processLocal()` 执行完整的本地规则引擎，包含 **8 项检查**：

| # | 检查项 | 具体做法 | 严重程度 |
| :---: | :--- | :--- | :--- |
| 1 | 一致性验证 | 负面情绪不应用共鸣策略；五行映射与向量推断是否一致 | Medium |
| 2 | 冲突检测 | 高温 (>3) + 高烈度 (>40) 组合过于刺激 | Low |
| 3 | 五行生克验证 | 推荐酒五行是否克用户五行（同时检测相生加分） | Medium |
| 4 | 时段温度合理性 | 深夜推冰饮、早晨推高酒精度 | Low-Medium |
| 5 | 情绪酒精安全性 | 极度负面 + 高酒精 (>40%) → 阻断推荐 | **Critical** |
| 6 | 向量范围验证 | 8 维向量是否在有效区间内，超出自动 clamp | Error |
| 7 | 权重归一化验证 | 权重之和是否为 1.0 (±0.01)，否则自动归一化 | Error |
| 8 | 原料可行性计算 | 用户库存能制作 Top9 中多少款饮品 (≥70% 原料匹配即算可行) | Info |

**质量评分算法** (五维加权):
```
weights = {
  consistency: 0.25,   // 一致性 (无 error/warning 则满分)
  relevance: 0.30,     // 情绪匹配度 (Top1 similarity × 100)
  feasibility: 0.20,   // 原料可行性
  safety: 0.15,        // 安全性 (无 critical/medium issue 则满分)
  creativity: 0.10     // 文案质量 (有 quote 则满分)
}
```

**质量勋章** (UI 展示):

| 评分 | 等级 | 勋章文案 |
| :--- | :--- | :--- |
| ≥80 | excellent | 心味相合 |
| 60-79 | good | 恰有灵犀 |
| 40-59 | acceptable | 随缘入味 |
| <40 | poor | 缘来一试 |

**阻断机制**: 当出现 `critical` 安全问题（极度负面情绪 + 高酒精度）时，`shouldBlock = true`，UI 显示「此缘或许未到，换一批再寻？」，阻止展示推荐。

---

### 3.4 MixologyExpert (调饮专家)

**文件**: `src/agents/specialized/MixologyExpert.js`

**设计目标**: 专业调酒顾问——支持自定义饮品分析和制作过程中的即时问答。

**驱动模型**: `MODEL_8B` (`Qwen/Qwen2.5-7B-Instruct`)

**超时**: 35,000ms，最多重试 2 次

#### 模式 1: ANALYZE (自定义饮品维度生成)

**调用端点**: `POST /api/generate-drink-dimensions`

用户添加自定义饮品时，传入名称、描述、原料、是否含酒精，Agent 返回 8D 风味向量和维度标签，使自定义饮品可以参与向量搜索匹配。

**降级策略**: 返回中性平衡向量 `[5, 0, 0, 3, 12, 5, 0, 2]` 并提示用户可手动微调。

#### 模式 2: ASSIST (制作指导)

**调用端点**: `POST /api/drink-assistant` → `MODEL_8B` (7B)

用户在制作某款饮品时遇到问题（原料缺失、口味调整、工具替代），传入饮品配方、用户问题和用户库存，Agent 返回简洁实用的建议（≤150 字）。

Prompt 设计要点：
- 优先推荐用户库存中已有的替代品
- 给出具体用量/比例建议
- 口语化、友好亲切的语气

---

## 4. Agent 基础设施

### 4.1 BaseAgent (基类)

**文件**: `src/agents/core/BaseAgent.js`

所有 Agent 继承自 `BaseAgent`，获得统一的生命周期管理：

```
validateInput(context) → process(context) → validateOutput(result)
```

**内置能力**:
- **超时控制**: `Promise.race` 实现，默认 10,000ms，可按 Agent 覆盖
- **错误恢复**: `handleError()` 钩子，子类可实现降级逻辑，返回 `recovered: true` 结果
- **结构化日志**: 按级别（START/SUCCESS/ERROR/VALIDATION_FAILED）输出带 emoji 前缀的日志

### 4.2 AgentContext (共享上下文)

**文件**: `src/agents/core/AgentContext.js`

Agent 间数据共享的核心容器：

| 存储区域 | 用途 | 典型 Key |
| :--- | :--- | :--- |
| `userInput` | 用户原始输入（经实体提取处理后的情绪部分） | — |
| `allDrinks` | 候选饮品池（经过 poolFilter 筛选） | — |
| `inventory` | 用户库存原料列表 | — |
| `intermediate` | Agent 中间输出（核心数据流转通道） | `moodData`, `patternAnalysis`, `vectorResult`, `matches`, `creativeCopy`, `validationReport`, `extractedEntities` |
| `outputs` | Agent 最终执行结果（含 success/duration/data） | 以 Agent 名为 Key |
| `executionTrace` | 完整执行轨迹（时间戳 + 操作 + 数据摘要） | — |

### 4.3 AgentOrchestrator (编排器)

**文件**: `src/agents/core/AgentOrchestrator.js`

负责 Agent 注册、工作流定义和顺序执行。当前前端仅使用标准执行模式：

| 模式 | 方法 | 用途 |
| :--- | :--- | :--- |
| 标准执行 | `execute(context)` | 主推荐流程，顺序执行 workflow 中定义的 Agent |

---

## 5. 核心执行工作流

### 5.1 主推荐流程 (`executeRecommendationPipeline`)

**文件**: `src/agents/core/AgentOrchestrator.js` → `executeRecommendationPipeline()`

```
用户输入 (如: "今天有点累，想来杯莫吉托放松一下")
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: 实体提取与候选池筛选 (本地, <50ms)                  │
│                                                             │
│  1. extractEntities(userInput)                              │
│     - 提取饮品名 (莫吉托 → mojito)                          │
│     - 提取品类 (鸡尾酒, 威士忌类...)                         │
│     - 提取风味 (薄荷, 柠檬...)                               │
│     - 分离情绪描述 ("今天有点累，想放松一下")                │
│                                                             │
│  2. filterDrinkPool(allDrinks, entities, options)           │
│     - 按实体匹配分数排序 (精确名100 > 品类30 > 风味15)      │
│     - 库存/时间场景轻量裁剪 (深夜过滤高咖啡因等)            │
│     - 500+ 款 → 10-40 款候选池                              │
│                                                             │
│  引擎: entityExtractor.js + poolFilter.js                   │
│  无 LLM 调用                                                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: 全链路聚合分析 (API, 3-8s)                          │
│                                                             │
│  ComprehensiveAnalyzer 调用 /api/comprehensive_analyze      │
│  一次请求完成:                                               │
│    ① 六维语义提取 (emotion/somatic/time/cognitive/demand/   │
│       socialContext)                                         │
│    ② 中医辨证 (polarity + wuxing + strategy + diagnosis)    │
│    ③ 八维向量翻译 (targetVector + weights + priorities)     │
│                                                             │
│  模型: MODEL_CORE (Qwen2.5-7B-Instruct)                    │
│  max_tokens: 1200, temperature: 0.5                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 向量语义搜索 (本地, <100ms)                         │
│                                                             │
│  evaluateAndSortDrinks(moodData, filteredDrinks, inventory) │
│    ① computeDynamicWeights(moodData)                        │
│       → 基于 κ 敏感度系数 × 维度 intensity 计算 8D 权重     │
│    ② buildUserVector(moodData)                              │
│       → 从六维 drinkMapping 字段提取 8D 用户需求向量         │
│    ③ weightedCosineSimilarity(userVector, drinkVector, W)   │
│       → 加权余弦相似度 (含时序环形距离、温度差值转换)       │
│    ④ 库存齐备加分 (0缺: +0.15, 1缺: +0.08, 2缺: +0.03)   │
│    ⑤ 全局降序排序 → Top 9                                  │
│                                                             │
│  >>> 首屏渲染完成，用户可见推荐结果 <<<                       │
│                                                             │
│  引擎: vectorEngine.js                                      │
│  无 LLM 调用                                                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (异步，不阻塞 UI)
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: 异步后置优化                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 4a. CreativeCopywriter 生成哲学标签 + 本地推荐语     │    │
│  │     → generatePhilosophyTags() (本地, 无 LLM)       │    │
│  │     → 三枚标签: [辨证, 策略, 体感]                   │    │
│  │                                                     │    │
│  │ 4a'. fetchLiveQuotes() 异步请求 LLM 推荐语          │    │
│  │      → /api/generate_quotes                          │    │
│  │      → MODEL_CREATIVE (Qwen2.5-32B-Instruct)        │    │
│  │      → 覆盖本地模板推荐语                            │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 4b. ValidatorOptimizer 质量验证                      │    │
│  │     → /api/validate_optimize (7B) 或本地规则引擎     │    │
│  │     → 完成后通过回调动态更新 UI 质量勋章              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 分享卡片生成流程

```
用户点击分享/打卡
    │
    ├─── 有情绪分析结果 (SOCIAL_CARD)
    │         │
    │         ▼
    │    CreativeCopywriter.fetchSocialCardCopy()
    │    → /api/social-card-copy → MODEL_CREATIVE (32B)
    │    → 生成诗意文案 (30-50字)
    │
    └─── 无情绪输入 (SOCIAL_CARD_NO_MOOD)
              │
              ▼
         CreativeCopywriter.fetchSocialCardNoMood()
         → /api/social-card-no-mood → MODEL_CREATIVE (32B)
         → 生成 { tagEmotion, tagScene, copy } 结构化结果
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ShareCard 组件渲染 (DOM)                                     │
│   品牌栏 + 图片 + 饮品名 + 情绪/场景标签 + 文案 + 二维码     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ html2canvas 截图导出 (scale: 2x)                             │
│   移动端优先调用 navigator.share API                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 独立任务流程 (`executeMixologyTask`)

**文件**: `src/agents/index.js` → `executeMixologyTask(taskType, data)`

通用的独立 Agent 任务入口，创建临时 `AgentContext`，按 `taskType` 路由到对应 Agent：

| taskType | 路由 Agent | 说明 |
| :--- | :--- | :--- |
| `ANALYZE` | MixologyExpert | 自定义饮品维度分析 |
| `ASSIST` | MixologyExpert | 制作问答助手 |
| `SOCIAL_CARD` | CreativeCopywriter | 有情绪输入的分享文案 |
| `SOCIAL_CARD_NO_MOOD` | CreativeCopywriter | 无情绪输入的分享文案 |

---

## 6. 本地引擎层

本地引擎层不调用任何 LLM，全部在浏览器端运行，是系统低延迟响应的关键。

### 6.1 entityExtractor.js (实体提取器)

从用户输入中提取三类实体：

| 实体类型 | 词库规模 | 权重 | 示例 |
| :--- | :--- | :--- | :--- |
| 饮品名 | 30+ 款 (含中英文别名) | 0.5 | 莫吉托, Margarita, 长岛冰茶 |
| 品类 | 17 类 | 0.3 | 威士忌, 鸡尾酒, 无酒精, 清酒 |
| 风味/原料 | 22 种 | 0.2 | 抹茶, 柑橘, 薄荷, 焦糖 |

匹配后将已识别的实体词从输入中移除，剩余部分作为「纯情绪描述」传递给 LLM 分析。

### 6.2 poolFilter.js (候选池过滤器)

基于提取到的实体对全量饮品池做预筛选：

- **精确名匹配**: 100 分
- **品类匹配**: 25-30 分（支持特殊逻辑：mocktail 检查 ABV=0、特定基酒检查原料）
- **风味匹配**: 12-20 分（原料 > 描述 > 标签）
- **库存裁剪**: 烈酒 + 用户库存重叠 <15% → 在满足 minPoolSize 前提下裁掉
- **时间裁剪**: 深夜过滤高咖啡因饮品，清晨过滤高度数烈酒
- **回退策略**: 过滤结果不足时自动放宽匹配条件，最终兜底返回全量池

### 6.3 vectorEngine.js (向量搜索引擎)

核心匹配算法，计算用户需求向量与饮品向量的加权余弦相似度：

- **动态权重**: 基于敏感度系数 κ × 各维度 intensity 动态调整 8 个维度的权重
- **特殊维度处理**: 时序维度使用环形距离 (0-23 小时循环)；温度和质地使用差值反转
- **库存加分**: 原料齐备度对分数有梯度加成
- **输出**: Top 9 饮品（含 similarityScore、missingCount、missingItems、isReadyToMake）

### 6.4 philosophyTags.js (哲学标签生成器)

为每杯推荐饮品生成三枚东方哲学标签，讲述「辨证施饮」故事链：

| 标签 | 含义 | 生成逻辑 | 示例 |
| :--- | :--- | :--- | :--- |
| Tag 1 (辨证) | 你现在怎么了 | intensity 最高维度 × 极性 → 状态描述词 | 「郁气难舒」 |
| Tag 2 (策略) | 需要什么调理 | 用户五行 × 饮品五行 → 生克关系短语 | 「以金制衡」 |
| Tag 3 (体感) | 喝起来什么感觉 | 温度 × 质地 → 体感矩阵查找 + 味觉修饰 | 「清冽·沉降」 |

三枚标签连读示例：「心绪浮躁」→「以水沉降」→「清冽·安神」

同时生成本地推荐语（当 LLM 不可用时的降级文案），模板结构为「{状态描述} + {饮品特征} + {调理动作}」。

### 6.5 wuxingMapper.js (五行映射器)

根据饮品物理维度确定其五行归属，供哲学标签系统使用。

### 6.6 groupRecommendationEngine.js (圈子推荐引擎)

根据饮品属性（ABV、味觉、温度、哲学标签）与 10 个预设圈子的匹配规则计算匹配度百分比，推荐 Top 3 匹配度 ≥40% 的圈子。

---

## 7. 后端代理层

**文件**: `server/llmProxy.js`

Node.js (Express) 服务，职责：

1. **API Key 隔离**: 从 `.env` 读取 `SILICONFLOW_API_KEY`，不暴露到前端
2. **统一 LLM 调用**: `callLLM()` 封装重试 (maxRetries=2)、超时 (AbortController)、JSON 解析（自动处理 markdown 代码块）
3. **请求限流**: 每 IP 每分钟最多 60 个请求
4. **CocktailDB 代理**: 透传 TheCocktailDB API 请求，附带图片代理和缓存头
5. **Socket.IO 实时通信**: 饮品「心意」点赞的实时广播

---

## 8. API 端点汇总

| 端点 | 方法 | 模型 | 用途 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| `/api/comprehensive_analyze` | POST | MODEL_CORE (7B) | 全链路聚合分析 (语义+辨证+向量) | **主用** |
| `/api/analyze_mood_stream` | POST | MODEL_CREATIVE (32B) | 流式六维语义蒸馏 (SSE) | 逐步回调模式 |
| `/api/analyze_mood` | POST | MODEL_CORE (7B) | 单次情绪分析 (非流式) | 备用 |
| `/api/pattern_analyze` | POST | MODEL_CORE (7B) | 单独辨证分析 | 逐步回调模式 |
| `/api/vector_translate` | POST | MODEL_CORE (7B) | 单独向量翻译 | 逐步回调模式 |
| `/api/generate_quotes` | POST | MODEL_CREATIVE (32B) | 批量推荐文案生成 (≤10条) | 异步增强 |
| `/api/social-card-copy` | POST | MODEL_CREATIVE (32B) | 分享卡片诗意文案 (有情绪输入) | 按需 |
| `/api/social-card-no-mood` | POST | MODEL_CREATIVE (32B) | 分享卡片文案 (无情绪输入) | 按需 |
| `/api/validate_optimize` | POST | MODEL_8B (7B) | 全流程质量验证 | 异步 |
| `/api/drink-assistant` | POST | MODEL_8B (7B) | 饮品制作问答助手 | 按需 |
| `/api/generate-drink-dimensions` | POST | — | 自定义饮品维度分析 | 按需 |
| `/api/cocktaildb/*` | ALL | — | TheCocktailDB API 代理 | 数据源 |
| `/api/cocktail-image/:name` | GET | — | 鸡尾酒图片代理 (带缓存) | 数据源 |
| `/api/drink/like` | POST | — | 饮品心意点赞 (Socket.IO 广播) | 社交 |
| `/api/drink/unlike` | POST | — | 取消心意 | 社交 |
| `/api/drink/like-stats/:id` | GET | — | 查询心意统计 | 社交 |
| `/health` | GET | — | 健康检查 | 运维 |

---

## 9. 目录职能划分

```
src/
├── agents/
│   ├── core/
│   │   ├── AgentContext.js          # Agent 间数据共享上下文
│   │   ├── AgentOrchestrator.js     # 工作流编排器 + executeRecommendationPipeline
│   │   └── BaseAgent.js             # Agent 基类 (超时/重试/日志/生命周期)
│   ├── specialized/
│   │   ├── ComprehensiveAnalyzer.js # [主用] 全链路聚合分析师 (7B)
│   │   ├── CreativeCopywriter.js    # 意境文案师 (32B / 本地)
│   │   ├── ValidatorOptimizer.js    # 质量质检员 (7B / 本地规则引擎)
│   │   └── MixologyExpert.js        # 调饮专家 (7B)
│   └── index.js                     # 统一导出 + executeMixologyTask()
├── engine/
│   ├── vectorEngine.js              # 8D 加权余弦相似度搜索引擎
│   ├── entityExtractor.js           # 实体提取 (饮品名/品类/风味词库)
│   ├── poolFilter.js                # 候选池预筛选 (分数排序+库存/时间裁剪)
│   ├── philosophyTags.js            # 东方哲学标签 + 本地推荐语生成器
│   ├── wuxingMapper.js              # 五行归属映射
│   ├── dimensionEngine.js           # 饮品维度计算
│   └── groupRecommendationEngine.js # 圈子匹配推荐
├── api/
│   ├── quoteGenerator.js            # 批量 LLM 推荐语请求 + 本地缓存
│   ├── moodAnalyzer.js              # 情绪分析 API 封装 + 本地降级
│   ├── cocktailApi.js               # CocktailDB 数据源封装
│   └── translationService.js        # 翻译服务
├── data/
│   ├── drinkVectors.js              # 离线饮品向量库 (500+款)
│   ├── translations.js              # 多语言翻译数据
│   └── ingredientKnowledgeBase.js   # 原料知识库
├── store/
│   ├── localStorageAdapter.js       # 持久化 (收藏/打卡/设置)
│   ├── favoriteDrinks.js            # 收藏管理
│   └── inventory.js                 # 用户库存管理
├── utils/
│   ├── ShareCardGenerator.js        # 分享卡片 DOM→Image
│   ├── inputValidator.js            # 输入校验工具
│   ├── responsive.js                # 响应式布局工具
│   └── localSpeechRecognition.js    # 本地语音识别
└── components/                      # React UI 组件

server/
├── llmProxy.js                      # LLM API 代理 (模型路由/Key隔离/限流/Socket.IO)
└── prodServer.js                    # 生产环境服务器
```

---

## 10. 饮品八维向量说明

| 索引 | 维度 | 范围 | 含义 | 对应六维来源 |
| :---: | :--- | :--- | :--- | :--- |
| 0 | Taste | 0-10 | 主味强度 (酸甜苦辛综合) | emotion.drinkMapping.tasteScore |
| 1 | Texture | -3~3 | 气机感 (-3沉静, +3灵动) | somatic.drinkMapping.textureScore |
| 2 | Temperature | -5~5 | 阴阳属性 (-5极冰, +5极热) | somatic.drinkMapping.temperature |
| 3 | Element | 1-5 | 五行映射坐标 (1木 2火 3土 4金 5水) | emotion.drinkMapping.colorCode |
| 4 | Time | 0-23 | 最佳适饮时辰 (小时) | time.drinkMapping.temporality |
| 5 | Aroma | 0-10 | 香气穿透力 | cognitive.drinkMapping.aromaScore |
| 6 | ABV | 0-95 | 酒精百分比 | socialContext.drinkMapping.ratioScore |
| 7 | Action | 1-5 | 场景指数 (1专注 2放松 3社交 4独处 5庆祝) | demand.drinkMapping.actionScore |

---

## 11. 开发与演进计划

- [x] 多智能体框架搭建 (MAS Core: 7 Agents + Orchestrator)
- [x] 聚合分析端点优化 (3 合 1 → ComprehensiveAnalyzer)
- [x] 东方美学分享卡片重构 (DOM-to-Image with html2canvas)
- [x] 实体提取与候选池预筛选 (Entity Extraction + Pool Filter)
- [x] 异步后置优化架构 (文案/验证不阻塞首屏)
- [x] 无情绪场景分享文案 (social-card-no-mood)
- [x] Socket.IO 实时心意互动
- [ ] 离线 RAG 辅助配方搜索
- [ ] 个人专属 AI 调酒师模型微调 (LoRA)
- [ ] 多轮对话式情绪探索

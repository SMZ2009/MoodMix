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

系统包含 **4 个 Agent 类** + **2 个独立本地引擎**，分为「核心推理链」「异步后置」和「独立功能」三组：

### 核心推理链 (主推荐流程 · 同步阻塞首屏)

| 组件 | 类型 | 驱动模型 | 后端端点 | 核心职责 |
| :--- | :--- | :--- | :--- | :--- |
| **entityExtractor** | 本地引擎 | 无 LLM | — | 从用户输入中提取饮品名/品类/风味实体，分离纯情绪文本 |
| **poolFilter** | 本地引擎 | 无 LLM | — | 基于实体匹配分 + 库存/时间场景裁剪候选池 (500+ → 10-40 款) |
| **ComprehensiveAnalyzer** | Agent | `MODEL_CORE` (7B) | `/api/comprehensive_analyze` | 一次请求完成：六维语义提取 + 中医辨证 + 八维向量翻译 |
| **vectorEngine** | 本地引擎 | 无 LLM | — | 8D 加权余弦相似度搜索，输出 Top 9 推荐 |
| **safetyFilter** | 本地引擎 | 无 LLM | — | 安全硬拦截：极端负面+高酒精、深夜+高咖啡因、热饮+烈酒 |

### 异步后置 (首屏渲染后 · 不阻塞 UI)

| Agent | 角色 | 驱动模型 | 后端端点 | 核心职责 |
| :--- | :--- | :--- | :--- | :--- |
| **CreativeCopywriter** | 意境文案师 | 本地 `philosophyTags.js` + `MODEL_CREATIVE` (32B) | `/api/generate_quotes` | 三枚哲学标签 (本地) + LLM 个性化推荐语覆盖 |
| **ValidatorOptimizer** | 质量评估师 | `MODEL_8B` (7B) + 本地时段规则 | `/api/quality-eval` (×N 并行) | 逐杯评估五行相合度 + 情绪一致性 + 时段适饮性，输出质量勋章 |

### 独立功能 Agent

| Agent | 角色 | 驱动模型 | 后端端点 | 核心职责 |
| :--- | :--- | :--- | :--- | :--- |
| **MixologyExpert** | 调饮专家 | `MODEL_8B` (7B) | `/api/generate-drink-dimensions`、`/api/drink-assistant` | 自定义饮品维度分析、制作过程即时问答 |
| **CreativeCopywriter** | 分享文案师 | `MODEL_CREATIVE` (32B) | `/api/social-card-copy`、`/api/social-card-no-mood` | 有/无情绪输入的社交分享卡片文案 |

### 独立视觉组件（非 Agent 架构，直连 API）

| 组件 | 驱动模型 | 后端端点 | 核心职责 |
| :--- | :--- | :--- | :--- |
| **StreamingAnalysisCard** | `MODEL_CREATIVE` (32B) | `/api/analyze_mood_stream` (SSE) | 流式六维「灵犀感应」，生成诗意推演文字 + 结构化 JSON |

### 调试/运维端点（不参与主流程）

| 端点 | 模型 | 当前用途 |
| :--- | :--- | :--- |
| `/api/analyze_mood` | `MODEL_CORE` (7B) | 非流式情绪分析（备用） |
| `/api/pattern_analyze` | `MODEL_CORE` (7B) | 独立辨证分析调试接口 |
| `/api/vector_translate` | `MODEL_CORE` (7B) | 独立 8D 向量翻译调试接口 |
| `/api/validate_optimize` | `MODEL_8B` (7B) | 旧版全局质检接口（已被逐杯 quality-eval 替代） |

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

### 3.3 ValidatorOptimizer (质量评估师) + safetyFilter (安全硬拦截)

> **架构分层**: 安全性检查已拆分为两层——第一层 `safetyFilter`（同步，首屏渲染前）负责硬拦截；第二层 `ValidatorOptimizer`（异步，首屏渲染后）负责质量评分和勋章。

#### 第一层: safetyFilter (同步硬拦截)

**文件**: `src/engine/safetyFilter.js`

**执行时机**: 向量搜索完成后、首屏渲染前（<10ms）

**无 LLM 调用**，纯本地规则：

| 规则 | 条件 | 动作 |
| :--- | :--- | :--- |
| 极端负面+高酒精 | `isNegative=true` 且 `emotion.intensity > 0.8` 且 `ABV > 40%` | 剔除，从候选池补位 |
| 深夜+高咖啡因 | 时间 22:00-6:00 且 `caffeine > 0.8` | 剔除，从候选池补位 |
| 热饮+烈酒 | `temperature > 3` 且 `ABV > 35%` | 剔除，从候选池补位 |

被剔除的饮品由候选池中下一个安全饮品补位，确保 Top 9 数量稳定。

#### 第二层: ValidatorOptimizer (异步质量评估)

**文件**: `src/agents/specialized/ValidatorOptimizer.js`

**设计目标**: 首屏渲染后异步执行，为每款推荐饮品输出「心境契合度百分比」和「一句话解读」，最终聚合为质量勋章。

**执行时机**: Phase 4b，与 CreativeCopywriter 并行执行，不阻塞 UI。

**评估架构**: `evaluateAllDrinks()` 对 Top 9 饮品使用 `Promise.all` 并行评估，每杯饮品独立进行三维打分：

| 评估维度 | 实现方式 | 权重 | 详细逻辑 |
| :--- | :--- | :--- | :--- |
| 五行相合度 `wuxingScore` | **LLM** → `/api/quality-eval` | **0.4** | LLM 评估推荐饮品五行与用户五行的生克关系 (0-100) |
| 情绪一致性 `emotionScore` | **LLM** → `/api/quality-eval` | **0.4** | LLM 评估饮品特性是否回应了用户情绪需求 (0-100) |
| 时段适饮性 `timeScore` | **本地规则** `calcTimeScore()` | **0.2** | 基于当前小时 + 饮品 ABV/咖啡因本地计算 (0-100) |

**LLM 调用详情** (`/api/quality-eval` × N 杯并行):

- **模型**: `MODEL_8B` (`Qwen/Qwen2.5-7B-Instruct`)
- **temperature**: 0.5 (默认)
- **max_tokens**: 800 (默认)
- **timeout**: 15,000ms
- **maxRetries**: 1
- **输入**: `{ moodSummary, userWuxing, drinkName, drinkWuxing, currentTime }`
- **输出**: `{ wuxingScore: 85, emotionScore: 90 }`
- **降级**: LLM 失败时 wuxingScore = 75, emotionScore = 75（温和默认值）

**本地时段评分逻辑** (`calcTimeScore`):

| 时段 | 高咖啡因饮品 | 高酒精 (ABV>10) | 低酒精/无酒精 |
| :--- | :--- | :--- | :--- |
| 6:00-10:00 (晨间) | 90 | 40 | 70 |
| 14:00-17:00 (午后) | 85 | 70 | 70 |
| 18:00-22:00 (傍晚) | 70 | 85 (ABV≤30) | 70 |
| 其他时段 | 70 | 70 | 70 |

**最终评分公式**:
```
finalScore = wuxingScore × 0.4 + emotionScore × 0.4 + timeScore × 0.2
```

**分数解读** (`getScoreComment`):

| 评分 | 一句话解读 |
| :--- | :--- |
| ≥ 85 | 五行相生，恰合此刻心境 |
| 70-84 | 气韵相近，略有未尽之意 |
| 50-69 | 缘虽不深，亦可浅尝一试 |
| < 50 | 此味尚远，容我再为你寻 |

**质量勋章** (全部饮品平均分):

| 平均分 | 等级 | 勋章文案 | UI 展示 |
| :--- | :--- | :--- | :--- |
| ≥ 85 | excellent | 心味相合 | 显示勋章 |
| 70-84 | good | 恰有灵犀 | 显示勋章 |
| 50-69 | acceptable | 随缘入味 | 不显示 |
| < 50 | poor | — | 不显示 |

**回调通知**: 评估完成后通过 `options.onQualityEvalSuccess(qualityResults)` 和 `options.onValidationSuccess(report)` 通知 UI 动态更新勋章。

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

### 3.5 Profile Injection (用户画像注入系统)

**文件**: `src/engine/profileWuxing.js`

**设计目标**: 将用户生日信息确定性地映射为天干地支 → 五行属性，作为「先天禀赋」注入 LLM Prompt，使推荐结果融合个人体质特征。

**触发位置**: `ComprehensiveAnalyzer.process()` 和 `StreamingAnalysisCard` 在调用 LLM 前均会读取 `localStorage('moodmix_profile')`。

**计算流程** (`calculateWuxingFromBirthday(birthday)`):

1. 解析生日字符串 `YYYY-MM-DD`
2. 计算年柱: 以 1984 甲子年为基准 → `(year - 1984) % 60` → 天干地支
3. 计算日柱: 朱利安日数 (JDN) + 校准偏移量 → `(JDN + offset) % 60` → 天干地支
4. 天干 → 五行: 甲乙=木, 丙丁=火, 戊己=土, 庚辛=金, 壬癸=水
5. 五行评分: 年柱五行 +30, 日柱五行 +20, 其余各 10 → 取最高为主属性
6. 生成 `derivedMoodMapping`: 主属性 → 确定性的 tasteScore/colorCode/textureScore/temperature/temporality

**五行 → 饮品维度映射表**:

| 五行 | tasteScore | colorCode | textureScore | temperature | temporality |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 木 | 7 | 2 | 1 | -1 | 6 |
| 火 | 8 | 4 | 2 | 4 | 14 |
| 土 | 6 | 3 | 0 | 0 | 12 |
| 金 | 4 | 1 | -1 | -2 | 18 |
| 水 | 6 | 5 | -2 | -4 | 22 |

**Prompt 注入** (`buildProfileContextBlock()` in `llmProxy.js`):

当 `profileApplied=true` 时，在 User Message 末尾追加 `[ProfileContext]` 块，包含：
1. **Birthday 固定约束** (最高优先级): 覆盖 LLM 的自主推断，强制使用上表中的数值
2. **体质偏向** (`constitutionBias`): 根据 `longTermCity` / `birthplace` 是否包含南方省份关键词判断偏阳/偏阴
3. **体质偏向固定赋值**: 偏阳 → ratioScore=75, actionScore=4; 偏阴 → ratioScore=35, actionScore=2
4. **冲突解决**: 固定约束始终覆盖 LLM 推断值

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
╔═════════════════════════════════════════════════════════════╗
║ Phase 1: 实体提取与候选池筛选 (本地, <50ms)                  ║
║                                                             ║
║  1. 输入预处理                                               ║
║     userInput.split('\n') → pureUserInput + inventoryInfo   ║
║                                                             ║
║  2. extractEntities(cleanUserInput)                         ║
║     词库规模: 30+饮品名 × 17品类 × 22风味                    ║
║     ├ 饮品名匹配: 「莫吉托」→ { key:'mojito', matched:'莫吉托' } ║
║     ├ 品类匹配: 按别名长度降序，避免短词误匹配               ║
║     ├ 风味匹配: 同上，支持中英文                             ║
║     ├ 置信度: drinkNames×0.5 + categories×0.3 + flavors×0.2 ║
║     └ 移除已匹配词 → remainingInput = "今天有点累 想放松一下" ║
║                                                             ║
║  3. filterDrinkPool(allDrinks, entities, options)           ║
║     ├ mode 分流:                                          ║
║     │   ├ mode='pick'(寻一杯): 实体得分 + 轻量库存/时间裁剪      ║
║     │   └ mode='diy'(调一杯): 只基于库存齐备度生成候选（不走实体得分筛选）；无命中则回退全量池 ║
║     ├ 评分体系: 精确名100 > 品类25-30 > 风味12-20           ║
║     ├ 特殊品类逻辑: mocktail检查ABV=0, 基酒检查原料等        ║
║     ├ applyCandidatePruning():                              ║
║     │   ├ 烈酒(ABV≥25) + 库存重叠<15% → 裁掉(超过minPoolSize时)║
║     │   └ 时间不匹配(深夜高咖啡因/清晨烈酒) → 裁掉          ║
║     ├ 回退: 不足minPoolSize时放宽条件，最终兜底返回全量池     ║
║     └ 500+ 款 → 10-40 款候选池                              ║
║                                                             ║
║  引擎: entityExtractor.js + poolFilter.js                   ║
║  无 LLM 调用                                                ║
╚═════════════════════════════════════════════════════════════╝
    │
    │ 创建 AgentContext:
    │   userInput = remainingInput (纯情绪文本)
    │   allDrinks = filteredPool (已筛选候选)
    │   intermediate.extractedEntities = entities
    │
    ▼
╔═════════════════════════════════════════════════════════════╗
║ Phase 2: 全链路聚合分析 (API, 3-8s)                          ║
║                                                             ║
║  ComprehensiveAnalyzer.execute(context)                     ║
║                                                             ║
║  ┌─ Step 2a: Profile 注入 (本地, <5ms) ─────────────────┐  ║
║  │ localStorage('moodmix_profile') → birthday             │  ║
║  │ calculateWuxingFromBirthday(birthday)                  │  ║
║  │ → { profileApplied, birthdayWuxing, birthplace,        │  ║
║  │     longTermCity }                                     │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                             ║
║  ┌─ Step 2b: 调用 POST /api/comprehensive_analyze ──────┐  ║
║  │ 请求体:                                                │  ║
║  │   { user_input, current_time, user_profile }           │  ║
║  │                                                        │  ║
║  │ 后端处理 (llmProxy.js):                                │  ║
║  │   systemPrompt = buildComprehensiveSystemPrompt()      │  ║
║  │   userMessage = buildUserMessage() + profileContextBlock║  ║
║  │                                                        │  ║
║  │ LLM 调用:                                              │  ║
║  │   模型: MODEL_CORE (Qwen/Qwen2.5-7B-Instruct)        │  ║
║  │   temperature: 0.5                                     │  ║
║  │   max_tokens: 1200                                     │  ║
║  │   timeout: 60,000ms (后端) / 45,000ms (Agent端)       │  ║
║  │   maxRetries: 2                                        │  ║
║  │   response_format: { type: "json_object" }             │  ║
║  │                                                        │  ║
║  │ Prompt 三阶段推理指令:                                  │  ║
║  │   ① 语义提取: emotion→五行, somatic→气机, time→时序,    │  ║
║  │     cognitive→嗅觉, demand→诉求, socialContext→场域     │  ║
║  │   ② 辨证分析: polarity + wuxing + strategy + diagnosis │  ║
║  │   ③ 向量翻译: 8D targetVector + weights + priorities   │  ║
║  │                                                        │  ║
║  │ [如有 Profile] 追加 [ProfileContext] 块:                │  ║
║  │   - Birthday 固定约束覆盖 LLM 推断值                   │  ║
║  │   - 体质偏向 (南方城市=偏阳, 其他=偏阴) → ratio/action  │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                             ║
║  ┌─ Step 2c: 结果分发 ─────────────────────────────────┐   ║
║  │ context.setIntermediate('moodData', ...)              │   ║
║  │ context.setIntermediate('patternAnalysis', ...)       │   ║
║  │ context.setIntermediate('vectorResult', ...)          │   ║
║  └───────────────────────────────────────────────────────┘   ║
╚═════════════════════════════════════════════════════════════╝
    │
    ▼
╔═════════════════════════════════════════════════════════════╗
║ Phase 3: 向量语义搜索 (本地, <100ms)                         ║
║                                                             ║
║  evaluateAndSortDrinks(moodData, filteredDrinks, inventory) ║
║                                                             ║
║  ① computeDynamicWeights(moodData):                         ║
║     κ 敏感度: somatic=2.0 > demand=1.8 > emotion=1.5       ║
║              > cognitive=1.2 > timeContext=1.0              ║
║     W[i] = baseWeight + Σ(κ_dim × I_dim × 影响系数)        ║
║     归一化: W_final = W[i] / Σ(W)                           ║
║                                                             ║
║  ② buildUserVector(moodData):                               ║
║     [taste, texture, temperature, color, temporality,       ║
║      aroma, ratio, action]                                  ║
║     直接从 moodData 各维度的 drinkMapping 字段提取           ║
║                                                             ║
║  ③ 遍历候选池每款饮品:                                       ║
║     加载 drinkVectors 离线向量库                             ║
║     weightedCosineSimilarity(userVector, drinkVector, W):   ║
║       - 时序(dim4): 环形距离 (0-23h 循环)                   ║
║       - 颜色(dim3): 差值反转                                ║
║       - 触觉(dim1), 温度(dim2): 差值反转                    ║
║       - 其余维度: 标准加权余弦                               ║
║                                                             ║
║  ④ 库存齐备加分:                                             ║
║     0缺: +0.15 | 1缺: +0.08 | 2缺: +0.03 | ≥3缺: +0      ║
║                                                             ║
║  ⑤ 全局降序排序 → Top 9                                     ║
║                                                             ║
║  引擎: vectorEngine.js                                      ║
║  无 LLM 调用                                                ║
╚═════════════════════════════════════════════════════════════╝
    │
    ▼
╔═════════════════════════════════════════════════════════════╗
║ Phase 3.5: 安全硬拦截 (本地, <10ms)                          ║
║                                                             ║
║  safetyFilter(top9, moodData, fullPool)                     ║
║    规则1: 极端负面(intensity>0.8) + ABV>40% → 剔除          ║
║    规则2: 深夜(22:00-6:00) + caffeine>0.8 → 剔除           ║
║    规则3: 热饮(temp>3) + ABV>35% → 剔除                     ║
║    被剔除的饮品由候选池中下一个安全饮品补位                   ║
║                                                             ║
║  引擎: safetyFilter.js                                      ║
║  无 LLM 调用                                                ║
╚═════════════════════════════════════════════════════════════╝
    │
    │ context.setIntermediate('matches', [...])
    │
    │  >>> 首屏渲染完成，用户可见推荐卡片 <<<
    │
    ▼ (异步 IIFE，不阻塞 UI)
╔═════════════════════════════════════════════════════════════╗
║ Phase 4: 异步后置优化 (Promise.all 并行)                     ║
║                                                             ║
║  ┌─ 4a. CreativeCopywriter (本地 + 异步 LLM) ────────┐     ║
║  │                                                     │     ║
║  │ copywriter.execute(context):                        │     ║
║  │   读取 context.matches[0] (Top1 饮品)               │     ║
║  │   generatePhilosophyTags(dimensions, moodData, name)│     ║
║  │   → 三枚哲学标签 [辨证, 策略, 体感] (纯本地)        │     ║
║  │   → 本地模板推荐语 (无 LLM)                         │     ║
║  │   → explanation + variations (无 LLM)               │     ║
║  │   context.setIntermediate('creativeCopy', copy)     │     ║
║  │                                                     │     ║
║  │ 触发 onVectorSearchSuccess 回调 → UI 更新后:        │     ║
║  │                                                     │     ║
║  │ fetchLiveQuotes(top15, contextData):                │     ║
║  │   为每杯饮品构建 contextPackage:                     │     ║
║  │     { userState, strategy, drinkProfile, sensory,   │     ║
║  │       matchReason, userWuxing, strategyType,        │     ║
║  │       moodSummary }                                 │     ║
║  │                                                     │     ║
║  │   POST /api/generate_quotes:                        │     ║
║  │     模型: MODEL_CREATIVE (Qwen2.5-32B-Instruct)    │     ║
║  │     temperature: 0.9                                │     ║
║  │     max_tokens: 1200                                │     ║
║  │     timeout: 55,000ms                               │     ║
║  │     maxRetries: 2                                   │     ║
║  │                                                     │     ║
║  │   Prompt 核心:                                      │     ║
║  │     角色: 深谙五行哲学的专业酒保                     │     ║
║  │     叙事架构: [辨证失调] → [调和逻辑] → [物理反馈]   │     ║
║  │     长度: 25-45字，用「」包裹                        │     ║
║  │     禁忌: "因为..."开头/四字堆砌/复读用户输入        │     ║
║  │     多样性: 同批次9杯必须完全不同切入视角            │     ║
║  │                                                     │     ║
║  │   结果: 覆盖本地模板推荐语 → 写入 localStorage 缓存 │     ║
║  │   降级: 网络失败时静默保留本地模板，用户无感知       │     ║
║  └─────────────────────────────────────────────────────┘     ║
║                                                             ║
║  ┌─ 4b. evaluateAllDrinks (LLM × N 并行) ────────────┐     ║
║  │                                                     │     ║
║  │ evaluateAllDrinks(safeDrinks, contextData):         │     ║
║  │   Promise.all → 每杯饮品独立评估:                    │     ║
║  │                                                     │     ║
║  │   ┌─ evaluateDrink(drink, moodData) ────────────┐  │     ║
║  │   │ ① calcTimeScore(drink, hour) → 本地时段分    │  │     ║
║  │   │                                              │  │     ║
║  │   │ ② POST /api/quality-eval:                    │  │     ║
║  │   │    模型: MODEL_8B (Qwen2.5-7B-Instruct)     │  │     ║
║  │   │    temperature: 0.5                          │  │     ║
║  │   │    timeout: 15,000ms                         │  │     ║
║  │   │    maxRetries: 1                             │  │     ║
║  │   │    输入: { moodSummary, userWuxing,           │  │     ║
║  │   │           drinkName, drinkWuxing, currentTime}│  │     ║
║  │   │    输出: { wuxingScore, emotionScore }        │  │     ║
║  │   │    降级: 失败→ wuxing=75, emotion=75          │  │     ║
║  │   │                                              │  │     ║
║  │   │ ③ finalScore = wuxing×0.4 + emotion×0.4     │  │     ║
║  │   │              + timeScore×0.2                  │  │     ║
║  │   └──────────────────────────────────────────────┘  │     ║
║  │                                                     │     ║
║  │ 结果:                                               │     ║
║  │   → context.setIntermediate('qualityResults', [...])│     ║
║  │   → onQualityEvalSuccess(qualityResults)            │     ║
║  │   → onValidationSuccess({ score, uiHints })         │     ║
║  │   → UI 动态更新质量勋章                              │     ║
║  └─────────────────────────────────────────────────────┘     ║
╚═════════════════════════════════════════════════════════════╝
```

### 5.1.1 LLM 调用汇总（主推荐流程单次执行）

| 阶段 | 端点 | 模型 | 调用次数 | 阻塞首屏? |
| :--- | :--- | :--- | :--- | :--- |
| Phase 2 | `/api/comprehensive_analyze` | `MODEL_CORE` (7B) | 1 | **是** |
| Phase 4a | `/api/generate_quotes` | `MODEL_CREATIVE` (32B) | 1 (批量) | 否 |
| Phase 4b | `/api/quality-eval` | `MODEL_8B` (7B) | ≤9 (每杯一次) | 否 |

总计：**1 次同步 LLM 调用** (阻塞首屏) + **≤10 次异步 LLM 调用** (后台优化)

### 5.2 流式情绪分析（StreamingAnalysisCard · 视觉体验层）

**文件**: `src/components/ui/StreamingAnalysisCard.js`

**定位**: 与主推荐流程并行的**视觉体验组件**——在用户等待推荐结果期间，以流式打字机效果展示诗意化的情绪推演过程，增强交互仪式感。

```
用户输入
    │
    ├──→ [主推荐线程] executeRecommendationPipeline (Phase 1-4)
    │
    └──→ [视觉体验线程] StreamingAnalysisCard
              │
              ▼
         ┌────────────────────────────────────────────────────┐
         │ Step 1: Profile 注入 (同 Phase 2a)                 │
         │   localStorage('moodmix_profile')                  │
         │   → calculateWuxingFromBirthday(birthday)          │
         │   → user_profile                                   │
         └────────────────────────────────────────────────────┘
              │
              ▼
         ┌────────────────────────────────────────────────────┐
         │ Step 2: POST /api/analyze_mood_stream (SSE)        │
         │                                                    │
         │   模型: MODEL_CREATIVE (Qwen/Qwen2.5-32B-Instruct)│
         │   temperature: 0.7                                 │
         │   max_tokens: 1500                                 │
         │   stream: true (Server-Sent Events)                │
         │   timeout: 40,000ms                                │
         │                                                    │
         │   System Prompt 特色:                              │
         │     角色: "深谙东方玄学与调酒艺术的智者"            │
         │     阶段一「灵犀感应」:                             │
         │       6 维度各用古典文言风格描述:                   │
         │       情绪流转(五行消长) → 气机态势(经脉气血)       │
         │       → 时空呼应(星象历法) → 神志状态(禅意佛理)     │
         │       → 心之所向(易经八卦) → 场域感应(风水堪舆)     │
         │       要求引经据典，化用诗词典故                    │
         │     阶段二「天机呈现」:                             │
         │       以 [RESULT] 标记后输出 JSON                   │
         │       结构: { moodData, patternAnalysis, summary }  │
         └────────────────────────────────────────────────────┘
              │
              │ (SSE 流式返回)
              ▼
         ┌────────────────────────────────────────────────────┐
         │ Step 3: 客户端流处理                                │
         │                                                    │
         │   data.delta → 累积到 fullText                     │
         │   启发式过滤:                                       │
         │     - 检测 [THOUGHT] 和 [RESULT] 标记              │
         │     - 过滤 JSON / 代码块 / 技术性标记               │
         │     - 仅保留自然语言部分 → 打字机效果展示            │
         │                                                    │
         │   data.done=true → 解析最终 JSON:                   │
         │     { moodData, patternAnalysis, summary }          │
         │     → onStreamComplete(resultData) 回调             │
         └────────────────────────────────────────────────────┘
```

**与主推荐流程的关系**: StreamingAnalysisCard 的输出 (`moodData`, `patternAnalysis`) 与 ComprehensiveAnalyzer 的输出结构相同，但使用了更大的模型 (32B vs 7B) 和更长的推理 token (1500 vs 1200)，且 Prompt 风格偏向诗意化。两者独立运行，互不依赖。

---

### 5.3 分享卡片生成流程

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

### 5.4 独立任务流程 (`executeMixologyTask`)

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

- `mode='pick'`（寻一杯）：只做“轻量”库存/时间场景裁剪，不强制原料完全齐备
- `mode='diy'`（调一杯）：当 `inventory` 非空时，强制只保留“配方每个原料都在库存中”的饮品（不依赖实体得分）；若无命中则回退全量池（并标记 `filterApplied=false`）
- **精确名匹配**: 100 分
- **品类匹配**: 25-30 分（支持特殊逻辑：mocktail 检查 ABV=0、特定基酒检查原料）
- **风味匹配**: 12-20 分（原料 > 描述 > 标签）
- **库存裁剪**:（pick 模式）烈酒 + 用户库存重叠 <15% → 在满足 minPoolSize 前提下裁掉
- **时间裁剪**: 深夜过滤高咖啡因饮品，清晨过滤高度数烈酒
- **回退策略**:（pick 模式）过滤结果不足时放宽匹配；（diy 模式）无命中则直接回退全量池

### 6.3 vectorEngine.js (向量搜索引擎)

核心匹配算法，计算用户需求向量与饮品向量的加权余弦相似度：

- **动态权重**: 基于敏感度系数 κ × 各维度 intensity 动态调整 8 个维度的权重
- **特殊维度处理**: 时序维度使用环形距离 (0-23 小时循环)；温度和质地使用差值反转
- **库存加分**（仅当 `inventory` 非空时才计算缺料）：缺料 0 → `+0.15`；缺料 1 → `+0.08`；缺料 2 → `+0.03`；缺料 >=3 → `+0`；因此 `pick(寻一杯)` 会把“缺料程度”体现在相似度上；`diy(调一杯)` 由于候选池已被强制筛到“更可能缺料=0”，整体更接近纯向量相似度排序
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

### LLM 驱动端点

| 端点 | 方法 | 模型 | temperature | max_tokens | timeout | 用途 | 状态 |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `/api/comprehensive_analyze` | POST | MODEL_CORE (7B) | 0.5 | 1200 | 60s | 全链路聚合分析 (语义+辨证+向量) | **主用·阻塞首屏** |
| `/api/analyze_mood_stream` | POST | MODEL_CREATIVE (32B) | 0.7 | 1500 | 40s | SSE 流式六维「灵犀感应」 | **主用·视觉体验** |
| `/api/generate_quotes` | POST | MODEL_CREATIVE (32B) | 0.9 | 1200 | 55s | 批量推荐文案生成 (≤10条) | 异步增强 |
| `/api/quality-eval` | POST | MODEL_8B (7B) | 0.5 | 800 | 15s | 单杯五行相合+情绪一致性评分 | 异步×N并行 |
| `/api/social-card-copy` | POST | MODEL_CREATIVE (32B) | 0.8 | 300 | 45s | 分享卡片诗意文案 (有情绪输入) | 按需 |
| `/api/social-card-no-mood` | POST | MODEL_CREATIVE (32B) | 0.8 | 400 | 45s | 分享卡片文案 (无情绪输入) | 按需 |
| `/api/drink-assistant` | POST | MODEL_8B (7B) | 0.7 | 500 | 45s | 饮品制作问答助手 (非JSON模式) | 按需 |
| `/api/analyze_mood` | POST | MODEL_CORE (7B) | 0.5 | 800 | 60s | 非流式情绪分析 | 备用 |
| `/api/pattern_analyze` | POST | MODEL_CORE (7B) | 0.5 | 800 | 45s | 独立辨证分析 | 调试 |
| `/api/vector_translate` | POST | MODEL_CORE (7B) | 0.5 | 800 | 45s | 独立向量翻译 | 调试 |
| `/api/validate_optimize` | POST | MODEL_8B (7B) | 0.5 | 800 | 50s | 旧版全局质检 (已被 quality-eval 替代) | 遗留 |
| `/api/speech-to-text` | POST | MODEL_8B (7B) | 0.3 | 500 | 30s | 语音转文字 (多模态) | 按需 |

### 非 LLM 端点

| 端点 | 方法 | 用途 | 状态 |
| :--- | :--- | :--- | :--- |
| `/api/generate-drink-dimensions` | POST | 自定义饮品维度分析 | 按需 |
| `/api/cocktaildb/*` | ALL | TheCocktailDB API 代理 | 数据源 |
| `/api/cocktail-image/:name` | GET | 鸡尾酒图片代理 (带缓存, max-age: 86400) | 数据源 |
| `/api/amap/nearby` | GET | 高德 POI 搜索附近酒吧 (types=071301) | LBS |
| `/api/amap/regeo` | GET | 高德逆地理编码 (经纬度→地名) | LBS |
| `/api/drink/like` | POST | 饮品心意点赞 (Socket.IO 广播) | 社交 |
| `/api/drink/unlike` | POST | 取消心意 | 社交 |
| `/api/drink/like-stats/:id` | GET | 查询心意统计 | 社交 |
| `/health` | GET | 健康检查 (含 API Key 配置状态) | 运维 |

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
│   ├── safetyFilter.js              # 安全硬拦截 (极端负面+高酒精 等)
│   ├── philosophyTags.js            # 东方哲学标签 + 本地推荐语生成器
│   ├── wuxingMapper.js              # 五行归属映射 (饮品→五行)
│   ├── profileWuxing.js             # 用户生日→天干地支→五行画像 (确定性映射)
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

# MoodMix 项目结构与逻辑架构文档

## 1. 项目概述 (Overview)
**MoodMix** 是一款创新的 AI 驱动“心境饮品搭配”应用。它能够将用户输入的抽象心情描述（例如：“压力很大的周五夜晚”、“想找点清新的感觉”），利用大语言模型（LLM）精准解析为结构化的味觉和体感维度数据，进而通过专门的推荐引擎运算，与酒水库（鸡尾酒或无酒精饮品）进行高维度匹配，推荐出最符合用户当下情绪的饮品。

## 2. 宏观系统架构 (System Architecture)
项目采用了**前后端分离 + 多智能体协作（Multi-Agent System）**的架构范式：

*   **前端（Frontend / Client）**：基于 React (Create React App + TailwindCSS) 构建，承担着所有的富交互（动画特效、防抖输入、滑动匹配界面）以及核心算法执行的任务。
*   **多智能体系统（Multi-Agent System）**：核心推荐逻辑由5个专职Agent顺序协作完成，每个Agent负责特定的认知任务，通过共享上下文传递状态。
*   **微后端（Backend Proxy）**：一个轻量化的 Express.js Node 服务，担任智能体交互网关，负责向外部大模型（如 SiliconFlow）转发 Prompt，隐藏真实 API Keys，并在模型异常时执行降级和容灾策略。
*   **外部依赖集成库（Integrations）**：依赖第三方开放数据 TheCocktailDB 进行外部饮品补充，并集成免费的记忆翻译 API 改善本地化体验。

### 2.1 多智能体系统架构 (Multi-Agent Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MoodMix Multi-Agent System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Agent 1    │───▶│   Agent 2    │───▶│   Agent 3    │                  │
│  │ 语义蒸馏器   │    │ 辨证分析师   │    │ 向量翻译官   │                  │
│  │(NLU Sensor)  │    │(Diagnostician)│   │(Translator)  │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│    6维JSON数据      诊断结论+策略       8维需求向量                        │
│                                                                             │
│                              │                                              │
│                              ▼                                              │
│                    ┌──────────────────┐                                    │
│                    │  Vector Search   │  (纯数学计算，非Agent)              │
│                    │  加权余弦相似度   │                                    │
│                    └──────────────────┘                                    │
│                              │                                              │
│                              ▼                                              │
│                    ┌──────────────────┐                                    │
│                    │    Agent 4       │                                    │
│                    │  创意文案师      │                                    │
│                    │ (Copywriter)     │                                    │
│                    └──────────────────┘                                    │
│                              │                                              │
│                              ▼                                              │
│                    ┌──────────────────┐                                    │
│                    │    Agent 5       │                                    │
│                    │  验证优化师      │                                    │
│                    │ (Validator)      │                                    │
│                    └──────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Agent | 名称 | 角色 | 核心职责 | 输入 | 输出 |
|:-----:|:-----|:-----|:---------|:-----|:-----|
| 1 | **SemanticDistiller** | NLU传感器 | 非结构化语义识别，提取6维数据 | 用户原始语段 | 结构化6维JSON |
| 2 | **PatternAnalyzer** | 辨证分析师 | 五行归纳，确定调理策略 | 6维JSON | 诊断结论+策略 |
| 3 | **VectorTranslator** | 向量翻译官 | 跨模态映射，生成目标向量 | 诊断结论 | 8维向量+动态权重 |
| 4 | **CreativeCopywriter** | 创意文案师 | 因果叙事，哲学润色 | 匹配饮品+用户状态 | UI文案 |
| 5 | **ValidatorOptimizer** | 验证优化师 | 一致性验证，质量评分 | 全流程输出 | 验证报告 |

## 3. 核心目录与职能切分 (Directory Structure & Concerns)

在此系统的近期演进中，严格秉承了 **Separation of Concerns (KISS原则)**，按照职能进行深度解耦：

```text
moodmix/
├── server/
│   └── llmProxy.js             # 【安全代理层】承载 /api/analyze_mood 和 /api/generate_copy，对接大模型
├── scripts/
│   ├── batchGenerate.mjs       # 【构建脚本】离线引擎：将配料组合静态推导为饮品八维向量
│   └── ingredientKnowledgeBase.js 
├── src/                        # 前端源码核心区
│   ├── agents/                 # 【多智能体系统】核心推荐工作流的5个Agent实现
│   │   ├── core/               # Agent基础设施：BaseAgent、AgentContext、AgentOrchestrator
│   │   ├── specialized/        # 5个专用Agent实现
│   │   └── index.js            # 统一导出与快速接口
│   ├── api/                    # 【通信中心】对外集成：LLM 请求、TheCocktailDB 请求、翻译请求
│   ├── engine/                 # 【算法引擎】匹配运算中心：动态加权向量匹配、六维至八维余弦相似度推演、东方哲学降维映射
│   ├── store/                  # 【持久化仓库】本地缓存与数据管理：收藏夹、库存库、翻译缓存
│   ├── components/             # 【UI组件库】解耦的原子视图组件及界面片段
│   ├── hooks/                  # 【逻辑复用】交互增强：触觉反馈、键盘热键绑定
│   ├── data/                   # 【本地数据池】现存的系统预置知识数据
│   ├── App.js                  # 【应用大脑】根路由、状态总线、模块调度与组装
│   └── index.css               # 【视觉基座】Tailwind 指令及关键原生动画特效
└── AI_EXPERIENCE.md            # 项目 AI 开发演进的“经验沉淀池”
```

## 4. 关键引擎及业务流路 (Core Workflows)

### 4.1. 心境解析与智能推荐链路 (Mix Tab Flow)
这是该应用最具差异化表现的核心闭环。它抛弃了传统的“标签匹配”系统，转而构建了一座连接**人类发散情感**与**饮品物理参数**的桥梁，而这座桥梁的内在驱动核则是**东方哲学（五行生克与阴阳气机）**。

整个推荐流程由**5个Agent顺序协作**完成，每个Agent负责特定的认知任务，通过共享上下文传递状态。这种架构实现了关注点分离，每个Agent可独立开发、测试和优化。

#### 第一步：大模型结构化解析 (llmProxy)
用户输入任意自然语言的心情描述后，微后端代理层会对大语言模型下达强制指令（JSON Schema），要求 LLM 扮演中医与心理学家的双重角色。系统通过东方哲学体系，精准剥离出以下**“六维生理/心理诊断特征”**：

| 维度域 | 关注重心 | 哲学关联与解析逻辑 | 量化落点与输出域 |
| :--- | :--- | :--- | :--- |
| **情绪 (Emotion)** | 喜怒忧思恐 | **五行**：以五行映射情绪态。例如“悲伤/郁闷”为金(白)，需要辛味或酸味收敛；“暴躁”为木(青)，需水(黑)滋养。 | **味觉 (0-10分)**<br>**颜色 (1-5阶限)** |
| **躯体 (Somatic)** | 冷热寒凉、闷痛 | **阴阳与气机**：判断症状的阴阳亢盛。如“身躯烦热”属阳盛，需用阴冷质地压制升发的火气。 | **温度 (-5~5阴阳轴)**<br>**触觉 (-3~3气机向)** |
| **时间 (Time)** | 节律与环境背景 | **十二时辰与天人相应**：早晨不宜烈酒，深夜适合安神。结合社交场合定夺适饮时段。 | **时序 (0-23点环形轴)** |
| **认知 (Cognitive)** | 脑力清浊状态 | **神之归位**：脑力透支为“神散”，需辛香料通窍升提；焦虑失眠需沉降安神。 | **嗅觉/香气 (0-10分)** |
| **诉求 (Demand)** | 用户显性动作意愿 | **止/动/破的内心道场**：判别用户是渴求“静置发呆”，还是“发泄破坏”。 | **动作 (1-5烈度)** |
| **社交 (SocialContext)** | 边界与宣发倾向 | **气之发散**：需要破局还是自我封闭，决定了酒精的挥发渗透力要求。 | **比例/ABV (0-95%)** |

> *注：此外，以上每个维度域都会额外输出一个 `intensity`（0.0 - 1.0 的强度信号），用来刻画该维度当下对用户而言的“急迫程度”。*

> **Agent 1 (SemanticDistiller)** 负责执行此步骤，将非结构化用户输入转化为结构化6维数据。

#### 第二步：辨证分析与策略确定 (Pattern Analysis)
**Agent 2 (PatternAnalyzer)** 基于6维数据进行中医辨证分析：
- **极性判定**：判断当前状态为正向(共鸣策略)或负向(纠偏/对冲策略)
- **五行归纳**：将情绪/躯体映射到五行脏腑体系
- **策略选择**：确定调理策略类型（共鸣/纠偏/对冲）

输出包括：诊断结论、五行关系分析、调理策略定义。

#### 第三步：抽象空间至物理空间的降维映射 (6D -> 8D Vector Mapping)
**Agent 3 (VectorTranslator)** 将诊断结论翻译为可计算的数学表示：
- 构建**8维目标向量** `[taste, texture, temperature, color, temporality, aroma, ratio, action]`
- 计算**动态权重** `W_final,i = Normalize(W_base,i + Σ(κ_j→i × I_j))`

其中：
- `κ` (Kappa) 为维度敏感度系数：躯体2.0、诉求1.8、情绪1.5、认知1.2
- `I` (Intensity) 为各维度信号强度

大模型吐出的虽然是 6 个高度凝练的抽象维度（如情绪、躯体、时序等），但其内部通过 Prompt 约束，已精准携带着走向杯中物理状态的子指标（`drinkMapping`）。因此在进入相似度计算前，系统会将用户的 6D 心境转化为对标饮品库的 **8D 标准特征向量 (User Vector)**：
- **味觉 (Taste, 0-10)**：提取自 `emotion.drinkMapping.tasteScore`
- **颜色 (Color, 1-5)**：提取自 `emotion.drinkMapping.colorCode`
- **触觉/质地 (Texture, -3~3)**：提取自 `somatic.drinkMapping.textureScore`
- **温度 (Temperature, -5~5)**：提取自 `somatic.drinkMapping.temperature`
- **嗅觉 (Aroma, 0-10)**：提取自 `cognitive.drinkMapping.aromaScore`
- **时序 (Temporality, 0-23)**：提取自 `time.drinkMapping.temporality`
- **烈度占比 (Ratio/ABV, 0-95)**：提取自 `socialContext.drinkMapping.ratioScore`
- **动作感 (Action, 1-5)**：提取自 `demand.drinkMapping.actionScore`

#### 第四步：向量引擎加权推演 (Vector Search)
拿到 1 对 1 完全对齐的 8 维需求坐标，以及动态权重后，匹配交由前端的纯本地**离线向量引擎**去执行严厉的数学过滤（此步骤非Agent，纯数学计算）：

1. **加权余弦相似度 (Weighted Cosine Similarity)**：
   使用动态计算好的 8 维权重数组 `W_final`，对本地 400+ 杯含有对等 8 维数值特征库的饮品执行加权空间夹角运算；其中如环形轴数据"时间 (0-24h环)"及定界数据"温度"会再通过非线性的差异算法转换为量级正收益补偿，得出精确到百分比的 **Similarity Score**。
2. **双轨制融合排序**：
   采用**附加分代数系统 (Bonus Score System)**，根据缺料数量注入动态 Bonus（缺0项+0.15，缺1项+0.08，缺2项+0.03），实现"可做度"与"适配度"的平滑融合。

#### 第五步：东方哲学与动态意境文案生成 (Creative Copywriting)
**Agent 4 (CreativeCopywriter)** 负责生成有温度的UI文案：

为了让推荐更具灵魂，系统引入了**“由表及里”**的两阶段文案渲染策略：
1. **本地骨架文案 (Static Fallback)**：基于 [philosophyTags.js](file:///d:/AI/MixLab/moodmix-0228/src/engine/philosophyTags.js) 中的五行生克矩阵，根据 Drink Qi 和 User Qi 的相互关系（生/克/同等）秒出本地预设短评，保证界面 0 延迟响应。
2. **大模型动态 Hydration**：在前端展示的同时，异步向后端 `/api/generate_copy` 发起请求。
   - **因果叙事**：将匹配分值转化为有温度的解释
   - **哲学润色**：利用东方哲学风格生成专属调理语录
   - **动态变体**：每次生成不同的文案，确保不重复
3. **视觉平滑替换**：后端诗句返回后，前端通过 CSS opacity 渐变完成从“标准文案”到“大师短诗”的平滑焕新。

#### 第六步：全流程验证与质量评分 (Validation & Optimization)
**Agent 5 (ValidatorOptimizer)** 作为质量守门员，执行以下验证：

1. **一致性验证**：检查Agent链是否逻辑自洽
   - 情绪极性与策略是否匹配（负面情绪不应使用共鸣策略）
   - 五行映射是否一致
2. **冲突检测**：发现维度间的矛盾
   - 向量维度是否在有效范围内
   - 权重是否正确归一化
3. **质量评分**：计算整体质量分数 (0-100%)
4. **自动优化**：修复可识别的问题（如权重归一化、向量越界截断）

输出验证报告，标记是否需要人工复核。

### 4.2. 外部灵感库探测链路 (Explore Tab Flow)
1.  **异步数据池对接**：通过 `api/exploreDrinks.js` 以高并发防抖的形式，连接 TheCocktailDB 的 API。
2.  **清洗与转换**：TheCocktailDB 的数据结构极为扁平冗杂（`strIngredient1`~`15` 等字段）。在接收到数据瞬间，接口层主动拦截它并转化清洗为标准化对象模式（支持统一的属性访问调用）。
3.  **分类映射与呈现**：利用在 `ExploreSection` 建立的翻译缓存器（优先命中本地字典，未命中才调用外部记忆翻译 API），对接口返回成分及步骤直接提供中文平滑展现，大幅降低外网不稳定对使用体验产生的顿挫。

### 4.3. 静态结构化化学生成链路 (Data Pipeline)
1.  **脱离人工标注**：该应用舍弃了繁重的逐一为饮品打分模式。采用创新的**底层配料知识驱动**（Ingredient Knowledge Base）。
2.  **逆向配方求导**：在每次构建或录入新酒谱时，脚本会提取配方中的毫升数占比作为配重。将每一种例如“朗姆酒”或“柠檬汁”的基础味蕾指标提取，并在剔除装饰物料（如 Garnish 薄荷叶、盐边等）后执行加权计算，进而自下而上地自动化求证出这杯饮品的八阶风味特征。

## 5. 多智能体系统设计原则 (Multi-Agent Design Principles)

### 5.1 关注点分离 (Separation of Concerns)
每个Agent只负责一个明确的认知任务：
- **SemanticDistiller**：专注于NLU，不关心后续如何使用数据
- **PatternAnalyzer**：专注于辨证逻辑，不依赖具体实现细节
- **VectorTranslator**：专注于数学映射，独立于业务逻辑
- **CreativeCopywriter**：专注于文案生成，可复用模板或LLM
- **ValidatorOptimizer**：专注于质量验证，不修改业务逻辑

### 5.2 共享上下文 (Shared Context)
Agent间通过 `AgentContext` 对象传递状态：
```javascript
context.setIntermediate('moodData', result);        // Agent 1 输出
data = context.getIntermediate('moodData');         // Agent 2 输入
```
这种设计避免了复杂的参数传递，同时保留了完整的执行轨迹便于调试。

### 5.3 独立降级 (Independent Fallback)
每个Agent都有独立的错误处理和降级机制：
- Agent 1 失败 → 使用本地关键词分析
- Agent 4 失败 → 使用模板文案
- Agent 5 失败 → 返回警告但不阻断流程

### 5.4 可观测性 (Observability)
每个Agent输出结构化日志：
```
[AgentName] 执行完成 (duration ms)
   - 关键输出1: value1
   - 关键输出2: value2
```
开发者视图可清晰追踪每一步的执行结果。

## 6. 项目设计原则回顾
- **无状态化组件 (Stateless Preferred)**：通过自上而下传递 props 使呈现层高度纯粹，降低意外渲染。
- **最小破环面积 (Blast Radius)**：所有的功能扩充都尽量封闭在一套体系内（例如引擎分离），防止主线程 `App.js` 由于代码行数的膨胀导致认知过载。
  - **全链路超时与重试机制 (Resilient API)**：
    1. **统一重试算子 (`fetchWithRetry`)**：在 [llmProxy.js](file:///d:/AI/MixLab/moodmix-0228/server/llmProxy.js) 中封装了带退避策略的重试逻辑。针对网络底层报错 (ECONNRESET) 或 API 偶发抖动进行 3 次自动重连。
    2. **两阶段 JSON 提取 (Safe Parsing)**：后端代理增加了正则匹配与容错解析逻辑，强制确保即使大模型吐出 Markdown 代码块或多余文字，系统依然能稳健提取出合法 JSON 数据。
    3. **超时与截断协同 (`AbortController`)**：后端响应超时统一设定为 45s，通过 Abort 信号彻底绝除僵尸请求对 Node.js 内存与连接池的损耗。
  - **同理心 UX 设计 (Empathetic Loading)**：若模型由于重试或网络原因耗时过长，前端会自动转换安抚文案（从“正在深呼吸...”到“这杯酒需要多一点灵感...”），通过心理学预期管理降低用户焦虑。
  - **骨架屏与防御性 Skeleton**：移除静态死数据后，系统全面建立骨架防御，严防空值连环爆炸引发白屏。

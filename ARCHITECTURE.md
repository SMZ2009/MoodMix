# MoodMix 多智能体驱动架构 (Multi-Agent Architecture)

## 1. 核心架构概述 (Architectural Principles)
MoodMix 是一款基于**多代理协作 (MAS)** 与 **TCM 辨证哲学** 的 AI 特调引擎。项目核心旨在将人类模糊的主观情感，通过多级 Agent 蒸馏与逻辑重构，映射为高维物理风味空间中的精准坐标。

### 技术选型原则
- **高吞吐核心**: 基础处理链路采用 7B/8B 级模型实现毫秒级响应。
- **高品质内容**: 创意与逻辑质检链路路由至 32B 级中量级模型以确保输出质量。
- **关注点分离 (SoC)**: 每个 Agent 仅负责单一认知领域，通过统一的 `AgentContext` 互操作。

---

## 2. 智能体分工与模型矩阵 (Agent Matrix)

| 智能体 | 职责角色 | 驱动模型 (SiliconFlow) | 核心任务 |
| :--- | :--- | :--- | :--- |
| **SemanticDistiller** | NLU 传感器 | **Janus-Pro-7B** (or Qwen-7B) | 从非结构化文本中提取[情绪/躯体/认知/时间/诉求/社交]六维数据。 |
| **PatternAnalyzer** | 辨证分析师 | **Janus-Pro-7B** | 依据六维数据判定五行属性 (Wood/Fire/Earth/Metal/Water) 与调理策略。 |
| **VectorTranslator** | 空间翻译官 | **Janus-Pro-7B** | 将辨证结论转化为 8 维检索向量，动态配置维度权重。 |
| **CreativeCopywriter**| 意境文案师 | **Qwen2.5-32B-Instruct** | 生成包含 [状态] + [特征] + [动作] 的三段式感性推荐语。 |
| **MixologyExpert** | 调饮专家 | **Qwen2.5-7B-Instruct** | 负责[ANALYZE]风味分析、[ASSIST]制作指导、[SOCIAL_CARD]诗化卡片生成。 |
| **ValidatorOptimizer**| 质量质检员 | **Qwen2.5-7B-Instruct** | 审查全流程一致性，预防幻觉，授予“心味相合”等质量勋章。 |

---

## 3. 核心执行工作流 (Standard Workflow)

### 3.1 极速聚合路径 (High-Performance Path)
为了极致的用户响应体验，系统实现了 **Comprehensive Analyze** 端点。
1. **Agent 1-3 聚合**: 一次性将语义提取、辨证、向量映射封装在一个 LLM Prompt 中，减少 60% 的网络往返 (RTT)。
2. **本地向量引擎**: 采用加权余弦相似度算法 (Weighted Cosine Similarity) 在毫秒内完成 500+ 饮品库匹配。
3. **首屏渲染**: 优先展示匹配结果与基础信息，异步注入后续生成的 AI 文案。

### 3.2 深度创意/质检路径 (Deep Creative Path)
在首屏展示后，后台异步启动高参数量模型任务：
1. **创意润色**: `CreativeCopywriter` 启动 (Temperature=0.7)，生成具有画面颗粒度的感性文案。
2. **逻辑验证**: `ValidatorOptimizer` 交叉对比“辨证结论”与“推荐语”是否冲突（例如：心火旺者不应推荐过于辛热的饮品）。
3. **反馈勋章**: 验证通过后，前端动态点亮对应的“逻辑契合”勋章。

---

## 4. 目录职能划分 (Directory Concerns)

- **`src/agents/`**: 智能体核心逻辑。包含 `core/` (父类、上下文、编排器) 与 `specialized/` (具体 Agent 实现)。
- **`src/engine/`**: 物理引擎。负责 8D 向量搜索、五行生克逻辑计算。
- **`server/llmProxy.js`**: 智能路由层。负责 API Key 安全隔离，及根据任务性质将请求分发至 7B 或 32B 模型。
- **`src/store/`**: 持久化层。记录用户的情绪图谱与饮品收藏历史。

---

## 5. 饮品维度说明 (8-Dimension Vector)

饮品在系统中被抽象为以下 8 个数值维度：
1. **Taste (0-10)**: 主味强度（酸甜苦辛）。
2. **Texture (-3~3)**: 气机感（-3 下沉/静谧，3 上扬/灵动）。
3. **Temperature (-5~5)**: 阴阳属性（-5 极冰，0 常温，5 极热）。
4. **Element (1-5)**: 五行映射坐标。
5. **Time (0-23)**: 最佳适饮时辰映射。
6. **Aroma (0-10)**: 香气穿透力。
7. **ABV (0-95)**: 酒精百分比。
8. **Action (1-5)**: 冥想/社交场景推荐指数。

---

## 6. 开发与演进计划
- [x] 多智能体框架搭建 (MAS Core)
- [x] 聚合分析端点优化 (Compression)
- [x] 东方美学分享卡片重构 (DOM-to-Image)
- [ ] 离线 RAG 辅助配方搜索
- [ ] 个人专属 AI 调酒师模型微调 (LoRA)

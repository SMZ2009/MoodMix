# MoodMix 项目结构与逻辑架构

## 1. 项目概述 (Overview)
**MoodMix** 是一款创新的 AI 驱动“心境饮品搭配”应用。它能够将用户输入的抽象心情描述，利用大语言模型（LLM）精准解析为结构化的味觉和体感维度数据，进而通过专门的推荐引擎运算，与酒水库（鸡尾酒或无酒精饮品）进行高维度匹配，推荐出最符合用户当下情绪的饮品。

## 2. 宏观系统架构 (System Architecture)
项目采用了**前后端分离 + 多智能体协作（Multi-Agent System）**的架构范式：

*   **前端（Frontend / Client）**：基于 React (Create React App + TailwindCSS) 构建，承担富交互、动画特效及核心算法。
*   **多智能体系统（Multi-Agent System）**：核心推荐与辅助逻辑由 6 个专职 Agent 顺序/动态协作完成。
*   **微后端（Backend Proxy）**：轻量化 Express 服务，负责大模型 API 转发、Keys 隐藏及容灾调度。

### 2.1 多智能体矩阵 (The Agent Matrix)

| Agent | 名称 | 角色 | 核心职责 |
|:-----:|:-----|:-----|:---------|
| 1 | **SemanticDistiller** | NLU传感器 | 非结构化语义识别，提取6维心境数据 |
| 2 | **PatternAnalyzer** | 辨证分析师 | 东方哲学归纳，确定调理策略（生克/纠偏） |
| 3 | **VectorTranslator** | 向量翻译官 | 抽象空间映射，生成 8 维目标匹配向量 |
| 4 | **CreativeCopywriter** | 创意文案师 | 基于匹配结果生成有温度的诗化推荐语 |
| 5 | **MixologyExpert** | 调饮专家 | **(核心扩展)** 提供制作指导、原料替代方案及风味深度分析 |
| 6 | **ValidatorOptimizer** | 验证优化师 | 全流程一致性验证与质量评分，确保逻辑自洽 |

## 3. 核心目录职能 (Directory Concerns)

```text
moodmix/
├── server/
│   └── llmProxy.js             # 【代理层】对接 LLM，承载推荐与辅助接口
├── scripts/
│   └── batchGenerate.mjs       # 【工具层】离线向量推导工具
├── src/                        # 【源码层】
│   ├── agents/                 # 多智能体核心逻辑 (specialized/)
│   ├── engine/                 # 算法引擎：向量搜索、五行映射、相似度计算
│   ├── api/                    # 外部集成：MoodAnalyzer, QuoteGenerator
│   ├── components/             # UI 原子组件与功能模态框
│   ├── store/                  # 持久化存储 (localStorageAdapter)
│   ├── data/                   # 预置知识库、翻译字典
│   └── assets/                 # 视觉资源 (图片、图标)
└── AI_EXPERIENCE.md            # 项目开发经验沉淀池
```

## 4. 关键业务流路 (Workflows)

### 4.1. 心境解析推荐流 (Recommendation Flow)
1. **语义解析**: `SemanticDistiller` 将心情转为 6 维 JSON（情绪、躯体、时间等）。
2. **哲学建模**: `PatternAnalyzer` 进行五行辨证，定下“共鸣”或“对冲”基调。
3. **数学映射**: `VectorTranslator` 输出包含权重、味觉、烈度等维度的 8 维向量。
4. **向量引擎检索**: 在前端利用 `vectorEngine.js` 对 400+ 饮品执行加权余弦相似度计算。
5. **文案渲染**: `CreativeCopywriter` 动态生成推荐语，通过 CSS 渐变平滑展示。

### 4.2. 调饮辅助专家流 (Expert Support Flow)
- **风险规避**: `MixologyExpert` 在用户进入制作界面时，根据当前库存 (`inventory.js`) 自动提示缺少的替代配方。
- **风味深度**: 为自定义饮品提供 8 维分值推导，确保特调饮品也能参与系统匹配。

## 5. 设计原则 (Core Design Principles)
*   **关注点分离**: Agent 独立负责认知任务，通过 `AgentContext` 互操作。
*   **低延迟体验**: 两阶段渲染策略（本地预设文案 + 异步 LLM 注入）。
*   **高可靠性**: `fetchWithRetry` 机制与 `AbortController` 协同，防止请求积压。
*   **视觉卓越**: 深度集成 TailwindCSS 与原生意境动画，营造“赛博中式”氛围。

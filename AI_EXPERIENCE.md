# AI Experience Log

## 2026-03-01: API 超时重推与 UX 前端降焦虑

### 成功经验
1. **Node.js 后端强断绝等 (Stage 1)**: 前端如果是由用户的耐心耗尽或者 `setTimeout` 强制触发 `AbortError`，Node 后端 `node-fetch` 向第三方大模型厂商（SiliconFlow）发起的流如果不带中断信号，会变为幽灵请求（Zombie Request）堆积在内存。使用了 `AbortController` 绑定 50s 强制砍断后端挂起。
2. **多级重试缓冲 (Stage 2)**: 在之前仅仅为 30s 硬超时的 `moodAnalyzer.js` 里引入了由 `maxRetries: 2` 控制的针对 502/Gateway Timeout 等网络波动的自动重试逻辑。配合重试缓冲 `await new Promise(r => setTimeout(r, attempt * 1000))`，极大地提升了公用模型池在晚高峰的连接成功率，同时前端总超时放宽至 45s。
3. **同理心 UI 设计 (Stage 3)**: 将大模型生成长文本时的等待时间化作用户体验的一部分，当用户等待超过 15s 还没出结果时，利用动态 `setTimeout` 将按钮上的文案从“正在深呼吸...” 平缓切换为 “这杯酒需要多一点灵感...”。

### 注意事项
1. **React 渲染引用陷阱**: App.js 中的 `<MoodInputSection />` 原本在接收 `buttonFeedback` 时是一个对象 `useTouchFeedback` 返回的样式，为它加塞 `loadingText` 时，必须使用深展开 `{ ...buttonFeedback, loadingText: buttonLoadingText }` 而不能直接在子组件解构改写父级 hook 的只读原值。
2. **清理计时器**: 在 `App.js` `processMoodAndGenerate` 中定义的 `longWaitTimer` 务必确保在所有分支（包含 `return` 的短路退出，或者 `catch` 捕获的异常退出）以及成功的 `.then` 里执行 `clearTimeout(longWaitTimer)`，防止引发内存泄漏和错误的状态改变回拨。

## 2026-03-02: 动态大模型推荐语生成架构 (Live LLM Quotes Hydration)

### 成功经验
1. **异步骨架流 (Hydration)**: 抛弃“等大模型全部写完诗才给用户看列表”的愚蠢阻塞。前端直接依赖本地几十条静态五行语录秒出界面，同时在 React 的生命周期里发异步请求给后端，待大模型专供版词句返回后，通过 CSS opacity 渐变平滑替换。用户既有 0 延迟体验，又能收获定制惊喜。
2. **极简大锅炖 (Batch Prompt)**: 后端接口禁止 N 次独立的并发请求。使用 `Batch 请求` 把 Top 5 杯酒一次性拍扁成一个带格式的 JSON Array 让 LLM 批处理，将原先要耗费 5 倍时间的网络握手开销强行压回单次水平，既不超速也不熔断。
3. **哈希缓存滚雪球 (Fingerprint Caching)**: 利用“酒名 + 五行逻辑”作为联合主键存在 `localStorage`。大模型算过一次的酒，这辈子同心情下就不会再发第二次网路请求。随着使用时长增加，前端会逐渐长成一个 0 毫秒 0 Token 消耗的巨型专属文学库。

## 2026-03-02: 融合双轨制为统一排序 (Unified Blended Sorting)

### 成功经验
1. **打破硬过滤边界**: 之前的引擎采用了硬切分的“缺料分流”（有材料排一列、缺料作备胎），导致用户在缺料少于3个时，由于分水岭的存在而无法看到可能口味雷达匹配度非常逆天但仅仅缺3种料的神仙推荐。
2. **附加分代数系统 (Bonus Score System)**: 废除硬分流数组，改为向余弦相似度结算结果注入动态 Bonus (如缺0: `+0.15`, 缺1: `+0.08`, 缺2: `+0.03`)，把材料可得性直接当成总分项，实现列表连续性平滑过渡，这是一种产品表现层与底层匹配度的绝佳握手。

## 2026-03-01: 深度解构情绪解析链路架构

### 成功经验
1. **玄学物理化文档落地**: 面对用户提出原架构文档中关于“情绪映射原理”解释过浅的问题，直接用 Markdown 表格和公式图文并茂地呈现了底层黑盒逻辑。明确指出了大语言模型是如何利用“东方哲学”（五行与气机升降）作为桥接器，将抽象的人类感受（如烦躁）合法破译为具备刚性边界的客观物理参数（如 -5 冰度、36% ABV、5 级烈度摇晃）。
2. **KISS 原则贯穿表述**: 使用分步表述法（第一步结构化解析 -> 第二步引擎推演 -> 第三步双轨防空洞）让原本复杂的推荐连环套对所有开发者清晰可见。

## 2026-03-01: API 超时重推与 UX 前端降焦虑
1. **自动执行与高效交付**: 遵循用户“无需中途确认直接干到底”的规则，结合之前遗留的重构思路，在梳理源码与包结构后，快速产出了项目级的逻辑架构文档 (`ARCHITECTURE.md`)。
2. **KISS 原则理解透彻**: 快速抓取核心关注点（分离的 api, engine, components）。没有纠结在某一个细节里，而是拉高视野成功对全局链路（LLM 心境解析 + 外部饮品探索流 + 本地知识库脚本）完成了清晰归类。

### 注意事项
1. **系统整体健康度**: 目前项目使用了由 Create React App 和独立 Express 微后端（llmProxy.js, 处理跨域与防漏KEY）组成的代理设计。前端代理机制在开发时必须开启两个端口 (`npm run server` 和 `npm start`)，在未来的部署环境 (Production) 时，需确保这种代理请求被 Nginx 或者 Vercel 路由所接管。

## 2026-02-26: TheCocktailDB API 接入灵感库

### 成功经验
1. **API 数据转换层设计**: 将 API 扁平字段 (`strIngredient1~15`, `strMeasure1~15`) 转为结构化的 `ingredients` 数组。独立的 `transformDrink()` 函数使得视图组件无需关心 API 原始格式。
2. **最小影响范围**: 只改灵感库（Explore Tab），保留 Mix Tab 使用本地 `allDrinks` 数据不变，避免连锁影响。
3. **缓存机制**: 在 Hook 中使用 `useRef` 建立详情缓存和分类缓存，避免重复 API 请求。
4. **防抖搜索**: 搜索输入使用 500ms 防抖，空搜索使用 300ms 防抖回退随机加载。

### 注意事项
1. **TheCocktailDB `filter.php` 端点不返回详细数据**: 只有 idDrink、strDrink、strDrinkThumb 三个字段，需要二次请求 `lookup.php` 获取完整配料和制作说明。
2. **免费 API 无中文翻译**: `strInstructionsZH-HANS` 字段通常为 null。需要做降级处理。
3. **PowerShell 不支持 `&&` 连接符**: 在 Windows PowerShell 中应使用 `;` 或分开执行命令。
4. **收藏 ID 兼容**: API 饮品使用 `api_{idDrink}` 格式的 ID，与本地 drinks 的数字 ID 不冲突。

## 2026-02-26: 中文翻译功能（方案 C）

### 成功经验
1. **混合方案最优**: 本地字典（配料~200种、饮品~170种）覆盖高频内容精确翻译，翻译 API 处理变化多的长文本（制作步骤），两者互补。
2. **MyMemory 免费翻译 API**: 无需 API Key，5000字/天免费额度，用 `||| ` 分隔符合并多步骤一次翻译以减少请求次数。
3. **localStorage 缓存**: 翻译结果缓存在本地，同一步骤不会重复翻译，极大减少 API 调用。
4. **nameCn/nameEn 双字段**: 数据层同时保留中英文名称，UI 层灵活选择显示方式。

### 注意事项
1. **字典大小写不敏感匹配**: `translateIngredient` 和 `translateDrinkName` 都支持不区分大小写，因为 API 返回的大小写不一致。
2. **字典未命中回退**: 配料名未命中返回英文原文，饮品名未命中用英文作为主名称显示。
3. **步骤翻译时机**: 在 `loadDrinkDetail` 中翻译（用户点击进入详情时），而非全量加载时翻译（避免阻塞初始加载）。

## 2026-02-28: 八维饮品结构化数据引擎

### 成功经验
1. **配料知识库驱动**: 不依赖 AI 生成，建立配料级属性字典（五味/寒热/香气/颜色/ABV），通过规则引擎从配料组合自动推导饮品八维数据——可溯源、可查证。
2. **紧凑数组格式存储**: `ingredientKnowledgeBase.js` 用 `[cat, [s,b,sw,sp,sa], nature, ...]` 紧凑数组存储100+配料数据，运行时按需展开为对象，节省bundle体积。
3. **Measure解析器**: 完整处理 API 返回的各种度量格式（oz/cl/ml/tsp/dash/shot/cup/分数/范围值等）。
4. **装饰物体积修复**: Garnish 类配料（salt/olive/mint等）一律不计液体体积，即使 API 给出了数量值（如 "1" 颗 olive）。这避免了装饰物扭曲味觉加权计算。

### 注意事项
1. **Garnish 必须为 0ml**: API 的 `strMeasure` 对装饰物可能给出 `"1"` 这样的数值（如 1 颗橄榄），如果按默认逻辑会被解析成 1oz = 29.57ml，严重扭曲味觉和比例计算。解决方案：根据 `ingredientKnowledgeBase` 的 `cat` 字段判断是否为 garnish。
2. **盐边特殊逻辑**: Salt 虽然 0ml 体积，但作为味觉特征需要单独 +5 咸味值（盐边是 Margarita 的标志性特征）。
3. **五味加权是体积加权**: 用每种配料的 ml 占总液体体积的比例做加权平均，而非简单取最大值。这意味着高体积的中性配料（如苏打水）会稀释其他配料的味觉得分。
4. **PowerShell 不支持 `&&`**: 仍需注意在 Windows 上用 `;` 代替。

## 2026-02-28: DashScope 六维心境分析接入

### 成功经验
1. **Prompt 工程 — Structured Output**: 在 system prompt 中定义完整的 JSON Schema，配合 `response_format: { type: 'json_object' }` 参数，让大模型直接返回结构化的六维分析 JSON，比自由文本后解析更稳定。
2. **代理架构**: 前端(CRA) → Express 代理(3001端口) → DashScope API。CRA 的 `proxy` 配置自动转发 `/api/*` 请求，API Key 完全不暴露到前端。
3. **降级策略**: `moodAnalyzer.js` 包含完整的本地关键词降级方案，API 不可用时仍然能给出基础六维推断。
4. **数据校验合并**: `validateAndMerge()` 确保大模型返回的 JSON 缺少任何字段时，用默认值填充，前端永远拿到完整的六维结构。

### 注意事项
1. **node-fetch v3 是 ESM**: 在 CJS 的 Express 服务中需用 `const fetch = (await import('node-fetch')).default` 动态导入。
2. **启动顺序**: 必须先启动 `npm run server` (端口3001)，再启动 `npm start` (端口3000)。CRA 的 proxy 只在开发模式生效。
5. **六维 → 八维动态权重匹配**: 已完成从 `intensity` 提取动态权重并进行相似度评估的 `vectorEngine` 推荐引擎，支持库存双轨过滤。

## 2026-02-28: 硅基流动 API 与库房双轨匹配系统

### 成功经验
1. **模型更换极低成本**: 后端抽象代理层后，从 DashScope 切换到 SiliconFlow 仅需变更 endpoint、Keys、Model String，代码结构基本不用改动，证明代理层设计优越。
2. **强度系统化($I$)**: 将 Prompt Schema 改版，每个维度的 `intensity` 统一控制在 `0.0-1.0` 使得后续的余弦相似度加权公式( `W_final = W_base + Sum(Kappa * I)` )非常平滑好算。
3. **加权余弦相似度变体**: 对于环形数据（如时间 0-23 循环）和有限分类（颜色 1-5）、有负数区间的（温度 -5~5）实现了向最大正收益差值转换再作 Dot Product 的做法，保证了不同量级的维度平权。
4. **引擎分离**: `vectorEngine.js` 专门负责纯数字、向量数组和公式的推演，`App.js` 仅保留UI层逻辑，大幅降低主文件圈复杂度。

### 注意事项
1. **轨道标记穿透**: API与AllDrinks的融合（`allDrinks` 全维度，`apiDrinks` 是 CocktailDB 返回子集）在计算 missingCount 时，必须处理 `.ingredients` 和 `.briefIngredients` 两套结构。
2. **Promise.all 同步等待**: 必须用 `await Promise.all([analyzeMood, minDelay])`，防止动画直接跳没，保证 UX 前后端速率对齐。

## 2026-02-28: 静态数据移除与项目架构重组

### 成功经验
1. **彻底戒断本地静态预置物料**: 将原先包含静态饮品列表的 `drinks.js` 与冗余的 `exploreDrinks.js` 彻底移除。在前端组件中全面对接 `apiDrinks`。从根源杜绝了页面初始化、数据极度匮乏时强行插入不相关死数据的顽疾。
2. **KISS 原则主导的职责分离 (Separation of Concerns)**: 将之前臃肿、耦合在一起的 `src/data` 目录干净利落地切分为三大职能中心：
   - `src/api`: 接管包含 LLM、CocktailDB 在内的请求与对外通讯。
   - `src/engine`: 隔离提取专有的维度推演与复杂的向量生成算法。
   - `src/store`: 负责所有客户端级的本地缓存和收藏状态操作。
   - 这种正交拆分极大地提升了系统可读性和排错速度。
3. **安全的大型转移方案**: 在搬迁 8 个核心模块之前，利用正则精准扫描所有引用图集，随后使用批量替换一次性跨过所有断层，重新建联 `hooks`, `components` 与新的架构映射，直接通过了 Webpack 编译。

### 注意事项 (坑点预警)
1. **PowerShell Echo 的 BOM 陷阱**: 切勿使用 Windows 默认控制台符 `echo ... > file.js` 快速生成代码！这会在头部隐性注入 UTF-16 字节顺序戳 (BOM)，直接导致 Babel 这类只认 UTF-8 ASCII 的解析器当场崩溃报出 `Unexpected character ''`，甚至导致后台开发服务器被杀停。必须使用原生的 `fs.writeFileSync(..., 'utf8')` 或跨平台覆写。
2. **React 空值连环爆炸防线**: 移除一个静态占位数据（如原本保底的 `allDrinks`）不仅要在调用栈里查抄干净，更要严防它的消失引起传参空洞。当 API 未加载完成传进来 `[]` 时，如果不加 `?.` 与 `|| []` 的防空守卫，后续的 `drinks.map` 或 `.slice` 会直接在 Render 阶段抛出 TypeError 导致无端白屏退服。一定要设置具有结构字段合法性的防御性 Skeleton Data (骨架数据)。

## 2026-02-28: 移除无效的 React 默认图标引用

### 成功经验
1. **彻底清理脚手架遗留物**: Create React App 默认包含的 `logo192.png` 和 `logo512.png` 等文件如果被物理删除，必须同步前往 `public/index.html` 移除对应的 `<link rel="apple-touch-icon">` 节点，并在 `public/manifest.json` 里的 `icons` 数组清理对应声明，否则浏览器在初始化时会静默抛出大量 404 (Not Found) 及 Manifest 读取警告。基于 KISS 原则，如果应用暂时不需要这层 PWA 支持，直接删去空引用的性价比远高于补齐图片文件。

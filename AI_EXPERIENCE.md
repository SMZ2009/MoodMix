# AI Developer Experience & Lessons Learned

## 核心开发经验沉淀 (Core Experiences)

在此记录所有关键节点的成功经验与踩坑教训，以备后续接手任务时优先查阅，避免重复犯错。

### [2026-03-11] 替换 React/JSX 组件内大段代码的自动化策略
**Context**: 尝试在 `src/App.js` 中替换 `NavigationBar` 的大量 JSX 标签，并注入全新的 SVG 自定义组件。
**Issue**: 使用标准的 `replace_file_content` 工具时，如果 `TargetContent` 块较大，或者是由于多行文本中潜藏了不可见的换行符（CRLF vs LF）、空格对齐差异等，极其容易导致 `target content not found in file` 报错，反复失败。
**Solution**:
1. 不要死磕大块的 Strict Text Matching 修改。
2. 迅速利用 `write_to_file` 临时写一个短小精悍的 Node.js/Regex 小脚本（如 `replace_nav.js`）。
3. 使用 `[fs.readFileSync]` 读取目标文件内容，用稳定的 `content.replace(Regex, newContent)` 来精确或模糊替换，然后 `fs.writeFileSync` 写回。
4. 跑完脚本后清理临时文件并验证修改结果。这种方案对超大单个 React 组件文件（动辄 2000 行）极为稳健高效，且容错率高。

### [2026-03-11] 优化毛笔白描风 SVG 在纯色背景下的视觉重量 (Visual Weight Adjustment)
**Context**: 仅使用 `stroke` 描边在移动端或小尺寸导航栏中容易显得单薄。
**Solution**:
1. 增大基础尺寸（例如将非激活状态大小从 24px 提高到 26px）。
2. 同时开启 `fill="currentColor"`，并通过 `style={{ fillOpacity: 0.2 }}` (或 SVG 属性 `fill-opacity="0.2"`) 来添加一种极弱的半透明填色感。
3. 这样的处理既保留了线条画（线稿）的结构和东方通透感，又让图标中心有了“实体感”和色彩反馈，极大地提升了点击区域的可视度和高级感。

### [2026-03-11] 原料管理弹窗改造：搜索式交互 + 东方韵味统一
**Context**: 需将首页原料管理弹窗从简单标签列表改为搜索式交互，同时UI风格从现代扁平紫粉系改为一致的东方水墨韵味。
**Key Decisions**:
1. 利用 localStorageAdapter.js 中已有的 STANDARD_INGREDIENTS（约90种标准原料，含中英文名+分类），扁平化后作为搜索数据源，无需新增API。
2. 使用独立的CSS类名前缀 ingredient-* 避免与已有组件样式冲突。
3. 在无法 replace_file_content 操作 CSS（CRLF换行符问题）时，继续使用 Node.js 脚本方案高效安全修改。
4. 配色走暖灰+古铜/青瓷色系，字体统一宋体楷体，标签使用不规则 border-radius 营造水墨点染感。
### [2026-03-11] React Key 唯一性防范 (Duplicate Key Prevention)
**Context**: 在 `IngredientEditModal.js` 中使用原料名称作为渲染 Key 时，因原始数据未去重导致控制台报错。
**Solution**:
1. 在使用 `map` 渲染列表标签（如原料、筛选条件）时，优先使用数据库唯一 ID（如 `ing_id`）。
2. 如果必须使用名称/文本作为 Key，务必在数据流入口（如 `useEffect`）或数据聚合层（如 `useMemo`）进行显示去重：`[...new Set(list)]`。
3. 即使在 `handleAdd` 函数中做了包含检查，也要在多来源数据合并处强制加固，防止非正常路径注入脏数据导致渲染异常。

### [2026-03-11] “薄雾琉璃”材质实现规范 (Frosted Glass/Glassmorphism Patterns)
**Context**: 将 UI 材质从实心“宣纸”进化为“薄雾琉璃”，解决背景遮挡和厚重感痛点。
**Solution**:
1. **基底参数**: 使用极强模糊 `backdrop-filter: blur(40px) saturate(1.2)` 配合极淡白色背景 `rgba(255, 255, 255, 0.08)`。
2. **气韵融合**: 必须去掉 `bg-white` 类，改用内联样式或自定义 CSS 类。容器描边使用 `rgba(255, 255, 255, 0.15)` 营造光影切面，配合 `box-shadow` 的 `inset` 实现边缘内发光。
### 薄雾琉璃/玻璃拟态 (Glassmorphism) 排版与色彩法则
在将实心弹窗向重度玻璃拟态（`backdrop-blur-3xl`, `bg-white/5`）迁移时，务必注意**视觉穿透性带来的文本对比度灾难**：

1. **底色穿透陷阱**：原本在实色浅背景上非常清晰的深褐/水墨色文本（如 `rgba(42,40,38)`），一旦置于透明背板上，底层（深蓝紫水彩等）深色会穿透磨砂层，导致深色文本失去对立性。
2. **反转升华**：对于深色打底的玻璃材质，必须将体系反转为“流光色系”。
   - **标题**采用高反差白：`rgba(255,255,255,0.95)`。可外加 1px 细微黑色投影：`text-shadow: 0 1px 4px rgba(0,0,0,0.4)` 给文字增加骨架。
   - **副标题/正文**采用霜银：`rgba(255,255,255,0.65)`。
   - **操作元素**采用流光香槟金：`rgba(235, 215, 175, 0.95)`，呼应东方高级感。
3. **东方美学兼容**：从“水墨纸本”升级为“星夜空灵”，无需死守深色文字，黑即是白，白即是黑，核心在于整体意境的“呼吸感”。配合 `box-shadow` 的 `inset` 实现边缘内发光。
3. **蒙版减重**: 背景遮罩层（Backdrop）从深黑色改为极淡灰色 `rgba(0, 0, 0, 0.18)`，并将模糊度提升至 `12px` 以上。这样蒙版本身不再是“遮挡物”，而是让整个视口进入一种沉浸式的“水雾态”。
4. **内部冲突**: 琉璃底色上忌用实心米色组件。内部输入框、按钮需同步调整为更轻盈的半透明白色系，否则会出现视觉脏感。

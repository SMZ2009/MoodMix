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

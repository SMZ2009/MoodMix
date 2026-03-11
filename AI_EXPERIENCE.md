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

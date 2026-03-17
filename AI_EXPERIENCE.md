# AI 经验沉淀 (AI_EXPERIENCE.md)

## 2026-03-16 字体 CDN 优化与回退治理
- **问题**: Google Fonts 原生域名在国内访问极不稳定，且项目中缺乏完善的系统字体回退链。
- **解决方案**: 
  - 使用 `fonts.loli.net` 作为国内镜像源。
  - 在 `font-family` 中显式指定 `STSongti-SC`, `Songti SC`, `SimSun`, `Source Han Serif SC` 作为 `Noto Serif SC` 的回退路径。
- **教训/经验**:
  - 在使用 PowerShell `Set-Content` 处理由于大量内联定义的复杂 CSS 文件时，极其容易发生编码或行重叠导致的 corruption。**建议优先使用精确的单元测试级替换工具（如 `replace_file_content`）或在执行全局脚本前务必进行本地备份及编码检查。**
  - 内联样式的字体定义容易被全局替换脚本遗漏，必须在 `App.js` 等逻辑文件中进行深度关键字扫描。
- **UI 文本查找**: 对于 `findstr` 等工具无法检索到的中文文本（可能受限于文件编码），使用 PowerShell 的 `Select-String` 往往更有效，且能更清晰地定位到组件文件（如 `MineSection.js`）。

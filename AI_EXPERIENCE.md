# AI 经验沉淀 (AI_EXPERIENCE.md)

## 2026-03-16 字体 CDN 优化与回退治理
- **问题**: Google Fonts 原生域名在国内访问极不稳定，且项目中缺乏完善的系统字体回退链。
- **解决方案**: 
  - 使用 `fonts.loli.net` 作为国内镜像源。
  - 在 `font-family` 中显式指定 `STSongti-SC`, `Songti SC`, `SimSun`, `Source Han Serif SC` 作为 `Noto Serif SC` 的回退路径。
- **教训/经验**:
  - 在使用 PowerShell `Set-Content` 处理由于大量内联定义的复杂 CSS 文件时，极其容易发生编码或行重叠导致的 corruption。**建议优先使用精确的单元测试级替换工具（如 `replace_file_content`）或在执行全局脚本前务必进行本地备份及编码检查。**
  - 内联样式的字体定义容易被全局替换脚本遗漏，必须在 `App.js` 等逻辑文件中进行深度关键字扫描。
- **Express 路由优先级**: 在 `server/llmProxy.js` 中定义 API 时，必须确保通配符 404 处理器 (`app.use((req, res) => ...)`) 位于所有有效路由之后。否则，任何在它之后定义的路由都将被截断并返回 404。
- **全站弹窗 UI 统一项目**: 优先保证全站 Modal 的 Glassmorphism 风格一致。
- **“去黑化”设计**: 原有黑色实色按钮全部替换为 `glass-primary` 和 `glass-secondary` 变体，提升通透感。
- **高对比度适配 (Contrast Fix)**: 玻璃态背景下文字必须使用深色 (#1a1a1a) 或高不透明度深灰色 (#4a4a4a)，严禁使用白色或浅灰色，否则会导致可读性灾难。
- **嵌套数据解析**: 在解析后端 `successResponse` 时，务必检查数据是否按 `data` 键名嵌套。例如 `agentResult.data?.copy` 而非 `agentResult.copy`。
- **健壮性兜底**: API 调用（如 `social-card-copy`）必须包含本地模板作为 fallback，确保网络抖动时不影响核心交互。
- **Glassmorphism 实现关键点**: 使用 `backdrop-filter: blur()` 实现磨砂玻璃感时，配合 `rgba()` 背景色与细微的内阴影 (`box-shadow`) 能显著提升高级感。在 Tailwind 环境下，将高频复用的玻璃规范抽离为全局 CSS 类（如 `.glass-card`、`.glass-tag`）是维护全站视觉一致性的最佳实践。
- **UI 文本查找**: 对于 `findstr` 等工具无法检索到的中文文本（可能受限于文件编码），使用 PowerShell 的 `Select-String` 往往更有效，且能更清晰地定位到组件文件（如 `MineSection.js`）。
- **Glassmorphism 实现**: 复现高质感玻璃态（液态玻璃）时，核心在于 `backdrop-filter` (blur + saturate)、多重 `box-shadow` (含内发光) 以及极其细微的边框透明度。在 Tailwind 环境下，通过全局 CSS 变量管理这些复杂的阴影和颜色，比直接写 inline class 更易维护且视觉更统一。
- **复杂组件重构与代码冗余治理**: 在对 `App.js` 等超大型文件（3000+ 行）进行并发重构时，极其容易由于闭合标签错误或重复粘贴导致逻辑错位。
  - **经验**: 使用 `view_file` 配合精确的 `line_number` 锁定变动范围，并在大规模重构后务必扫描文件尾部，清理非预期的重复 `export` 或组件定义。
  - **视觉统一**: 针对全站多种弹窗（如 `IngredientEditModal`、`GroupRecommendationModal` 等），通过提取核心玻璃态 CSS 类并配合系统级阴影（如 `shadow-2xl`），可以在保持功能特性的同时实现品牌视觉的高度凝练。
  - **后端路由稳健性**: 再次验证了 Express 路由顺序的重要性。特定参数化的子路由（如 `/api/drink/like-stats/:id`）必须置于宽泛的模糊匹配或中间件逻辑之前，以防止意外的 404 响应。
- **UI 统一与样式覆盖优先级 (2026-03-17)**: 
  - **Inline Style vs CSS Class**: 发现 `InteractiveButton` 等封装组件如果内部硬编码了 `style` (background/color)，外部传入的 CSS 类无法通过普通方式覆盖（除非用 `!important`）。**最佳实践**是为封装组件增加 variant (如 `glass-primary`)，在组件内部定义对应样式逻辑，确保风格切换的确定性。
  - **全站弹窗字体对齐**: 针对非系统默认字体的应用（如 `Songti SC`, `Noto Serif SC`），需同时在 `index.css` 全局类和特定弹窗组件的内联 `style` 中完成双向覆盖，以应对复杂的嵌套层级和样式隔离。
  - **“全黑”按钮治理**: 在深色背景或玻璃态弹窗中，避免使用纯黑背景按钮。采用 `rgba(255, 255, 255, 0.75)` 配合 `backdrop-filter` 能在保证对比度的同时维持通透感。

## 2026-03-17 社区图标设计与功能上线
- **视觉一致性**: 在为现有导航系统设计新图标时，使用 `generate_image` 配合精准的 Prompt（如“Oriental Chic”, “modern ink wash painting style”）可以生成与现有手绘/水墨资产高度匹配的素材。
- **资源管理**: 生成的图标需及时复制到 `src/assets` 并按命名规范（如 `nav_icon_community.png`）接入组件。若生成资产带有白边且背景为浅色，可利用 `mix-blend-mode: multiply` 在 CSS 层级实现“模拟扣图”效果。
- **即将上线功能 (Coming Soon) UX**: 对于未完全开放的功能，若需保持图标色彩，则仅在文字和按钮状态（`disabled`, `text-gray-400`）上体现禁用感。这样可以在引导用户期待的同时，维持界面的色彩和谐。
- **代码死活逻辑检查**: 在开启“即将上线”的功能时，除了修改 UI 状态，务必检查主应用逻辑中是否已存在对应的渲染分支或路由，避免重复劳动。本次操作发现 `App.js` 已预留 `community` 渲染分支，仅需打通导航入口。

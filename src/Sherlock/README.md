# Sherlock（神探夏洛克：伦敦博弈场）

前端界面源码位于 `界面/主界面/`（`index.html` + `index.tsx`），与 `src/角色卡示例/界面/*` 相同，由仓库根目录的 Webpack 打包。

在项目根目录执行 `pnpm build` 或 `pnpm watch`，产物为 `dist/Sherlock/界面/主界面/index.html`，可嵌入酒馆消息楼层 iframe。

## LLM 交互（与 mhjg 模板对齐，未修改 `src/mhjg`）

- 流程：`createChatMessages(user)`（携带 MVU `data`）→ `generate({ should_stream: true })` → 校验 `<maintext>` / `<option>` → `Mvu.parseMessage` → `createChatMessages(assistant)` → 可选 `checkAndUpdateChronicleSherlock`（需配置世界书）。
- 标签解析与选项拆分见 `界面/主界面/lib/storyTags.ts`。
- 统一请求实现见 `界面/主界面/lib/sherlockRequestHandler.ts`。
- 读档 / 正文回顾：`界面/主界面/lib/sherlockSaveLoad.ts`（`/branch-create`、`<maintext>` 串联）。

### 配置世界书（可选）

编辑 `界面/主界面/lib/sherlockConfig.ts`：将 `SHERLOCK_WORLDBOOK_NAME` 设为你的角色卡世界书名称；并确保存在与 `开局COT` / `COT` / `编年史` 同名的条目（名称可改常量）。留空则跳过 COT 切换与编年史写入，其余对话与 MVU 仍可用。

### 离线预览

未检测到酒馆助手 API 时，聊天区展示内置示例对话（仅 UI），输入框会提示需在酒馆中加载。

---

## 嵌入与故障排除（白屏 / 无显示）

以下问题曾在本项目中出现，修复方式均写在**仓库根目录 `webpack.config.ts`**，修订 Sherlock 或排查「界面不显示」时请先对照本节。

### 现象 A：界面完全白屏（含 iframe `src` 直接打开、或酒馆内嵌）

**原因：** 默认 Webpack 会把部分 npm 依赖改成**运行时从 jsdelivr 用 `import` 拉取**（如 `clsx`、`tailwind-merge`、`scheduler`）。若当前环境**访问不了该 CDN**（离线、防火墙、内网等），脚本在开头就失败，页面空白。

**修复：** 在 `webpack.config.ts` 的 `externals` 里对上述包走 **`callback()`（打入 bundle）**，不再走 `module-import https://testingcf.jsdelivr.net/...`。搜索 `bundle_npm_instead_of_cdn` 可定位。

**你需要做的：** 修改依赖或 webpack 后重新 `pnpm build` / `pnpm watch`，再使用新的 `dist/Sherlock/界面/主界面/index.html`。

---

### 现象 B：只能用 jQuery `$('body').load('…/index.html')` 注入时无显示（正则替换等场景）

**原因：** 打包产物默认是 **`<script type="module">` 的 ES 模块**。通过 **`$.load()` 插入到当前文档**时，浏览器/jQuery **不会执行**这类模块脚本，React 不会挂载，表现为无显示。

**说明：** 项目规则里推荐用 **iframe 的 `src`** 指向 `index.html`（整页加载，模块可执行）。若业务上**只能**用 `load` 注入，则必须让该入口输出**经典脚本**。

**修复：** 对 **`src/Sherlock/界面/主界面/index.tsx`** 单独配置（搜索 `jqueryLoadCompatHtml`）：

- `experiments.outputModule: false`
- 不为该入口设置 `output.library: { type: 'module' }`（输出 IIFE 风格、可内联执行）
- `HtmlWebpackPlugin` 对该入口使用 `scriptLoading: 'blocking'`（普通 `<script>`，无 `type="module"`）

**你需要做的：** 同样重新打包后再用原来的 `$('body').load('http://…/dist/Sherlock/界面/主界面/index.html')`。若仍失败，检查 **CORS**（`$.load` 为跨域 AJAX）及浏览器控制台红色报错。

---

### 给下次修订的简短提示（可复制给 AI）

> Sherlock 白屏：先查是否仍从 jsdelivr 拉 `clsx`/`tailwind-merge`/`scheduler`；再查若用 `$.load` 注入，Sherlock 入口是否仍为 **非 module** 的 IIFE + `blocking` 脚本。相关逻辑均在根目录 `webpack.config.ts`。

---

### 现象 C：聊天首层仍显示 `<StatusPlaceHolderImpl/>` 纯文本（状态栏未加载）

**常见原因：** 酒馆「正则脚本 / 自动替换」里虽然写了替换 `<StatusPlaceHolderImpl/>`，但 **仅勾选了「AI 输出」**，而首条消息往往是 **用户** 楼层，正则不会执行。

**推荐修复（二选一或同时用）：**

1. **改正则作用范围**：在角色卡或全局正则中，找到替换 `<StatusPlaceHolderImpl/>` 的那条，将 **用户输入** 也勾选为 true（与「AI 输出」一致），替换内容为你的 Sherlock 界面地址（优先 **iframe `src` 指向** 打包后的 `dist/Sherlock/界面/主界面/index.html` 的 URL；若用 jQuery `load` 注入，需满足上文「现象 B」中的脚本格式要求）。
2. **后台脚本兜底**：打包并启用 `src/Sherlock/脚本/状态栏占位修复/index.ts`。在 **该脚本的脚本变量** 中设置 `sherlock_iframe_url` 为你的 `index.html` 完整可访问 URL（与酒馆同域或允许 iframe 嵌入）。脚本会在 `APP_READY` / 切换聊天时，把首层消息里的占位符换成 iframe。

UI 侧「翻书开局」与首层占位无关：占位是 **消息正文** 里的标签；开局表单在界面内完成，完成后由 `gameInitializer` 写入 0 层变量并生成首条 assistant。

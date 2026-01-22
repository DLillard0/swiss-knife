# 构建说明与常见问题（pnpm + Vite + crxjs）

本项目使用 `pnpm` + `vite` + `@crxjs/vite-plugin` 打包 MV3 Chrome 扩展。

## 常用命令

- **构建**：`pnpm build`
- **调试构建日志（可选）**：`SWISS_KNIFE_DEBUG_BUILD=1 pnpm build`

## 常见问题

### 1) Rollup 无法解析 `d3-sankey`（来自 mermaid）

**现象**

构建时报错类似：

- `Rollup failed to resolve import "d3-sankey" from ".../mermaid/.../sankeyDiagram-*.mjs"`

**原因**

`mermaid` 的 Sankey 图模块会 `import { sankey, ... } from "d3-sankey"`，在 `pnpm` 严格依赖树下，如果项目未安装 `d3-sankey`，Rollup 会直接失败。

**当前仓库的处理**

- 通过 Vite `resolve.alias` 把 `"d3-sankey"` 指向 `src/shims/d3-sankey.ts`（一个 shim），从而让构建通过。
- 如果运行期真的渲染 Sankey 图，shim 会抛出清晰错误提示你安装真实依赖。

**更彻底的修复（推荐）**

在可联网环境下安装真实依赖：

```bash
pnpm add d3-sankey
```

然后可以移除 shim 和 alias（视需要）。

### 2) `[crx:manifest-post] ENOENT: Could not load manifest asset "assets/katex.min-<hash>.js"`

**现象**

构建后期报错类似：

- `[crx:manifest-post] ENOENT: Could not load manifest asset "assets/katex.min-xxxx.js"`

**原因（背景）**

项目使用 `streamdown` 渲染 Markdown/数学公式。它在检测到公式时会动态加载 KaTeX 样式，Vite 会生成类似：

- `assets/katex.min-<hash>.js`（动态加载 wrapper）
- `assets/katex.min-<hash>.js.map`（sourcemap）
- 以及 KaTeX 字体等资源

`@crxjs/vite-plugin` 在 `manifest-post` 阶段会校验 `manifest` 中列出的资源是否存在于：

- **Rollup bundle** 或
- **磁盘的 project root / public 目录**

在某些版本组合/边界情况下，会出现“manifest 要求某个 `assets/katex.min-*.js`，但校验时在 bundle 里认为不存在”的情况，从而触发 `ENOENT`。

**当前仓库的处理**

在 `vite.config.ts` 增加了一个小插件 `swiss-knife:ensure-katex-css-wrapper`：

- 在 `generateBundle` 阶段把 bundle 内的 `assets/katex.min-*.js` 和 `.map` **镜像写入** `public/assets/`。
- 这样即便 `crx:manifest-post` 走了磁盘 fallback，也能找到文件，避免 `ENOENT`。

> 注意：这些文件是构建生成物，已在 `.gitignore` 中忽略：
> - `public/assets/katex.min-*.js`
> - `public/assets/katex.min-*.js.map`


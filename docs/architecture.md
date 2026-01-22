# 项目骨架说明

## 技术栈
- 包管理：pnpm
- 构建：Vite + @crxjs/vite-plugin（Manifest V3）
- 前端：React + TypeScript + TailwindCSS（shadcn/ui 基础样式）
- AI SDK：已预置 `ai`、`@ai-sdk/openai`、`@ai-sdk/react`

## 目录结构
- `src/extension/manifest.ts`：扩展清单（MV3），定义 popup / background / content-script
- `src/extension/background.ts`：后台入口，已含 onInstalled 与 PING 示例
- `src/extension/content-script.tsx`：内容脚本入口，挂载一个可见的浮层占位
- `src/extension/popup/`：弹窗页面（React）
- `src/components/ui/`：基础 UI 组件（已提供 Button）
- `src/styles/globals.css`：Tailwind + shadcn 基础样式变量
- `public/icons/`：16/48/128 尺寸占位图标

## 开发与构建
```bash
pnpm install
pnpm dev      # Vite 开发模式，建议配合 Chrome 加载 dist 调试
pnpm build    # 产物输出到 dist，可直接在 Chrome 扩展页加载
pnpm lint     # ESLint（flat config）
pnpm typecheck
```

## 调试建议
1. `pnpm build` 生成 `dist`，在 Chrome 扩展管理页开启开发者模式并“加载已解压的扩展程序”。
2. 打开任意页面，选中文本后应在选区附近出现工具栏（content-script）；也可通过 popup/快捷键触发打开/关闭。
3. 在 background/popup/content-script 分别打开 DevTools 查看日志或网络请求。

## 后续扩展提示
- AI 接入：
  - **调用侧（background）**：统一使用 AI SDK（例如 `streamText`）调用 OpenAI 兼容接口。
  - **展示侧（content-script）**：
    - AI 交互：使用 `@ai-sdk/react` 的 UI hooks（例如 `useCompletion`），并将逻辑抽离为 `src/extension/components/ai-tool-interaction.tsx`。
    - 渲染：使用 `ai-elements` 的 `MessageResponse`（基于 Streamdown）渲染 markdown/代码块等富文本。
  - **传输侧（扩展内部）**：使用 `chrome.runtime.connect` Port 将 `textDelta` 分片从 background 推送到 content-script（避免一次性字符串回传）。
- 工具编排：可在 background 维护工具清单，通过 `chrome.runtime.sendMessage` 与页面交互。
- 样式体系：Tailwind 配置已添加 `tailwindcss-animate` 和基础色板，可按需补充 shadcn 组件。

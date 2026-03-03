# Tool

一个 tool 代表一个自定义工具，所以自定义工具都是一个流程：在网页被触发 -> 采集页面对应数据生成 prompt 发送给 ai -> 在网页上展示 ai 的回复

## Tool 的可配置项目

1. tool 的名称，必须是唯一的
2. tool 的图标，图标库使用 lucide-react，供用户选择
3. tool 的 system 提示词（新增配置项），会在发送给 ai 的时候作为 system role 发送，不可使用 collection（即不允许出现 `{{...}}` 占位符）
4. tool 的提示词，在调用的时候会将提示词发送给 ai，同时可以使用占位符，例如 `{{selection}}`，这样会在页面上收集当前的 collection 信息替换掉这个占位符去发送给 ai
5. 触发方式，当前有两种触发方式：1. 划词触发 tool bar，2. 为每个 tool 配置自己的快捷键直接运行。可以同时启用这两种方式
6. 工具排序：在配置页可拖拽排序把手，决定 tool bar 中的展示顺序

## 默认工具说明

- 默认工具的核心配置（名称/图标/提示词等）不可修改，始终以插件内置的最新定义为准。
- 仅允许调整展示相关配置：是否在 toolbar 展示、是否启用快捷键与快捷键内容、以及拖拽排序位置。

### 当前内置默认工具

- `翻译`：英译中，针对单词和短语/句子使用不同输出格式。
- `总结`：对页面正文进行中文简洁总结。
- `英译`：将中文翻译成地道英文，通常给出最多 3 种常用表达并说明语气差异。

## 提示词建议

- 对于包含 `context` 的工具，`context` 只用于理解/消歧 `selection`，不应直接复述或输出整段上下文。

## 当前实现说明

### 触发方式

- **划词触发 tool bar**：当用户在页面上划词并松开鼠标后（selection 非空），会自动弹出 tool bar。
- **工具栏全局开关快捷键**：仍保留 **Ctrl/Command + Shift + K** 用于打开/关闭 tool bar（通常需要页面上存在 selection 才会展示）。
- **工具快捷键直接运行**：每个 tool 可配置自己的快捷键；当命中快捷键时，不弹出 tool bar，而是直接发起 AI 请求并展示结果弹窗。

### 弹窗与位置策略

- **跟随滚动**：tool bar 与结果弹窗使用 selection 的页面坐标作为锚点，页面滚动时会跟随更新位置。
- **上下位置判断**：结果弹窗优先展示在 selection 下方；若下方空间不足且上方空间充足，则展示在上方；两侧空间都不足时会在视口内尽量可见。
- **手动拖拽**：tool bar 与结果弹窗支持拖拽（拖动工具栏背景或结果弹窗头部），拖拽后位置会固定在视口内。

### 快捷键触发的额外规则

1. **collection 为空不触发**：若 tool 的提示词中使用到了某个 collection（如 `{{selection}}`），但当前页面采集到的该 collection 为空，则按下该 tool 的快捷键也不会触发执行。
2. **无 collection 时居中展示**：若 tool 的提示词中没有使用任何 collection（不包含任何 `{{...}}` 占位符），则结果弹窗会在屏幕正中间显示。

### 运行流程

1. **触发**：划词或快捷键打开 tool bar。
2. **采集**：目前仅采集 `selection`（见 `docs/collection.md`）。
3. **渲染提示词**：将提示词中的 `{{selection}}` 替换为采集到的内容。
4. **调用 AI（流式）**：
   - AI 交互逻辑抽离为 `src/extension/components/ai-tool-interaction.tsx`（内部使用 `@ai-sdk/react` 的 `useCompletion`）。
   - 通过自定义 `fetch` 将一次 completion 请求适配为 `chrome.runtime.connect` Port 通道。
   - background（service worker）收到 Port 请求后，使用 AI SDK `streamText` 生成回复，并按 `textDelta` 分片推送给前端。
5. **展示结果（流式）**：content-script 使用 `ai-elements` 的 `MessageResponse`（基于 Streamdown）渲染 AI 回复，支持 markdown/代码块；并提供 **停止**、**复制**。

### 配置入口

- 在扩展 “选项” 页中新增了 **Tool 管理**，可新增/编辑/删除工具，并配置提示词与触发方式。
- Tool 管理列表支持拖拽排序，排序结果会持久化到 `chrome.storage.sync`，并实时同步到 content-script 的工具栏。
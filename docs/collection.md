# Collection

collection 表示的是当前页面可采集的信息，这些信息会在 tool 的 prompt 中替换掉对应的占位符一起发送给 ai。

## 当前可用的 Collection

1. selection：表示当前用户划词的内容（会被替换到提示词中的 `{{selection}}`）

2. selection-context：表示当前划词内容所在 DOM 节点（更准确说是 selection 的 anchor / focus 所在节点的父容器）下的**整个文本内容**。如果 selection 跨越多个 DOM，会将这些 DOM 的 text 按顺序组合到一起（会被替换到提示词中的 `{{selection-context}}`）

3. page-content：表示当前页面的正文文本（优先 Readability 提取，失败则从 article/main/body 降级提取）（会被替换到提示词中的 `{{page-content}}`）

## 采集规则（当前实现）

- **触发时机**：用户在页面上鼠标抬起（`mouseup`）且 selection 非空时采集。
- **清洗**：对 selection 做 `trim()` 去掉首尾空白。
- **缺失处理**：
  - 在渲染提示词时，若提示词包含 `{{selection}}` 但当前 selection 为空，会被替换为空字符串。
  - 但当 tool 通过“工具快捷键”触发时，如果提示词包含 `{{selection}}` 且当前 selection 为空，则该快捷键不会触发执行（避免发送无意义请求）。

- **page-content 采集规则**：
  - **触发时机**：tool 运行时按需采集（不依赖 selection）。
  - **正文提取**：优先用 Readability 解析；失败则从 `article` / `[role="article"]` / `main` / `body` 降级抽取。
  - **清洗**：压缩空白与多余换行；超长截断。
  - **缺失处理**：空内容时返回空字符串，快捷键触发会被拦截（避免无意义请求）。
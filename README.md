# Swiss Knife

一个可自定义的 AI 工具箱 Chrome 扩展，支持在任意网页上快速触发工具、采集页面内容并展示 AI 回复。适合把高频 AI 工作流固化为一键工具。

## 特性

- 自定义工具：为不同场景配置独立的提示词、图标与触发方式
- 多种触发：划词触发工具栏、全局快捷键、工具专属快捷键
- 页面采集：支持 `selection` / `selection-context` / `page-content`
- 流式响应：基于 AI SDK 流式输出，结果弹窗可停止、复制
- MV3 架构：Vite + @crxjs/vite-plugin 打包
- 组件体系：React + TypeScript + TailwindCSS + shadcn/ui + ai-elements

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

### 2) 开发模式

```bash
pnpm dev
```

随后在 Chrome 扩展管理页打开开发者模式，加载 `dist` 目录进行调试。

### 3) 构建发布

```bash
pnpm build
```

产物会输出到 `dist`，可在 `chrome://extensions/` 中“加载已解压的扩展程序”。

## 配置说明

进入扩展“选项”页配置：

- `api base url`：OpenAI 兼容接口地址（例如 `https://api.example.com/v1`）
- `token`：调用接口所需密钥
- `model`：模型名称，留空时使用默认值（当前为 `gpt-3.5-turbo`）

更多细节见 `docs/config.md`。

## 自定义工具

每个工具是一个完整流程：触发 → 采集 → 组装提示词 → 调用 AI → 展示结果。当前支持：

- 工具名称、图标与 system 提示词配置
- Prompt 占位符：`{{selection}}` / `{{selection-context}}` / `{{page-content}}`
- 划词触发、全局快捷键、工具快捷键
- 工具排序（拖拽）

更多细节见 `docs/tool.md` 与 `docs/collection.md`。

## 目录结构

```
src/
  extension/       # 扩展入口（background / content-script / popup / options）
  components/      # 通用组件（含 ai-elements 与 shadcn/ui）
  default-tools/   # 内置工具示例
  styles/          # 全局样式
```

完整说明见 `docs/architecture.md`。

## 文档索引

- 架构说明：`docs/architecture.md`
- 构建与常见问题：`docs/build.md`
- 配置说明：`docs/config.md`
- Tool 机制：`docs/tool.md`
- Collection 规则：`docs/collection.md`

## 贡献

欢迎提交 Issue / PR。建议先阅读文档了解工具与采集机制，并尽量附带测试步骤或复现方式。

## License

MIT

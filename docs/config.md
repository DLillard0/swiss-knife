# 插件可配置项目

配置入口：Chrome 扩展管理页 → 详情 → “扩展程序选项”，或在地址栏访问 `chrome://extensions/` 后点击 Swiss Knife 的“扩展程序选项”。

1. api base url：调用 AI 接口的基础地址，示例 `https://api.example.com/v1`。
2. token：调用 AI 接口的 token（建议使用只读或临时密钥）。
3. model：传递给 AI 接口的 `model` 参数（字符串）。留空时将使用默认值（当前为 `gpt-3.5-turbo`）。

存储方式：以上配置保存在 `chrome.storage.sync`，可通过 `getExtensionConfig()` 读取，定义见 `src/extension/storage/config.ts`。

## 测试连接

在“扩展程序选项”页点击“测试连接”会通过 **AI SDK** 向你配置的 OpenAI 兼容接口发送一条 `hello`（会带上你填写的 `model`）。
若能拿到非空的回复文本（AI SDK 返回的 `text`），则判定测试通过。
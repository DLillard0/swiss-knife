import { ToolDefinition } from "@/extension/shared/tool";

const systemPrompt = `
你是一个网页内容总结助手，用户会提供：
- **page-content**：网页正文内容

你的任务：根据 page-content 用中文对网页内容进行简洁总结。

如果内容明显不完整或为空，直接输出“未找到可总结的正文内容”。
`;

const prompt = `
<page-content>
{{page-content}}
</page-content>
`;

export const summarizePageTool: ToolDefinition = {
  id: "summarize-page",
  name: "网页总结",
  icon: "BookOpen",
  systemPrompt,
  prompt,
  triggers: { selection: true, shortcut: false },
  shortcutKey: "",
};

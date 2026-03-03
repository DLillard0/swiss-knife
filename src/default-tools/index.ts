import { ToolDefinition } from "@/extension/shared/tool";
import { translateTool } from "./translate";
import { summarizePageTool } from "./summarize-page";
import { zhToEnTool } from "./zh-to-en";

const DEFAULT_TOOLS: ToolDefinition[] = [
  translateTool,
  summarizePageTool,
  zhToEnTool
];
const DEFAULT_TOOL_ID_SET = new Set(DEFAULT_TOOLS.map((tool) => tool.id));

const cloneTool = (tool: ToolDefinition): ToolDefinition => ({
  ...tool,
  triggers: { ...tool.triggers }
});

export function getDefaultTools(): ToolDefinition[] {
  return DEFAULT_TOOLS.map(cloneTool);
}

export function isDefaultToolId(id: string): boolean {
  return DEFAULT_TOOL_ID_SET.has(id);
}

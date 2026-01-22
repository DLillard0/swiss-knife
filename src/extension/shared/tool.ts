export type ToolTrigger = {
  /** 划词触发：当用户在页面产生 selection 时显示 tool bar */
  selection: boolean;
  /** 快捷键触发：当用户使用工具自身快捷键时直接运行 tool */
  shortcut: boolean;
};

export type ToolIconName =
  | "Sparkles"
  | "Wand2"
  | "ScanText"
  | "MessageCircle"
  | "ClipboardCopy"
  | "BookOpen"
  | "Search"
  | "Lightbulb"
  | "Zap"
  | "Puzzle";

export type ToolDefinition = {
  /** 稳定 id（用于引用/删除/运行），不要求用户可读 */
  id: string;
  /** 用户可见名称，必须唯一 */
  name: string;
  /** lucide-react 图标名 */
  icon: ToolIconName;
  /**
   * tool 的 system 提示词：在发送给 AI 时作为 system role 注入。
   * 注意：该字段不支持使用 collection（即不允许出现 {{...}} 占位符）。
   */
  systemPrompt?: string;
  /** 提示词模板，支持 {{selection}} / {{selection-context}} / {{page-content}} 占位符 */
  prompt: string;
  triggers: ToolTrigger;
  /**
   * 工具快捷键（可选）。格式建议：Ctrl+Shift+K / Command+Shift+K / Mod+Shift+K
   * - 当 triggers.shortcut=true 且 shortcutKey 非空时才会生效
   */
  shortcutKey?: string;
};

export type Collections = {
  selection?: string;
  /** selection-context：划词所在 DOM（或跨多个 DOM）的上下文文本 */
  "selection-context"?: string;
  /** page-content：整页正文文本（基于 Readability 或降级提取） */
  "page-content"?: string;
};

export type CollectionKey = keyof Collections;

export function createId(): string {
  try {
    // MV3 + 现代浏览器环境通常可用
    return crypto.randomUUID();
  } catch {
    return `tool_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export function normalizeToolName(name: string): string {
  return name.trim();
}

export function renderPrompt(template: string, collections: Collections): string {
  return template
    .replace(/\{\{\s*selection\s*\}\}/g, collections.selection ?? "")
    .replace(
      /\{\{\s*selection-context\s*\}\}/g,
      collections["selection-context"] ?? ""
    )
    .replace(
      /\{\{\s*page-content\s*\}\}/g,
      collections["page-content"] ?? ""
    );
}

export function getUsedCollections(template: string): CollectionKey[] {
  const used = new Set<CollectionKey>();
  if (/\{\{\s*selection\s*\}\}/g.test(template)) used.add("selection");
  if (/\{\{\s*selection-context\s*\}\}/g.test(template)) used.add("selection-context");
  if (/\{\{\s*page-content\s*\}\}/g.test(template)) used.add("page-content");
  return Array.from(used);
}

export function hasAnyTemplatePlaceholder(input: string): boolean {
  return /\{\{[\s\S]*?\}\}/.test(input);
}

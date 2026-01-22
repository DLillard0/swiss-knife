import { getDefaultTools } from "@/default-tools";
import {
  createId,
  normalizeToolName,
  type ToolDefinition,
} from "../shared/tool";

const STORAGE_KEY = "swissKnifeTools";

function getFromStorage<T>(keys: string | string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result as T);
    });
  });
}

function setToStorage(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export async function getTools(): Promise<ToolDefinition[]> {
  const result = await getFromStorage<Record<string, ToolDefinition[]>>(
    STORAGE_KEY
  );
  const stored = result?.[STORAGE_KEY];
  const defaults = getDefaultTools();
  if (!Array.isArray(stored) || stored.length === 0) return defaults;

  const defaultById = new Map(defaults.map((tool) => [tool.id, tool]));
  const usedDefaultIds = new Set<string>();
  const merged: ToolDefinition[] = [];

  for (const tool of stored) {
    const defaultTool = tool?.id ? defaultById.get(tool.id) : null;
    if (defaultTool) {
      merged.push({
        ...defaultTool,
        triggers: tool?.triggers
          ? { ...defaultTool.triggers, ...tool.triggers }
          : defaultTool.triggers,
        shortcutKey:
          typeof tool?.shortcutKey === "string"
            ? tool.shortcutKey
            : defaultTool.shortcutKey
      });
      usedDefaultIds.add(defaultTool.id);
      continue;
    }
    if (tool?.id) merged.push(tool);
  }

  for (const tool of defaults) {
    if (!usedDefaultIds.has(tool.id)) merged.push(tool);
  }

  return merged;
}

export async function saveTools(tools: ToolDefinition[]): Promise<void> {
  await setToStorage({
    [STORAGE_KEY]: tools,
  });
}

export async function upsertTool(input: ToolDefinition): Promise<void> {
  const tools = await getTools();
  const normalized: ToolDefinition = {
    ...input,
    name: normalizeToolName(input.name),
    prompt: input.prompt,
  };

  const idx = tools.findIndex((t) => t.id === normalized.id);
  const next = [...tools];
  if (idx >= 0) next[idx] = normalized;
  else next.unshift(normalized);
  await saveTools(next);
}

export async function createTool(
  partial?: Partial<ToolDefinition>
): Promise<ToolDefinition> {
  const tool: ToolDefinition = {
    id: createId(),
    name: partial?.name?.trim() || "新工具",
    icon: partial?.icon ?? "Sparkles",
    systemPrompt: partial?.systemPrompt ?? "",
    prompt: partial?.prompt ?? "请基于以下内容回答：\n\n{{selection}}",
    triggers: partial?.triggers ?? { selection: true, shortcut: false },
    shortcutKey: partial?.shortcutKey ?? "",
  };
  await upsertTool(tool);
  return tool;
}

export async function deleteTool(toolId: string): Promise<void> {
  const tools = await getTools();
  await saveTools(tools.filter((t) => t.id !== toolId));
}

export async function resetToolsToDefault(): Promise<void> {
  await saveTools(getDefaultTools());
}

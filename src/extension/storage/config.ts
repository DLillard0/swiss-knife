export type ResultPanelPosition =
  | "default"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ExtensionConfig = {
  apiBaseUrl: string;
  token: string;
  model: string;
  resultPanelPosition: ResultPanelPosition;
  /** 最多保留多少条历史记录；0 表示禁用历史 */
  maxHistorySize: number;
  /** 唤起最近一条历史结果的快捷键（为空表示未配置） */
  historyLastShortcut: string;
  /** 唤起历史列表面板的快捷键（为空表示未配置） */
  historyListShortcut: string;
};

export const STORAGE_KEY = "swissKnifeConfig";

const HISTORY_SIZE_MIN = 0;
const HISTORY_SIZE_MAX = 200;
const DEFAULT_HISTORY_SIZE = 20;

const VALID_POSITIONS: ReadonlySet<ResultPanelPosition> = new Set([
  "default",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right"
]);

const DEFAULT_CONFIG: ExtensionConfig = {
  apiBaseUrl: "",
  token: "",
  model: "",
  resultPanelPosition: "default",
  maxHistorySize: DEFAULT_HISTORY_SIZE,
  historyLastShortcut: "",
  historyListShortcut: ""
};

function normalizePosition(value: unknown): ResultPanelPosition {
  return typeof value === "string" && VALID_POSITIONS.has(value as ResultPanelPosition)
    ? (value as ResultPanelPosition)
    : DEFAULT_CONFIG.resultPanelPosition;
}

function normalizeHistorySize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CONFIG.maxHistorySize;
  }
  const clamped = Math.max(HISTORY_SIZE_MIN, Math.min(HISTORY_SIZE_MAX, Math.floor(value)));
  return clamped;
}

function normalizeShortcut(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

export async function getExtensionConfig(): Promise<ExtensionConfig> {
  const result = await getFromStorage<Record<string, ExtensionConfig>>(STORAGE_KEY);
  const stored = result?.[STORAGE_KEY];

  return {
    apiBaseUrl: stored?.apiBaseUrl?.trim() ?? DEFAULT_CONFIG.apiBaseUrl,
    token: stored?.token?.trim() ?? DEFAULT_CONFIG.token,
    model: stored?.model?.trim() ?? DEFAULT_CONFIG.model,
    resultPanelPosition: normalizePosition(stored?.resultPanelPosition),
    maxHistorySize: normalizeHistorySize(stored?.maxHistorySize),
    historyLastShortcut: normalizeShortcut(stored?.historyLastShortcut),
    historyListShortcut: normalizeShortcut(stored?.historyListShortcut)
  };
}

export async function saveExtensionConfig(config: ExtensionConfig): Promise<void> {
  const normalized: ExtensionConfig = {
    apiBaseUrl: config.apiBaseUrl.trim(),
    token: config.token.trim(),
    model: config.model.trim(),
    resultPanelPosition: normalizePosition(config.resultPanelPosition),
    maxHistorySize: normalizeHistorySize(config.maxHistorySize),
    historyLastShortcut: normalizeShortcut(config.historyLastShortcut),
    historyListShortcut: normalizeShortcut(config.historyListShortcut)
  };

  await setToStorage({
    [STORAGE_KEY]: normalized
  });
}

export async function clearExtensionConfig(): Promise<void> {
  await setToStorage({
    [STORAGE_KEY]: { ...DEFAULT_CONFIG }
  });
}

export function getDefaultConfig(): ExtensionConfig {
  return { ...DEFAULT_CONFIG };
}

export const HISTORY_LIMITS = {
  min: HISTORY_SIZE_MIN,
  max: HISTORY_SIZE_MAX
};

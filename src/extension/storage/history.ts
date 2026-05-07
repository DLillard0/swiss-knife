export type ResultRecord = {
  id: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  /** 划词文本的截断（最长 ~200 字符） */
  selectionExcerpt: string;
  /** 完整 AI 输出（已截断防止超出 storage 配额） */
  completion: string;
  createdAt: number;
};

export const HISTORY_STORAGE_KEY = "swissKnifeResultHistory";

const SELECTION_EXCERPT_MAX = 200;
const COMPLETION_MAX = 60_000;

function getFromLocal<T>(keys: string | string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result as T);
    });
  });
}

function setToLocal(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function isResultRecord(value: unknown): value is ResultRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<ResultRecord>;
  return (
    typeof r.id === "string" &&
    typeof r.toolId === "string" &&
    typeof r.toolName === "string" &&
    typeof r.toolIcon === "string" &&
    typeof r.selectionExcerpt === "string" &&
    typeof r.completion === "string" &&
    typeof r.createdAt === "number"
  );
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max);
}

export async function getResultHistory(): Promise<ResultRecord[]> {
  try {
    const result = await getFromLocal<Record<string, unknown>>(HISTORY_STORAGE_KEY);
    const raw = result?.[HISTORY_STORAGE_KEY];
    if (!Array.isArray(raw)) return [];
    return raw.filter(isResultRecord);
  } catch {
    return [];
  }
}

export async function appendResultRecord(
  record: Omit<ResultRecord, "id" | "createdAt"> & { id?: string; createdAt?: number },
  maxSize: number
): Promise<void> {
  if (maxSize <= 0) return;
  const list = await getResultHistory();
  const next: ResultRecord = {
    id:
      record.id ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    toolId: record.toolId,
    toolName: record.toolName,
    toolIcon: record.toolIcon,
    selectionExcerpt: truncate(record.selectionExcerpt, SELECTION_EXCERPT_MAX),
    completion: truncate(record.completion, COMPLETION_MAX),
    createdAt: record.createdAt ?? Date.now()
  };
  const merged = [next, ...list].slice(0, maxSize);
  await setToLocal({ [HISTORY_STORAGE_KEY]: merged });
}

export async function clearResultHistory(): Promise<void> {
  await setToLocal({ [HISTORY_STORAGE_KEY]: [] });
}

export async function trimResultHistory(maxSize: number): Promise<void> {
  if (maxSize <= 0) {
    await clearResultHistory();
    return;
  }
  const list = await getResultHistory();
  if (list.length <= maxSize) return;
  await setToLocal({ [HISTORY_STORAGE_KEY]: list.slice(0, maxSize) });
}

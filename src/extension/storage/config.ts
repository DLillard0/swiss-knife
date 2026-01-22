export type ExtensionConfig = {
  apiBaseUrl: string;
  token: string;
  model: string;
};

const STORAGE_KEY = "swissKnifeConfig";
const DEFAULT_CONFIG: ExtensionConfig = {
  apiBaseUrl: "",
  token: "",
  model: ""
};

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
    model: stored?.model?.trim() ?? DEFAULT_CONFIG.model
  };
}

export async function saveExtensionConfig(config: ExtensionConfig): Promise<void> {
  const normalized: ExtensionConfig = {
    apiBaseUrl: config.apiBaseUrl.trim(),
    token: config.token.trim(),
    model: config.model.trim()
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

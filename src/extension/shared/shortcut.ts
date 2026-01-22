export type ShortcutSpec = {
  /** Ctrl on Windows/Linux */
  ctrl: boolean;
  /** Command (Meta) on macOS */
  meta: boolean;
  /** Alt / Option */
  alt: boolean;
  shift: boolean;
  /** Mod 表示 Ctrl 或 Command（二者任一） */
  mod: boolean;
  /** 规范化后的 key（单字符为大写，如 K / 1；其它保持语义化，如 ArrowUp / F1） */
  key: string;
};

function normalizeKeyToken(token: string): string {
  const t = token.trim();
  if (!t) return "";
  if (t.length === 1) return t.toUpperCase();
  // 常见别名处理
  const lower = t.toLowerCase();
  if (lower === "esc") return "Escape";
  if (lower === "return") return "Enter";
  if (lower === "space") return " ";
  return t;
}

export function parseShortcut(input: string): ShortcutSpec | null {
  const raw = input.trim();
  if (!raw) return null;

  const parts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  let ctrl = false;
  let meta = false;
  let alt = false;
  let shift = false;
  let mod = false;
  let key = "";

  for (const part of parts) {
    const p = part.trim();
    const lower = p.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      ctrl = true;
      continue;
    }
    if (lower === "cmd" || lower === "command" || lower === "meta") {
      meta = true;
      continue;
    }
    if (lower === "alt" || lower === "option") {
      alt = true;
      continue;
    }
    if (lower === "shift") {
      shift = true;
      continue;
    }
    if (lower === "mod") {
      mod = true;
      continue;
    }

    // 非修饰键：只允许一个
    if (key) return null;
    key = normalizeKeyToken(p);
  }

  if (!key) return null;
  return { ctrl, meta, alt, shift, mod, key };
}

function normalizeEventKey(e: KeyboardEvent): string {
  const k = e.key;
  if (!k) return "";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

export function matchesShortcut(e: KeyboardEvent, spec: ShortcutSpec): boolean {
  if (e.repeat) return false;

  const key = normalizeEventKey(e);
  if (!key) return false;

  // key 允许大小写无关（已规范化）
  if (key !== spec.key) return false;

  // 修饰键要求“精确匹配”（避免 Ctrl+K 误触发到 Ctrl+Shift+K）
  if (spec.shift !== e.shiftKey) return false;
  if (spec.alt !== e.altKey) return false;

  // Ctrl/Command：支持 mod（Ctrl 或 Command 任一）
  if (spec.mod) {
    if (!(e.ctrlKey || e.metaKey)) return false;
  } else {
    if (spec.ctrl !== e.ctrlKey) return false;
    if (spec.meta !== e.metaKey) return false;
  }

  return true;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}


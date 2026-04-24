import {
  StrictMode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  ClipboardCopy,
  Lightbulb,
  MessageCircle,
  Puzzle,
  ScanText,
  Search,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";

import type { SkMessage } from "./shared/messages";
import {
  getUsedCollections,
  renderPrompt,
  type Collections,
  type ToolDefinition,
} from "./shared/tool";
import { Readability, isProbablyReaderable } from "@mozilla/readability";
import {
  isEditableTarget,
  matchesShortcut,
  parseShortcut,
} from "./shared/shortcut";
import { getTools } from "./storage/tools";
import {
  AiToolInteraction,
  type ToolRunRequest,
} from "./components/ai-tool-interaction";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import contentScriptCss from "./content-script.css?inline";
import katexCss from "katex/dist/katex.min.css?inline";

const mountId = "swiss-knife-root";
const TOOLBAR_HEIGHT = 44;
const MAX_PAGE_CONTENT_CHARS = 12000;

const ICONS = {
  Sparkles,
  Wand2,
  ScanText,
  MessageCircle,
  ClipboardCopy,
  BookOpen,
  Search,
  Lightbulb,
  Zap,
  Puzzle,
} satisfies Record<string, React.ComponentType<{ className?: string }>>;

type PanelState =
  | { open: false }
  | {
      open: true;
      anchor: { x: number; y: number };
      mode: "tools" | "result";
      placement?: "anchored" | "center" | "manual";
    };

function ContentShell() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [selection, setSelection] = useState("");
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [result, setResult] = useState<{ toolName: string } | null>(null);
  const [run, setRun] = useState<ToolRunRequest | null>(null);
  const selectionAnchorsRef = useRef<{
    x: number;
    yTop: number;
    yBottom: number;
    rectTop: number;
    rectBottom: number;
  } | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(420);
  const [scrollPos, setScrollPos] = useState({
    x: window.scrollX,
    y: window.scrollY,
  });

  const collectSelectionText = useCallback(() => {
    return window.getSelection()?.toString()?.trim() ?? "";
  }, []);

  const collectSelectionContextText = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount <= 0 || sel.isCollapsed) return "";

    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const root: Element | null =
      common.nodeType === Node.ELEMENT_NODE
        ? (common as Element)
        : common.parentElement;
    if (!root) return "";

    const normalize = (input: string) => input.replace(/\s+/g, " ").trim();
    const parents: Element[] = [];
    const seen = new Set<Element>();
    const MAX_PARENTS = 200;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent || !node.textContent.trim())
          return NodeFilter.FILTER_REJECT;
        try {
          return range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        } catch {
          return NodeFilter.FILTER_REJECT;
        }
      },
    });

    let node: Node | null = walker.nextNode();
    while (node && parents.length < MAX_PARENTS) {
      const el = (node as Text).parentElement;
      if (el && !seen.has(el)) {
        seen.add(el);
        parents.push(el);
      }
      node = walker.nextNode();
    }

    const texts = parents
      .map((el) => normalize(el.textContent ?? ""))
      .filter((x) => !!x);
    if (texts.length) return texts.join("\n");

    // fallback：极端情况下（比如无法遍历到 text node），尝试用 anchor/focus 的父元素
    const anchorEl =
      sel.anchorNode instanceof Element
        ? sel.anchorNode
        : sel.anchorNode?.parentElement ?? null;
    const focusEl =
      sel.focusNode instanceof Element
        ? sel.focusNode
        : sel.focusNode?.parentElement ?? null;
    const fallbackParents = [anchorEl, focusEl].filter(
      (x): x is Element => !!x
    );
    const uniq: Element[] = [];
    for (const el of fallbackParents) {
      if (!uniq.includes(el)) uniq.push(el);
    }
    return uniq
      .map((el) => normalize(el.textContent ?? ""))
      .filter((x) => !!x)
      .join("\n");
  }, []);

  const collectPageContentText = useCallback(() => {
    const normalize = (input: string) =>
      input
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const clamp = (input: string) =>
      input.length > MAX_PAGE_CONTENT_CHARS
        ? input.slice(0, MAX_PAGE_CONTENT_CHARS)
        : input;

    try {
      const documentClone = document.cloneNode(true) as Document;
      if (isProbablyReaderable(documentClone)) {
        const article = new Readability(documentClone).parse();
        const text = normalize(article?.textContent ?? "");
        if (text) return clamp(text);
      }
    } catch {
      // 忽略 Readability 的解析异常，走降级方案
    }

    const fallbackRoot =
      document.querySelector("article, [role='article'], main") ??
      document.body;
    const fallbackText = normalize((fallbackRoot as HTMLElement).innerText ?? "");
    return clamp(fallbackText);
  }, []);

  const collectSelectionAnchors = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount <= 0) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || rect.width + rect.height <= 0) return null;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const x = rect.left + rect.width / 2 + scrollX;
    const yBottom = rect.bottom + 8 + scrollY;
    // toolbar 需要“整个悬浮在 selection 上方”，所以 top 需要减去自身高度
    const yAbove = rect.top - 8 - TOOLBAR_HEIGHT;
    const margin = 12;
    const yTopViewport = yAbove < margin ? rect.bottom + 8 : yAbove;
    const yTop = yTopViewport + scrollY;
    const rectTop = rect.top + scrollY;
    const rectBottom = rect.bottom + scrollY;
    return { x, yTop, yBottom, rectTop, rectBottom };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getTools();
        setTools(list);
      } catch (e) {
        const message = e instanceof Error ? e.message : "未知错误";
        console.warn("[Swiss Knife] load tools failed:", message);
      }
    };
    load();

    const onChanged: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== "sync") return;
      if (changes?.swissKnifeTools) load();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrollPos({ x: window.scrollX, y: window.scrollY });
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const toolsForSelection = useMemo(
    () => tools.filter((t) => t.triggers.selection),
    [tools]
  );
  const shortcutBindings = useMemo(() => {
    return tools
      .filter((t) => t.triggers.shortcut && (t.shortcutKey ?? "").trim())
      .map((tool) => {
        const spec = parseShortcut(tool.shortcutKey ?? "");
        return spec ? { tool, spec } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [tools]);

  const openAt = useCallback(
    (
      anchor: { x: number; y: number },
      mode: "tools" | "result",
      placement: "anchored" | "center" | "manual" = "anchored"
    ) => {
      setPanel({ open: true, anchor, mode, placement });
    },
    []
  );

  const closePanel = useCallback(() => {
    setPanel({ open: false });
    setRun(null);
  }, []);

  const toggleToolbar = () => {
    // 没有 selection 时不展示 toolbar，且确保关闭
    if (!selection.trim()) {
      closePanel();
      return;
    }

    if (panel.open) {
      closePanel();
      return;
    }
    const anchors = selectionAnchorsRef.current;
    if (!anchors) {
      closePanel();
      return;
    }
    openAt({ x: anchors.x, y: anchors.yTop }, "tools");
  };

  useEffect(() => {
    const onMessage = (message: SkMessage) => {
      if (message?.type === "SK_TOGGLE_TOOLBAR") {
        toggleToolbar();
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.open, shortcutBindings.length]);

  useEffect(() => {
    const handleMouseUp = () => {
      const target = window.getSelection()?.anchorNode ?? null;
      const targetNode =
        target instanceof Element ? target : target?.parentElement ?? null;
      if (
        targetNode &&
        (toolbarRef.current?.contains(targetNode) ||
          resultPanelRef.current?.contains(targetNode))
      ) {
        return;
      }
      const trimmed = collectSelectionText();
      setSelection(trimmed);

      if (!trimmed) {
        closePanel();
        return;
      }
      if (toolsForSelection.length === 0) return;

      // 使用 selection 的视口坐标作为锚点：toolbar 在上方，结果弹窗在下方
      const anchors = collectSelectionAnchors();
      if (!anchors) return;
      selectionAnchorsRef.current = anchors;
      openAt({ x: anchors.x, y: anchors.yTop }, "tools");
    };

    document.addEventListener("mouseup", handleMouseUp, true);
    return () => document.removeEventListener("mouseup", handleMouseUp, true);
  }, [
    closePanel,
    openAt,
    toolsForSelection,
    collectSelectionText,
    collectSelectionAnchors,
  ]);

  // 当 selection 被清空时，自动关闭 toolbar（防止残留在页面上）
  useEffect(() => {
    if (!selection.trim() && panel.open && panel.mode === "tools") {
      closePanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const runTool = useCallback(
    async (
      tool: ToolDefinition,
      collectionsOverride?: Collections,
      placement: "anchored" | "center" | "manual" = "anchored"
    ) => {
      // 注意：AI 交互逻辑已抽离到 AiToolInteraction 组件
      // 点击工具后立刻展示结果弹窗（loading），位置在 selection 下方
      setResult({ toolName: tool.name });
      const usedCollections = getUsedCollections(tool.prompt);
      const collections: Collections = collectionsOverride ?? {};
      if (
        usedCollections.includes("selection") &&
        typeof collections.selection !== "string"
      ) {
        collections.selection = selection || collectSelectionText();
      }
      if (
        usedCollections.includes("selection-context") &&
        typeof collections["selection-context"] !== "string"
      ) {
        collections["selection-context"] = collectSelectionContextText();
      }
      if (
        usedCollections.includes("page-content") &&
        typeof collections["page-content"] !== "string"
      ) {
        collections["page-content"] = collectPageContentText();
      }

      if (typeof collections.selection === "string")
        setSelection(collections.selection.trim());

      // 规则 2：提示词没用到任何 collection，则结果居中
      const finalPlacement =
        usedCollections.length === 0 ? "center" : placement;

      let anchor: { x: number; y: number };
      if (finalPlacement === "center") {
        anchor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      } else {
        // 尽量锚定在 selection 下方（如果有 selection）
        const anchors =
          collectSelectionAnchors() ?? selectionAnchorsRef.current;
        if (anchors) {
          selectionAnchorsRef.current = anchors;
          anchor = { x: anchors.x, y: anchors.yBottom };
        } else {
          anchor = { x: window.innerWidth - 24, y: 120 };
        }
      }

      openAt(anchor, "result", finalPlacement);

      const prompt = renderPrompt(tool.prompt, collections);
      setRun({
        key: `${tool.id}:${Date.now()}`,
        tool,
        prompt,
        collections,
      });
    },
    [
      collectSelectionAnchors,
      collectSelectionContextText,
      collectSelectionText,
      collectPageContentText,
      openAt,
      selection,
    ]
  );

  // 工具级快捷键：命中后直接运行 tool（不弹工具栏）
  useEffect(() => {
    if (shortcutBindings.length === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      for (const binding of shortcutBindings) {
        if (!matchesShortcut(e, binding.spec)) continue;

        const usedCollections = getUsedCollections(binding.tool.prompt);
        const collections: Collections = {};

        if (usedCollections.includes("selection")) {
          collections.selection = collectSelectionText();
          if (!collections.selection) {
            // 规则 1：提示词用到了 collection，但当前页面对应 collection 为空，则不触发
            return;
          }
        }
        if (usedCollections.includes("selection-context")) {
          collections["selection-context"] = collectSelectionContextText();
          if (!collections["selection-context"]) {
            // 规则 1：提示词用到了 collection，但当前页面对应 collection 为空，则不触发
            return;
          }
        }
        if (usedCollections.includes("page-content")) {
          collections["page-content"] = collectPageContentText();
          if (!collections["page-content"]) {
            // 规则 1：提示词用到了 collection，但当前页面对应 collection 为空，则不触发
            return;
          }
        }

        // 真正触发时再阻止默认行为，避免误吞掉页面快捷键
        e.preventDefault();
        e.stopPropagation();

        void runTool(
          binding.tool,
          collections,
          usedCollections.length === 0 ? "center" : "anchored"
        );
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [
    shortcutBindings,
    collectSelectionText,
    collectSelectionContextText,
    collectPageContentText,
    runTool,
  ]);

  const panelAnchorY = panel.open ? panel.anchor.y : undefined;
  const panelMode = panel.open ? panel.mode : undefined;
  const panelPlacement = panel.open ? panel.placement : undefined;
  const visibleTools = useMemo(() => {
    if (!panel.open) return [];
    // 如果是 selection 面板（由 selection 事件打开），显示 selection tools；否则显示 shortcut tools
    const anchors = selectionAnchorsRef.current;
    const isLikelySelection =
      !!selection && !!anchors && panelAnchorY === anchors.yTop;
    // 兼容旧逻辑：当不是 selection 打开的面板时，只展示“启用了快捷键且配置合法”的工具
    const toolsForShortcut = shortcutBindings.map((b) => b.tool);
    return isLikelySelection
      ? toolsForSelection
      : toolsForShortcut.length
      ? toolsForShortcut
      : tools;
  }, [
    panel.open,
    panelAnchorY,
    selection,
    tools,
    toolsForSelection,
    shortcutBindings,
  ]);

  const isToolbar = panel.open && panel.mode === "tools";

  const startDrag = useCallback(
    (event: React.PointerEvent, target: HTMLDivElement | null) => {
      if (!panel.open || !target) return;
      if (event.button !== 0) return;
      const targetNode = event.target instanceof Element ? event.target : null;
      if (targetNode?.closest("button")) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = target.getBoundingClientRect();
      dragRef.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };

      setPanel((prev) => {
        if (!prev.open) return prev;
        return {
          ...prev,
          placement: "manual",
          anchor: {
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY,
          },
        };
      });
    },
    [panel.open]
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragRef.current;
      if (!dragState) return;

      const margin = 12;
      const maxLeft = window.innerWidth - dragState.width - margin;
      const maxTop = window.innerHeight - dragState.height - margin;
      const nextLeft = Math.min(
        Math.max(event.clientX - dragState.offsetX, margin),
        maxLeft
      );
      const nextTop = Math.min(
        Math.max(event.clientY - dragState.offsetY, margin),
        maxTop
      );

      setPanel((prev) => {
        if (!prev.open) return prev;
        return {
          ...prev,
          placement: "manual",
          anchor: {
            x: nextLeft + dragState.width / 2 + window.scrollX,
            y: nextTop + window.scrollY,
          },
        };
      });
    };

    const onPointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isToolbar) return;
    const el = toolbarRef.current;
    if (!el) return;

    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w && Number.isFinite(w)) setToolbarWidth(w);
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isToolbar, visibleTools.length]);

  const panelStyle: React.CSSProperties | undefined = useMemo(() => {
    if (!panel.open) return undefined;
    if (panel.mode === "result" && panel.placement === "center") {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const margin = 12;
    const width = isToolbar ? toolbarWidth : 320;
    const anchorX = panel.anchor.x - scrollPos.x;
    const anchorY = panel.anchor.y - scrollPos.y;
    const x = Math.min(
      Math.max(anchorX - width / 2, margin),
      window.innerWidth - width - margin
    );
    const y = Math.min(Math.max(anchorY, margin), window.innerHeight - margin);
    return { left: x, top: y };
  }, [panel, isToolbar, toolbarWidth, scrollPos]);

  useLayoutEffect(() => {
    if (
      !panel.open ||
      panelMode !== "result" ||
      panelPlacement === "center" ||
      panelPlacement === "manual"
    )
      return;
    if (panelAnchorY == null) return;
    const anchors = selectionAnchorsRef.current;
    const el = resultPanelRef.current;
    if (!anchors || !el) return;

    const margin = 12;
    const height = el.getBoundingClientRect().height;
    if (!height || !Number.isFinite(height)) return;

    const viewportTop = anchors.rectTop - scrollPos.y;
    const viewportBottom = anchors.rectBottom - scrollPos.y;
    const spaceBelow = window.innerHeight - viewportBottom - margin;
    const spaceAbove = viewportTop - margin;
    let nextY: number;

    if (spaceBelow >= height + 8) {
      nextY = anchors.rectBottom + 8;
    } else if (spaceAbove >= height + 8) {
      nextY = anchors.rectTop - 8 - height;
    } else {
      const currentViewportY = panelAnchorY - scrollPos.y;
      const clampedViewportY = Math.min(
        Math.max(currentViewportY, margin),
        window.innerHeight - height - margin
      );
      nextY = clampedViewportY + scrollPos.y;
    }

    setPanel((prev) => {
      if (!prev.open || prev.mode !== "result" || prev.placement === "center")
        return prev;
      if (Math.abs(prev.anchor.y - nextY) < 1) return prev;
      return { ...prev, anchor: { ...prev.anchor, y: nextY } };
    });
  }, [panel.open, panelMode, panelPlacement, panelAnchorY, scrollPos]);

  return (
    <>
      {panel.open ? (
        <AiToolInteraction run={run}>
          {({ completion, isLoading, error, stop }) => (
            <>
              {panel.mode === "tools" ? (
                <div
                  ref={toolbarRef}
                  className="sk-toolbar"
                  style={panelStyle}
                  role="toolbar"
                  aria-label="Swiss Knife 工具栏"
                  onPointerDown={(event) =>
                    startDrag(event, toolbarRef.current)
                  }
                >
                  <div className="sk-toolbar__tools">
                    {visibleTools.map((tool) => {
                      const Icon = ICONS[tool.icon] ?? Sparkles;
                      const disabled =
                        isLoading ||
                        (selection ? false : tool.triggers.selection);
                      return (
                        <button
                          key={tool.id}
                          className="sk-toolbar__tool"
                          type="button"
                          disabled={disabled}
                          onClick={() => runTool(tool, undefined, "anchored")}
                          title={tool.name}
                        >
                          <Icon className="sk-toolbar__icon" />
                          <span className="sk-toolbar__label">{tool.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isLoading || error ? (
                    <div className="sk-toolbar__right">
                      {isLoading ? (
                        <span className="sk-toolbar__hint">生成中…</span>
                      ) : null}
                      {error ? (
                        <span className="sk-toolbar__hint sk-toolbar__hint--error">
                          错误
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  ref={resultPanelRef}
                  className="sk-panel"
                  style={panelStyle}
                >
                  <div
                    className="sk-panel__header"
                    onPointerDown={(event) =>
                      startDrag(event, resultPanelRef.current)
                    }
                  >
                    <p className="sk-panel__title">{`结果：${
                      result?.toolName ?? ""
                    }`}</p>
                    <button
                      className="sk-panel__close"
                      onClick={closePanel}
                      type="button"
                    >
                      关闭
                    </button>
                  </div>
                  <div className="sk-panel__body">
                    {error ? (
                      <p className="sk-muted" style={{ color: "#fda4af" }}>
                        错误：{error}
                      </p>
                    ) : null}
                    <div className="sk-result">
                      {isLoading && !completion ? (
                        <div className="sk-loading" aria-label="loading">
                          <div className="sk-skeleton sk-skeleton--title" />
                          <div className="sk-skeleton" />
                          <div className="sk-skeleton" />
                          <div className="sk-skeleton sk-skeleton--short" />
                        </div>
                      ) : completion ? (
                        <Message from="assistant">
                          <MessageContent className="sk-ai-elements-content">
                            <MessageResponse className="sk-ai-elements-response">
                              {completion}
                            </MessageResponse>
                          </MessageContent>
                        </Message>
                      ) : (
                        ""
                      )}
                    </div>
                    <div className="sk-actions">
                      {isLoading ? (
                        <button
                          className="sk-action-btn"
                          type="button"
                          onClick={() => stop()}
                        >
                          停止
                        </button>
                      ) : null}
                      <button
                        className="sk-action-btn"
                        type="button"
                        onClick={() => {
                          if (!completion) return;
                          void navigator.clipboard.writeText(completion);
                        }}
                      >
                        复制
                      </button>
                      <button
                        className="sk-action-btn"
                        type="button"
                        onClick={() => {
                          const anchors = selectionAnchorsRef.current;
                          if (!anchors) return;
                          openAt({ x: anchors.x, y: anchors.yTop }, "tools");
                        }}
                      >
                        返回工具列表
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </AiToolInteraction>
      ) : null}
    </>
  );
}

const existingMount = document.getElementById(mountId);
if (!existingMount) {
  // Shadow DOM 隔离：所有扩展 UI 都挂进一个独立的 shadow root，
  // 使得宿主页的 CSS（全局 reset、tailwind utility、`* { ... }` 等）无法
  // 影响扩展 UI，反之亦然。
  const host = document.createElement("div");
  host.id = mountId;
  const shadow = host.attachShadow({ mode: "open" });

  // KaTeX CSS 的 url(/assets/...) 在宿主页 document 下会解析到宿主页源，
  // 改写成 chrome-extension:// 绝对地址，确保字体文件能正确加载。
  const assetsPrefix = chrome.runtime.getURL("assets/");
  const katexStyle = document.createElement("style");
  katexStyle.textContent = katexCss.replace(/\/assets\//g, assetsPrefix);
  shadow.appendChild(katexStyle);

  const style = document.createElement("style");
  style.textContent = contentScriptCss;
  shadow.appendChild(style);

  const container = document.createElement("div");
  shadow.appendChild(container);

  document.documentElement.append(host);

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ContentShell />
    </StrictMode>
  );
}

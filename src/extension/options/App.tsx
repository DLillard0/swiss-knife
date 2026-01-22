import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ClipboardCopy,
  GripVertical,
  Lightbulb,
  MessageCircle,
  Puzzle,
  ScanText,
  Search,
  Sparkles,
  Wand2,
  Zap
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearExtensionConfig,
  getDefaultConfig,
  getExtensionConfig,
  saveExtensionConfig,
  type ExtensionConfig
} from "../storage/config";
import {
  createTool,
  deleteTool,
  getTools,
  resetToolsToDefault,
  saveTools
} from "../storage/tools";
import { isDefaultToolId } from "@/default-tools";
import { testAiHello } from "./ai-test";
import type { ToolDefinition, ToolIconName } from "../shared/tool";
import { hasAnyTemplatePlaceholder } from "../shared/tool";
import { parseShortcut } from "../shared/shortcut";

const TOOL_ICON_OPTIONS: ToolIconName[] = [
  "Sparkles",
  "Wand2",
  "ScanText",
  "MessageCircle",
  "ClipboardCopy",
  "BookOpen",
  "Search",
  "Lightbulb",
  "Zap",
  "Puzzle"
];

const TOOL_ICONS = {
  Sparkles,
  Wand2,
  ScanText,
  MessageCircle,
  ClipboardCopy,
  BookOpen,
  Search,
  Lightbulb,
  Zap,
  Puzzle
} satisfies Record<ToolIconName, React.ComponentType<{ className?: string }>>;

type StatusType = "success" | "error" | "info";
type Status = { type: StatusType; text: string } | null;

export default function App() {
  const [form, setForm] = useState<ExtensionConfig>(getDefaultConfig());
  const [loaded, setLoaded] = useState<ExtensionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Status>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsStatus, setToolsStatus] = useState<Status>(null);
  const [editing, setEditing] = useState<ToolDefinition | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [dragOverToolId, setDragOverToolId] = useState<string | null>(null);
  const editingIsDefault = editing ? isDefaultToolId(editing.id) : false;

  useEffect(() => {
    const load = async () => {
      try {
        const config = await getExtensionConfig();
        setForm(config);
        setLoaded(config);
        setStatus({
          type: "info",
          text: "已从 chrome.storage.sync 读取当前配置。"
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "未知错误，请稍后重试。";
        setStatus({ type: "error", text: `加载配置失败：${message}` });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadTools = async () => {
      setToolsLoading(true);
      try {
        const list = await getTools();
        setTools(list);
        setToolsStatus({ type: "info", text: "已加载 Tool 配置。" });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "未知错误，请稍后重试。";
        setToolsStatus({ type: "error", text: `加载 Tool 失败：${message}` });
      } finally {
        setToolsLoading(false);
      }
    };
    loadTools();
  }, []);

  const isDirty = useMemo(() => {
    if (!loaded) return false;
    return (
      form.apiBaseUrl !== loaded.apiBaseUrl ||
      form.token !== loaded.token ||
      form.model !== loaded.model
    );
  }, [form, loaded]);

  const handleChange = (field: keyof ExtensionConfig) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !isDirty) return;

    setSaving(true);
    setStatus(null);
    try {
      await saveExtensionConfig(form);
      setLoaded(form);
      setStatus({ type: "success", text: "配置已保存到 chrome.storage.sync。" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误，请稍后重试。";
      setStatus({ type: "error", text: `保存失败：${message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (testing || saving || loading) return;
    setTesting(true);
    setTestResult({ type: "info", text: "测试中：正在发送 hello..." });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const result = await testAiHello({
      apiBaseUrl: form.apiBaseUrl,
      token: form.token,
      model: form.model,
      signal: controller.signal
    });

    if (result.ok) {
      setTestResult({
        type: "success",
        text: `测试通过：收到回复「${result.content.slice(0, 80)}${
          result.content.length > 80 ? "…" : ""
        }」`
      });
    } else {
      setTestResult({ type: "error", text: `测试失败：${result.error}` });
    }

    setTesting(false);
  };

  const handleReset = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const defaults = getDefaultConfig();
      await clearExtensionConfig();
      setForm(defaults);
      setLoaded(defaults);
      setStatus({ type: "success", text: "已恢复默认并清空存储。" });
      setTestResult(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误，请稍后重试。";
      setStatus({ type: "error", text: `重置失败：${message}` });
    } finally {
      setSaving(false);
    }
  };

  const validateTool = (tool: ToolDefinition, list: ToolDefinition[]) => {
    const name = tool.name.trim();
    if (!name) return "Tool 名称不能为空。";
    const dup = list.some(
      (t) => t.id !== tool.id && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) return "Tool 名称必须唯一（已存在同名 Tool）。";
    if (!tool.prompt.trim()) return "提示词不能为空。";
    const systemPrompt = (tool.systemPrompt ?? "").trim();
    if (systemPrompt && hasAnyTemplatePlaceholder(systemPrompt)) {
      return "system 提示词不支持使用 collection（{{...}} 占位符）。";
    }
    if (!tool.triggers.selection && !tool.triggers.shortcut)
      return "至少需要启用一种触发方式（划词/快捷键）。";

    if (tool.triggers.shortcut) {
      const key = (tool.shortcutKey ?? "").trim();
      if (!key) return "已启用快捷键触发：请填写该 Tool 的快捷键。";
      const spec = parseShortcut(key);
      if (!spec)
        return "快捷键格式不正确，请使用类似 Ctrl+Shift+K / Command+Shift+K / Mod+Shift+K。";

      const canonical = (() => {
        const parts: string[] = [];
        if (spec.mod) parts.push("Mod");
        else {
          if (spec.ctrl) parts.push("Ctrl");
          if (spec.meta) parts.push("Command");
        }
        if (spec.alt) parts.push("Alt");
        if (spec.shift) parts.push("Shift");
        parts.push(spec.key === " " ? "Space" : spec.key);
        return parts.join("+");
      })();

      const conflicts = list.some((t) => {
        if (t.id === tool.id) return false;
        if (!t.triggers.shortcut) return false;
        const other = parseShortcut((t.shortcutKey ?? "").trim());
        if (!other) return false;
        const otherCanonical = (() => {
          const parts: string[] = [];
          if (other.mod) parts.push("Mod");
          else {
            if (other.ctrl) parts.push("Ctrl");
            if (other.meta) parts.push("Command");
          }
          if (other.alt) parts.push("Alt");
          if (other.shift) parts.push("Shift");
          parts.push(other.key === " " ? "Space" : other.key);
          return parts.join("+");
        })();
        return otherCanonical === canonical;
      });
      if (conflicts) return "快捷键冲突：已有其它 Tool 使用了相同快捷键。";
    }
    return null;
  };

  const handleCreateTool = async () => {
    setToolsStatus(null);
    try {
      const tool = await createTool();
      const list = await getTools();
      setTools(list);
      setEditing(tool);
      setToolsStatus({ type: "success", text: "已创建新工具（请继续编辑并保存）。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setToolsStatus({ type: "error", text: `创建失败：${message}` });
    }
  };

  const handleSaveEditing = async () => {
    if (!editing) return;
    const err = validateTool(editing, tools);
    if (err) {
      setToolsStatus({ type: "error", text: err });
      return;
    }
    try {
      const next = tools.map((t) => (t.id === editing.id ? editing : t));
      await saveTools(next);
      setTools(next);
      setToolsStatus({ type: "success", text: "Tool 已保存。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setToolsStatus({ type: "error", text: `保存失败：${message}` });
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (isDefaultToolId(toolId)) {
      setToolsStatus({ type: "error", text: "默认 Tool 不可删除。" });
      return;
    }
    setToolsStatus(null);
    try {
      await deleteTool(toolId);
      const list = await getTools();
      setTools(list);
      if (editing?.id === toolId) setEditing(null);
      setToolsStatus({ type: "success", text: "已删除 Tool。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setToolsStatus({ type: "error", text: `删除失败：${message}` });
    }
  };

  const handleResetTools = async () => {
    setToolsStatus(null);
    try {
      await resetToolsToDefault();
      const list = await getTools();
      setTools(list);
      setEditing(null);
      setToolsStatus({ type: "success", text: "已恢复默认工具列表。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setToolsStatus({ type: "error", text: `恢复默认失败：${message}` });
    }
  };

  const reorderTools = (
    list: ToolDefinition[],
    fromId: string,
    toId: string
  ) => {
    const fromIndex = list.findIndex((tool) => tool.id === fromId);
    const toIndex = list.findIndex((tool) => tool.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleDragStart = (toolId: string) => (event: React.DragEvent) => {
    setDraggingToolId(toolId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", toolId);
  };

  const handleDragOver = (toolId: string) => (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverToolId !== toolId) setDragOverToolId(toolId);
  };

  const handleDrop = (toolId: string) => async (event: React.DragEvent) => {
    event.preventDefault();
    const sourceId = draggingToolId || event.dataTransfer.getData("text/plain");
    setDragOverToolId(null);
    setDraggingToolId(null);
    if (!sourceId || sourceId === toolId) return;

    const prev = tools;
    const next = reorderTools(prev, sourceId, toolId);
    if (next === prev) return;

    setTools(next);
    setToolsStatus({ type: "info", text: "正在保存新的排序..." });
    try {
      await saveTools(next);
      setToolsStatus({ type: "success", text: "工具排序已保存。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setTools(prev);
      setToolsStatus({ type: "error", text: `保存排序失败：${message}` });
    }
  };

  const handleDragEnd = () => {
    setDragOverToolId(null);
    setDraggingToolId(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Swiss Knife
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            扩展程序配置
          </h1>
          <p className="text-sm text-slate-600">
            在此填写 AI 接口的基础地址与 Token，数据将保存在
            chrome.storage.sync，便于在内容脚本或后台统一读取。
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">配置项</p>
              <p className="text-xs text-slate-600">
                支持同步到浏览器账号，方便多设备共享。
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              disabled={saving || loading}
            >
              恢复默认
            </Button>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">
                API Base URL
              </label>
              <Input
                placeholder="如：https://api.example.com/v1"
                value={form.apiBaseUrl}
                disabled={loading || saving}
                onChange={(event) => handleChange("apiBaseUrl")(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                用于 AI 请求的基础路径，示例： https://api.example.com/v1 。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Token</label>
              <Input
                type="password"
                placeholder="用于鉴权的 Token"
                value={form.token}
                disabled={loading || saving}
                onChange={(event) => handleChange("token")(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                建议使用只读或临时密钥，避免泄漏敏感权限。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Model</label>
              <Input
                placeholder="如：gpt-4o-mini（留空则使用默认值）"
                value={form.model}
                disabled={loading || saving}
                onChange={(event) => handleChange("model")(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                将作为 OpenAI 兼容接口的 <code>model</code> 参数传递。
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!isDirty || saving || loading}>
                {saving ? "保存中..." : "保存配置"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || loading || testing}
                onClick={handleTest}
              >
                {testing ? "测试中..." : "测试连接"}
              </Button>
              {status ? (
                <StatusBadge type={status.type} text={status.text} />
              ) : (
                <span className="text-xs text-slate-500">
                  {loading
                    ? "正在加载存储中的配置..."
                    : "未修改或已与存储一致。"}
                </span>
              )}
            </div>

            {testResult ? (
              <div className="pt-1">
                <StatusBadge type={testResult.type} text={testResult.text} />
              </div>
            ) : null}
          </form>
        </section>

        <section className="rounded-xl border border-dashed border-slate-200 p-6">
          <p className="text-sm font-semibold text-slate-900">调用提示</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>
              通过 <code>getExtensionConfig()</code> 读取配置，文件：
              <code>src/extension/storage/config.ts</code>。
            </li>
            <li>
              在 content-script、background 或 popup 中均可使用，需先声明
              <code>storage</code> 权限（已在 manifest 配置）。
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Tool 管理</p>
              <p className="text-xs text-slate-600">
                配置自定义工具：名称、图标、提示词（支持 <code>{"{{selection}}"}</code>{" "}
                占位符）与触发方式。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetTools}
                disabled={toolsLoading}
              >
                恢复默认工具
              </Button>
              <Button size="sm" onClick={handleCreateTool} disabled={toolsLoading}>
                新增工具
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">工具列表</p>
                {toolsStatus ? (
                  <StatusBadge type={toolsStatus.type} text={toolsStatus.text} />
                ) : (
                  <span className="text-xs text-slate-500">
                    {toolsLoading ? "加载中..." : `${tools.length} 个工具`}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                可拖拽左侧的排序把手，调整工具在 toolbar 上的展示顺序。
              </p>

              <div className="mt-3 space-y-2">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    onDragOver={handleDragOver(tool.id)}
                    onDrop={handleDrop(tool.id)}
                    className={`flex items-start justify-between gap-3 rounded-lg border bg-white p-3 ${
                      editing?.id === tool.id
                        ? "border-slate-900/20 ring-2 ring-slate-900/5"
                        : "border-slate-200"
                    } ${
                      dragOverToolId === tool.id
                        ? "border-slate-900/40 ring-2 ring-slate-900/10"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white ring-4 ring-slate-100">
                          {(() => {
                            const Icon = TOOL_ICONS[tool.icon] ?? Sparkles;
                            return <Icon className="h-4 w-4" />;
                          })()}
                        </span>
                        <span className="truncate">{tool.name}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-slate-400">图标：</span>
                          <code>{tool.icon}</code>
                        </span>{" "}
                        · 触发：
                        {tool.triggers.selection ? " 划词" : ""}
                        {tool.triggers.shortcut ? " 快捷键" : ""}
                        {!tool.triggers.selection && !tool.triggers.shortcut
                          ? "（未启用）"
                          : ""}
                        {tool.triggers.shortcut && (tool.shortcutKey ?? "").trim()
                          ? `（${tool.shortcutKey?.trim()}）`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 ${
                          draggingToolId === tool.id ? "opacity-60" : ""
                        }`}
                        draggable
                        onDragStart={handleDragStart(tool.id)}
                        onDragEnd={handleDragEnd}
                        title="拖拽排序"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing(tool)}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDeleteTool(tool.id)}
                        disabled={isDefaultToolId(tool.id)}
                        title={isDefaultToolId(tool.id) ? "默认工具不可删除" : "删除"}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
                {tools.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无工具，请先新增。</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">编辑工具</p>
              <p className="mt-1 text-xs text-slate-600">
                修改后点“保存 Tool”，页面端（content-script）会自动刷新工具列表。
              </p>

              {editing ? (
                <div className="mt-4 space-y-4">
                  {editingIsDefault ? (
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      默认工具仅支持调整展示配置（是否在 toolbar 展示、快捷键）与排序。
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">
                      名称（唯一）
                    </label>
                    <Input
                      value={editing.name}
                      disabled={editingIsDefault}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, name: e.target.value } : prev
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">
                      图标（lucide-react）
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white ring-4 ring-slate-100">
                        {(() => {
                          const Icon = TOOL_ICONS[editing.icon] ?? Sparkles;
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </span>
                      <div className="min-w-0 text-xs text-slate-600">
                        当前：<code>{editing.icon}</code>
                      </div>
                    </div>
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={editing.icon}
                      disabled={editingIsDefault}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev
                            ? { ...prev, icon: e.target.value as ToolIconName }
                            : prev
                        )
                      }
                    >
                      {TOOL_ICON_OPTIONS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      目前内置一组常用图标名；后续可扩展为搜索/全量选择。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">
                      system 提示词（不可使用 collection）
                    </label>
                    <textarea
                      className="min-h-[90px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm leading-relaxed"
                      value={editing.systemPrompt ?? ""}
                      disabled={editingIsDefault}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, systemPrompt: e.target.value } : prev
                        )
                      }
                    />
                    <p className="text-xs text-slate-500">
                      将作为 system role 发送给 AI。此处不支持 <code>{"{{...}}"}</code> 占位符（collection）。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">
                      提示词（支持 {`{{selection}}`})
                    </label>
                    <textarea
                      className="min-h-[140px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm leading-relaxed"
                      value={editing.prompt}
                      disabled={editingIsDefault}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, prompt: e.target.value } : prev
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">
                      触发方式
                    </label>
                    <div className="flex flex-col gap-2 text-sm text-slate-700">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.triggers.selection}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    triggers: {
                                      ...prev.triggers,
                                      selection: e.target.checked
                                    }
                                  }
                                : prev
                            )
                          }
                        />
                        划词触发工具栏
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.triggers.shortcut}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    triggers: {
                                      ...prev.triggers,
                                      shortcut: e.target.checked
                                    }
                                  }
                                : prev
                            )
                          }
                        />
                        快捷键直接运行该 Tool
                      </label>
                      {editing.triggers.shortcut ? (
                        <div className="ml-6 space-y-2">
                          <Input
                            placeholder="如：Mod+Shift+K（Mod 表示 Ctrl 或 Command）"
                            value={editing.shortcutKey ?? ""}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev ? { ...prev, shortcutKey: e.target.value } : prev
                              )
                            }
                          />
                          <p className="text-xs text-slate-500">
                            建议使用 <code>Mod</code> 兼容 Win/Linux（Ctrl）与 macOS（Command）。
                            示例：<code>Mod+Shift+E</code>、<code>Ctrl+Alt+K</code>。
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={handleSaveEditing}>保存 Tool</Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(null)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  从左侧选择一个工具开始编辑，或点击“新增工具”。
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ type, text }: { type: StatusType; text: string }) {
  const toneMap: Record<StatusType, string> = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    error: "bg-rose-50 text-rose-700 ring-rose-100",
    info: "bg-sky-50 text-sky-700 ring-sky-100"
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${toneMap[type]}`}
    >
      {text}
    </span>
  );
}

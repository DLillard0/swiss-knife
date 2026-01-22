import type { Collections, ToolDefinition } from "./tool";

export type PingMessage = {
  type: "PING";
};

export type SkToggleToolbarMessage = {
  type: "SK_TOGGLE_TOOLBAR";
};

export type SkOpenToolbarMessage = {
  type: "SK_OPEN_TOOLBAR";
  /** 可选：内容脚本用来决定初始位置 */
  anchor?: { x: number; y: number };
};

export type SkRunToolMessage = {
  type: "SK_RUN_TOOL";
  tool: ToolDefinition;
  collections: Collections;
  /** 渲染后的 prompt（已替换占位符）；冗余字段方便后台直接调用 */
  prompt: string;
};

export type SkRunToolResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };

// -------------------------
// Streaming (Port) messages
// -------------------------
export type SkCompletionStreamStart = {
  type: "SK_COMPLETION_STREAM_START";
  prompt: string;
  /** 可选：tool 的 system 提示词（将作为 system role 注入） */
  systemPrompt?: string;
  /** 可选：用于 UI 展示或日志 */
  tool?: Pick<ToolDefinition, "id" | "name">;
};

export type SkCompletionStreamChunk = {
  type: "SK_COMPLETION_STREAM_CHUNK";
  textDelta: string;
};

export type SkCompletionStreamDone = {
  type: "SK_COMPLETION_STREAM_DONE";
};

export type SkCompletionStreamError = {
  type: "SK_COMPLETION_STREAM_ERROR";
  error: string;
};

export type SkCompletionStreamInMessage = SkCompletionStreamStart;
export type SkCompletionStreamOutMessage =
  | SkCompletionStreamChunk
  | SkCompletionStreamDone
  | SkCompletionStreamError;

export type SkMessage =
  | PingMessage
  | SkToggleToolbarMessage
  | SkOpenToolbarMessage
  | SkRunToolMessage;

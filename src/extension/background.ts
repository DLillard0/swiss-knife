import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { getExtensionConfig } from "./storage/config";
import { hasAnyTemplatePlaceholder } from "./shared/tool";
import type {
  SkCompletionStreamInMessage,
  SkCompletionStreamOutMessage,
  SkMessage,
  SkRunToolResponse
} from "./shared/messages";

chrome.runtime.onInstalled.addListener(() => {
  console.info("[Swiss Knife] background ready.");
});

const COMPLETION_STREAM_PORT = "SK_COMPLETION_STREAM";
// (Port name for streaming completion deltas to UI)

function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

function normalizeBaseUrlToV1(input: string): string {
  const base = normalizeBaseUrl(input);
  if (!base) return "";
  if (base.endsWith("/v1")) return base;
  return `${base}/v1`;
}

async function runToolInBackground(message: Extract<SkMessage, { type: "SK_RUN_TOOL" }>): Promise<SkRunToolResponse> {
  const config = await getExtensionConfig();
  const baseURL = normalizeBaseUrlToV1(config.apiBaseUrl);
  if (!baseURL) return { ok: false, error: "请先在扩展选项页配置 API Base URL。" };
  if (!config.token) return { ok: false, error: "请先在扩展选项页配置 Token。" };

  const model = (config.model?.trim() || "gpt-3.5-turbo").trim();

  try {
    const openai = createOpenAI({
      apiKey: config.token,
      baseURL
    });

    const systemPrompt = (message.tool?.systemPrompt ?? "").trim();
    if (systemPrompt && hasAnyTemplatePlaceholder(systemPrompt)) {
      return { ok: false, error: "Tool 的 system 提示词不支持使用 collection（{{...}} 占位符）。" };
    }

    const { text } = await generateText({
      model: openai(model),
      system: systemPrompt || undefined,
      prompt: message.prompt
    });

    const trimmed = text?.trim();
    if (!trimmed) return { ok: false, error: "AI 返回成功，但未发现可用的回复内容（text 为空）。" };
    return { ok: true, text: trimmed };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "未知错误";
    return { ok: false, error: `请求失败：${messageText}` };
  }
}

chrome.runtime.onMessage.addListener((message: SkMessage, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "SK_RUN_TOOL") {
    void runToolInBackground(message).then(sendResponse);
    return true;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== COMPLETION_STREAM_PORT) return;

  let started = false;
  const abortController = new AbortController();

  port.onDisconnect.addListener(() => {
    abortController.abort();
  });

  port.onMessage.addListener((rawMessage: SkCompletionStreamInMessage) => {
    if (started) return;
    if (rawMessage?.type !== "SK_COMPLETION_STREAM_START") return;
    started = true;

    void (async () => {
      const config = await getExtensionConfig();
      const baseURL = normalizeBaseUrlToV1(config.apiBaseUrl);
      if (!baseURL) {
        port.postMessage({
          type: "SK_COMPLETION_STREAM_ERROR",
          error: "请先在扩展选项页配置 API Base URL。"
        } satisfies SkCompletionStreamOutMessage);
        port.disconnect();
        return;
      }
      if (!config.token) {
        port.postMessage({
          type: "SK_COMPLETION_STREAM_ERROR",
          error: "请先在扩展选项页配置 Token。"
        } satisfies SkCompletionStreamOutMessage);
        port.disconnect();
        return;
      }

      const model = (config.model?.trim() || "gpt-3.5-turbo").trim();

      try {
        const openai = createOpenAI({
          apiKey: config.token,
          baseURL
        });

        const systemPrompt = (rawMessage.systemPrompt ?? "").trim();
        if (systemPrompt && hasAnyTemplatePlaceholder(systemPrompt)) {
          port.postMessage({
            type: "SK_COMPLETION_STREAM_ERROR",
            error: "Tool 的 system 提示词不支持使用 collection（{{...}} 占位符）。"
          } satisfies SkCompletionStreamOutMessage);
          port.disconnect();
          return;
        }

        const result = streamText({
          model: openai(model),
          system: systemPrompt || undefined,
          prompt: rawMessage.prompt,
          abortSignal: abortController.signal
        });

        for await (const textDelta of result.textStream) {
          // 逐 token / delta 推送给前端，由 @ai-sdk/react 负责拼接显示
          port.postMessage({
            type: "SK_COMPLETION_STREAM_CHUNK",
            textDelta
          } satisfies SkCompletionStreamOutMessage);
        }

        port.postMessage({ type: "SK_COMPLETION_STREAM_DONE" } satisfies SkCompletionStreamOutMessage);
        port.disconnect();
      } catch (error) {
        // 被 stop/关闭触发的 abort 视为正常结束，不弹错误
        const isAbort =
          error instanceof DOMException
            ? error.name === "AbortError"
            : error instanceof Error
              ? /aborted|AbortError/i.test(error.message)
              : false;

        if (isAbort) {
          port.postMessage({ type: "SK_COMPLETION_STREAM_DONE" } satisfies SkCompletionStreamOutMessage);
          port.disconnect();
          return;
        }

        const messageText = error instanceof Error ? error.message : "未知错误";
        port.postMessage({
          type: "SK_COMPLETION_STREAM_ERROR",
          error: `请求失败：${messageText}`
        } satisfies SkCompletionStreamOutMessage);
        port.disconnect();
      }
    })();
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-toolbar") return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "SK_TOGGLE_TOOLBAR" } satisfies SkMessage);
});

import { useCompletion } from "@ai-sdk/react";
import { useEffect, useMemo, useState } from "react";

import type {
  SkCompletionStreamOutMessage,
  SkRunToolResponse
} from "../shared/messages";
import type { ToolDefinition } from "../shared/tool";

const COMPLETION_STREAM_PORT = "SK_COMPLETION_STREAM";

export type ToolRunRequest = {
  key: string;
  tool: ToolDefinition;
  prompt: string;
  collections: { selection?: string };
};

export type AiToolInteractionState = {
  completion: string;
  isLoading: boolean;
  error: string | null;
  stop: () => void;
};

type AiToolInteractionProps = {
  run: ToolRunRequest | null;
  /**
   * 注意：这是一个“逻辑组件”，负责 AI 交互与状态管理；
   * UI 由外层渲染（方便你在 content-script/popup/options 复用同一套交互逻辑）。
   */
  children: (state: AiToolInteractionState) => React.ReactNode;
};

export function AiToolInteraction({ run, children }: AiToolInteractionProps) {
  const [error, setError] = useState<string | null>(null);

  const completionFetch: typeof fetch = useMemo(() => {
    const encoder = new TextEncoder();

    return async (_input, init) => {
      let bodyObj: any = {};
      if (typeof init?.body === "string") {
        try {
          bodyObj = JSON.parse(init.body);
        } catch {
          bodyObj = {};
        }
      }

      const prompt: string = String(bodyObj?.prompt ?? "");
      const tool = bodyObj?.tool as { id?: string; name?: string } | undefined;
      const systemPrompt: string = String(bodyObj?.systemPrompt ?? "");

      const port = chrome.runtime.connect({ name: COMPLETION_STREAM_PORT });
      let closed = false;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const safeClose = () => {
            if (closed) return;
            closed = true;
            try {
              controller.close();
            } catch {
              // ignore double-close
            }
          };

          const safeError = (err: unknown) => {
            if (closed) return;
            closed = true;
            try {
              controller.error(err);
            } catch {
              // ignore
            }
          };

          const onAbort = () => {
            try {
              port.disconnect();
            } catch {
              // ignore
            }
            safeError(new DOMException("Aborted", "AbortError"));
          };

          if (init?.signal) {
            if (init.signal.aborted) onAbort();
            init.signal.addEventListener("abort", onAbort, { once: true });
          }

          port.onMessage.addListener((message: SkCompletionStreamOutMessage) => {
            if (!message) return;
            if (message.type === "SK_COMPLETION_STREAM_CHUNK") {
              controller.enqueue(encoder.encode(message.textDelta));
              return;
            }
            if (message.type === "SK_COMPLETION_STREAM_ERROR") {
              safeError(new Error(message.error));
              try {
                port.disconnect();
              } catch {
                // ignore
              }
              return;
            }
            if (message.type === "SK_COMPLETION_STREAM_DONE") {
              safeClose();
              try {
                port.disconnect();
              } catch {
                // ignore
              }
            }
          });

          port.onDisconnect.addListener(() => {
            // 如果没收到 DONE/ERROR，按正常结束处理（避免悬挂）
            safeClose();
          });

          port.postMessage({
            type: "SK_COMPLETION_STREAM_START",
            prompt,
            systemPrompt,
            tool
          });
        },
        cancel() {
          try {
            port.disconnect();
          } catch {
            // ignore
          }
        }
      });

      // useCompletion(streamProtocol="text") 需要 text/plain 的流式 body
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };
  }, []);

  const { completion, complete, isLoading, stop, setCompletion } = useCompletion({
    api: "/__swiss-knife/completion",
    streamProtocol: "text",
    fetch: completionFetch,
    onError: (e) => {
      setError(e instanceof Error ? e.message : String(e));
    }
  });

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (!run) return;

    let cancelled = false;
    const doRun = async () => {
      setError(null);
      setCompletion("");

      try {
        // 主路径：通过 @ai-sdk/react 的 useCompletion 流式消费
        const finalText = await complete(run.prompt, {
          body: {
            tool: { id: run.tool.id, name: run.tool.name },
            systemPrompt: (run.tool.systemPrompt ?? "").trim()
          }
        });

        // 保险：如果流式未返回任何内容，则 fallback 一次
        if (!cancelled && !finalText?.trim()) {
          const response = (await chrome.runtime.sendMessage({
            type: "SK_RUN_TOOL",
            tool: run.tool,
            collections: run.collections,
            prompt: run.prompt
          })) as SkRunToolResponse;

          if (cancelled) return;

          if (response?.ok) {
            setCompletion(response.text);
          } else {
            setError(response?.error ?? "未知错误");
          }
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "未知错误");
      }
    };

    void doRun();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.key]);

  return children({ completion, isLoading, error, stop });
}


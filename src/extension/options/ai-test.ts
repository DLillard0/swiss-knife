import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export type AiTestResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

function normalizeBaseUrlToV1(input: string): string {
  const base = normalizeBaseUrl(input);
  if (!base) return "";
  // OpenAI 兼容协议通常以 /v1 作为根路径；若用户只填了 host，则自动补齐。
  if (base.endsWith("/v1")) return base;
  return `${base}/v1`;
}

export async function testAiHello(params: {
  apiBaseUrl: string;
  token: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<AiTestResult> {
  const baseURL = normalizeBaseUrlToV1(params.apiBaseUrl);
  if (!baseURL) return { ok: false, error: "API Base URL 不能为空。" };

  const token = params.token.trim();
  if (!token) return { ok: false, error: "Token 不能为空。" };

  // 默认选一个最常见的 OpenAI 兼容模型名；若用户未填写 model，则使用默认值兜底。
  const model = (params.model?.trim() || "gpt-3.5-turbo").trim();

  try {
    const openai = createOpenAI({
      apiKey: token,
      baseURL
    });

    const { text } = await generateText({
      model: openai(model),
      prompt: "hello",
      abortSignal: params.signal
    });

    if (text?.trim()) return { ok: true, content: text.trim() };
    return { ok: false, error: "接口返回成功，但未发现可用的回复内容（text 为空）。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { ok: false, error: `网络/请求异常：${message}` };
  }
}

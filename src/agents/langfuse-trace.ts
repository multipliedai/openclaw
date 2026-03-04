/**
 * Optional Langfuse ingestion: when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY
 * are set, send llm_input payloads to Langfuse for observability.
 * Uses the legacy ingestion API (POST /api/public/ingestion); no SDK dependency.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginHookLlmInputEvent } from "../plugins/types.js";

const log = createSubsystemLogger("agents/langfuse-trace");

function getLangfuseConfig(): {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
} | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    return null;
  }
  const baseUrl = (process.env.LANGFUSE_HOST ?? process.env.LANGFUSE_BASE_URL ?? "http://localhost:3000")
    .replace(/\/+$/, "");
  return { publicKey, secretKey, baseUrl };
}

function buildTraceInput(event: PluginHookLlmInputEvent): unknown {
  const historySummary =
    Array.isArray(event.historyMessages) && event.historyMessages.length > 0
      ? event.historyMessages.map((m) => {
          const msg = m as { role?: string; content?: unknown };
          const role = msg.role ?? "unknown";
          const content =
            typeof msg.content === "string"
              ? msg.content
              : Array.isArray(msg.content)
                ? (msg.content as Array<{ type?: string; text?: string }>).find((c) => c?.type === "text")?.text ?? "[non-text]"
                : "[unknown]";
          return { role, contentLength: typeof content === "string" ? content.length : 0 };
        })
      : [];
  return {
    systemPromptLength: event.systemPrompt?.length ?? 0,
    promptLength: event.prompt?.length ?? 0,
    historyMessageCount: event.historyMessages?.length ?? 0,
    historySummary,
    imagesCount: event.imagesCount ?? 0,
    provider: event.provider,
    model: event.model,
    runId: event.runId,
    sessionId: event.sessionId,
    // Include truncated prompt for audit (first 2k chars)
    promptPreview:
      typeof event.prompt === "string" && event.prompt.length > 0
        ? event.prompt.slice(0, 2000) + (event.prompt.length > 2000 ? "..." : "")
        : undefined,
  };
}

/**
 * Send llm_input event to Langfuse as a trace (input only).
 * Fire-and-forget; logs warnings on failure. No-op when LANGFUSE_* env is not set.
 */
export function sendLlmInputToLangfuse(
  event: PluginHookLlmInputEvent,
  ctx: { agentId?: string; sessionKey?: string },
): void {
  const config = getLangfuseConfig();
  if (!config) {
    return;
  }

  const eventId = `openclaw-${event.runId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const traceId = eventId;
  const ts = new Date().toISOString();

  const batch = [
    {
      id: eventId,
      timestamp: ts,
      type: "trace-create",
      body: {
        id: traceId,
        timestamp: ts,
        name: "openclaw-llm-input",
        input: buildTraceInput(event),
        metadata: {
          runId: event.runId,
          sessionId: event.sessionId,
          provider: event.provider,
          model: event.model,
          agentId: ctx.agentId,
          sessionKey: ctx.sessionKey,
        },
        tags: ["openclaw", ctx.agentId].filter(Boolean) as string[],
      },
    },
  ];

  const url = `${config.baseUrl}/api/public/ingestion`;
  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64");

  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ batch }),
  }).then(
    async (res) => {
      if (!res.ok) {
        const body = await res.text();
        const detail = body.length > 0 ? `; body: ${body.slice(0, 500)}${body.length > 500 ? "…" : ""}` : "";
        log.warn(`Langfuse ingestion failed: ${res.status} ${res.statusText}${detail}`);
      }
    },
    (err) => {
      log.warn(`Langfuse ingestion error: ${String(err)}`);
    },
  );
}

// Anthropic Claude client for the search pipeline.
// Raw fetch (no SDK) so it runs in Deno edge runtime without bundler tricks.
//
// Design notes:
// - Model: claude-sonnet-4-6 (per project plan). User can override via ANTHROPIC_MODEL.
// - Prompt caching: the system prompt is marked cache_control=ephemeral so repeat
//   requests reuse the prefix and pay only for the user message.
// - Structured output: we use tool_use + a single mandatory tool. This is the
//   most compatible structured-output pattern across Claude API versions and
//   surfaces in Deno fetch with no SDK dependency.

import { ANTHROPIC_MODEL, requireEnv } from "../env.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import {
  COLD_CONTACT_SYSTEM_PROMPT,
  ColdContactPromptInput,
  EMIT_COLD_CONTACT_TOOL,
  EMIT_REPORT_TOOL,
  RankInput,
  SYSTEM_PROMPT,
  buildColdContactUserMessage,
  buildUserMessage,
} from "./prompts.ts";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export interface LlmReport {
  summary: string;
  trend_score: number;
  top_themes: string[];
  global_trend_chart?: Array<{ label: string; value: number }>;
  item_groups: Array<{
    name: string;
    type: "main" | "related";
    recommendation_reason: string;
    evidence_ids: string[];
  }>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export async function generateReport(input: RankInput): Promise<LlmReport> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [EMIT_REPORT_TOOL],
    tool_choice: { type: "tool", name: EMIT_REPORT_TOOL.name },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildUserMessage(input) }],
      },
    ],
  };

  const json = await withRetry(
    async () => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new UpstreamError(res.status, `Anthropic ${res.status}: ${text.slice(0, 500)}`);
      }
      return (await res.json()) as AnthropicResp;
    },
    { retries: 1, baseDelayMs: 600 },
  );

  // Log cache effectiveness for ops visibility.
  if (json.usage) {
    console.log(
      "[claude.usage]",
      JSON.stringify({
        input: json.usage.input_tokens,
        output: json.usage.output_tokens,
        cache_create: json.usage.cache_creation_input_tokens ?? 0,
        cache_read: json.usage.cache_read_input_tokens ?? 0,
      }),
    );
  }

  const toolUse = json.content?.find((b) => b.type === "tool_use" && b.name === EMIT_REPORT_TOOL.name);
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new LlmError("Claude response did not invoke emit_report tool");
  }

  const report = toolUse.input as LlmReport;
  if (!report || typeof report.summary !== "string" || !Array.isArray(report.item_groups)) {
    throw new LlmError("emit_report payload missing required fields");
  }
  return report;
}

interface AnthropicResp {
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
  >;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export async function generateColdContact(input: ColdContactPromptInput): Promise<string> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: COLD_CONTACT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [EMIT_COLD_CONTACT_TOOL],
    tool_choice: { type: "tool", name: EMIT_COLD_CONTACT_TOOL.name },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildColdContactUserMessage(input) }],
      },
    ],
  };

  const json = await withRetry(
    async () => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new UpstreamError(res.status, `Anthropic ${res.status}: ${text.slice(0, 500)}`);
      }
      return (await res.json()) as AnthropicResp;
    },
    { retries: 1, baseDelayMs: 600 },
  );

  if (json.usage) {
    console.log(
      "[claude.usage.cold_contact]",
      JSON.stringify({
        kind: input.kind,
        input: json.usage.input_tokens,
        output: json.usage.output_tokens,
        cache_create: json.usage.cache_creation_input_tokens ?? 0,
        cache_read: json.usage.cache_read_input_tokens ?? 0,
      }),
    );
  }

  const toolUse = json.content?.find(
    (b) => b.type === "tool_use" && b.name === EMIT_COLD_CONTACT_TOOL.name,
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new LlmError("Claude response did not invoke emit_cold_contact tool");
  }
  const payload = toolUse.input as { draft?: unknown };
  if (typeof payload.draft !== "string" || payload.draft.trim().length === 0) {
    throw new LlmError("emit_cold_contact draft missing or empty");
  }
  return payload.draft.trim();
}

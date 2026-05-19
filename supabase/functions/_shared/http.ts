// fetch wrapper with an AbortController-based timeout. Connectors call this
// instead of raw fetch so a single hanging upstream can't stall the entire
// search (Promise.allSettled in the orchestrator waits for every promise to
// settle, so one timeout-less request blocks the whole response).
//
// Timeout maps onto UpstreamError(status=0) — the orchestrator's classify()
// treats that as a generic UPSTREAM_FAILED. We intentionally do NOT wire it
// to withRetry's defaultShouldRetry (429/5xx only), so a slow upstream isn't
// hammered repeatedly.

import { UpstreamError } from "./retry.ts";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function timedFetch(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new UpstreamError(0, `Request timed out after ${timeoutMs}ms: ${input}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

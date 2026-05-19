// Apify actor runner. Used by Meta (Instagram) and X (Twitter) connectors so
// the project doesn't need to maintain official API approval for platforms
// that gate access behind business verification. Threads stays on the
// official Graph API for now because no robust keyword-search Apify actor
// exists at the time of writing — switch it over if one becomes available.
//
// Edge functions on Supabase have a 60s execution budget. We bound the actor
// run server-side at 45s and the HTTP I/O at 55s; no client-side retry,
// because actor cold-starts plus a retry cycle would blow the 60s budget.

import { getEnv } from "./env.ts";
import { timedFetch } from "./http.ts";
import { UpstreamError } from "./retry.ts";

const BASE = "https://api.apify.com/v2";
const DEFAULT_ACTOR_TIMEOUT_S = 45;
// HTTP wait = actor timeout + 5s buffer for the run-sync round-trip overhead.
// The hard ceiling stays under Supabase's 60s edge-function budget so the
// caller never gets killed in the middle of returning.
const HTTP_BUFFER_MS = 5_000;
const HTTP_TIMEOUT_CAP_MS = 58_000;

export function hasApifyToken(): boolean {
  return Boolean(getEnv("APIFY_API_TOKEN"));
}

export async function runApifyActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  opts: { timeoutS?: number } = {},
): Promise<T[]> {
  const token = getEnv("APIFY_API_TOKEN");
  if (!token) throw new UpstreamError(0, "APIFY_API_TOKEN is not set");

  // Apify accepts both percent-encoded `owner%2Fname` and `owner~name` in
  // path segments. The tilde form keeps the URL readable in logs.
  const id = actorId.replace("/", "~");
  const timeoutS = opts.timeoutS ?? DEFAULT_ACTOR_TIMEOUT_S;
  const httpTimeoutMs = Math.min(timeoutS * 1000 + HTTP_BUFFER_MS, HTTP_TIMEOUT_CAP_MS);
  const url =
    `${BASE}/acts/${id}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutS}`;

  const res = await timedFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    httpTimeoutMs,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError(
      res.status,
      `Apify ${actorId} ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T[];
}

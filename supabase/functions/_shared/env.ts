// Lightweight env access for Deno edge functions. No throwing for missing
// optional connector keys — callers should check via `requireEnv` only when they
// actually need a key.

export function getEnv(name: string): string | undefined {
  return Deno.env.get(name);
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getNumberEnv(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const ANTHROPIC_MODEL = getEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
export const CACHE_TTL_SECONDS = getNumberEnv("SEARCH_CACHE_TTL_SECONDS", 86400);

// Public base URL of the frontend app. Used to build absolute share URLs
// returned in ProjectDTO so the link is copy-paste-ready. Trailing slash stripped.
export const SITE_URL = (getEnv("SITE_URL") ?? "").replace(/\/+$/, "");

export function buildShareUrl(token: string): string {
  if (!SITE_URL) return `/share/${token}`;
  return `${SITE_URL}/share/${token}`;
}

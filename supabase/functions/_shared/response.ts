// Standard JSON envelope helpers + CORS.
// All edge functions return `{ status, data, error }` per docs/api-spec.md.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export const ERROR_HTTP_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_FAILED: 502,
  LLM_FAILED: 502,
  INTERNAL: 500,
};

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;

export function corsPreflight(): Response {
  return new Response("ok", { status: 200, headers: CORS_HEADERS });
}

export function ok<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({ status: "success", data }), {
    status: init.status ?? 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function fail(
  code: ErrorCode | string,
  message: string,
  init: ResponseInit = {},
): Response {
  const status = init.status ?? ERROR_HTTP_STATUS[code] ?? 500;
  return new Response(
    JSON.stringify({ status: "error", error: { code, message } }),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...(init.headers ?? {}) },
    },
  );
}

export function handleUnknownError(err: unknown): Response {
  console.error("[unhandled error]", err);
  const message = err instanceof Error ? err.message : "Unknown error";
  return fail("INTERNAL", message);
}

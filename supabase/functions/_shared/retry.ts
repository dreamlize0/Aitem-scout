// Exponential-backoff retry for flaky upstream calls.
// Used by connectors and the LLM client.

export interface RetryOptions {
  retries?: number;        // default 2
  baseDelayMs?: number;    // default 400ms
  factor?: number;         // default 2
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 400;
  const factor = opts.factor ?? 2;
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) break;
      const delay = base * Math.pow(factor, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err: unknown): boolean {
  if (err instanceof UpstreamError) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  return false;
}

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

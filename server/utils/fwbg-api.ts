/**
 * HTTP client for the fwbg REST API server.
 *
 * Proxies requests from the Nuxt server to the fwbg FastAPI backend.
 * Configured via FWBG_API_URL environment variable.
 */

const FWBG_API_URL = process.env.FWBG_API_URL || "http://localhost:8420";
const FWBG_API_KEY = process.env.FWBG_API_KEY || "";

/** Default timeout for fwbg API calls (ms). Indicator computation can be slow. */
const DEFAULT_TIMEOUT = 120_000;

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export async function fwbgFetch<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const url = `${FWBG_API_URL}${path}`;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(FWBG_API_KEY ? { "X-API-Key": FWBG_API_KEY } : {}),
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw createError({
        statusCode: res.status,
        statusMessage: body || res.statusText,
        data: parseJsonBody(body),
      });
    }

    // Awaited inside the try: the timeout also covers the body read.
    return (await res.json()) as T;
  } catch (err) {
    // Only this function's timer aborts the controller; the caller's signal is replaced.
    if (!controller.signal.aborted || !(err instanceof Error) || err.name !== "AbortError") throw err;
    throw createError({
      statusCode: 504,
      statusMessage: `fwbg did not answer within ${timeout / 1000} s`,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }
}

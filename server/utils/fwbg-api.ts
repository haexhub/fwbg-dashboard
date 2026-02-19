/**
 * HTTP client for the fwbg REST API server.
 *
 * Proxies requests from the Nuxt server to the fwbg FastAPI backend.
 * Configured via FWBG_API_URL environment variable.
 */

const FWBG_API_URL = process.env.FWBG_API_URL || "http://localhost:8420";

/** Default timeout for fwbg API calls (ms). Indicator computation can be slow. */
const DEFAULT_TIMEOUT = 120_000;

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
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw createError({
        statusCode: res.status,
        statusMessage: body || res.statusText,
      });
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

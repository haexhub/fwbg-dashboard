/**
 * HTTP client for the fwbg-agents REST API server.
 *
 * Proxies requests from the Nuxt server to the fwbg-agents FastAPI backend.
 * Configured via FWBG_AGENTS_API_URL environment variable.
 */

const FWBG_AGENTS_API_URL = process.env.FWBG_AGENTS_API_URL || "http://localhost:8421";

/** Default timeout for fwbg-agents API calls (ms). Endpoints in scope are fast reads or 202 kickoffs. */
const DEFAULT_TIMEOUT = 30_000;

export async function fwbgAgentsFetch<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const url = `${FWBG_AGENTS_API_URL}${path}`;
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

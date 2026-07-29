/**
 * HTTP client for the fwbg-agents REST API server.
 *
 * Proxies requests from the Nuxt server to the fwbg-agents FastAPI backend.
 * Configured via FWBG_AGENTS_API_URL environment variable.
 */

const FWBG_AGENTS_API_URL = process.env.FWBG_AGENTS_API_URL || "http://localhost:8421";

/** Default timeout for fwbg-agents API calls (ms). Endpoints in scope are fast reads or 202 kickoffs. */
const DEFAULT_TIMEOUT = 30_000;

/**
 * Pull FastAPI's `detail` out of an error body. Returns null for anything that
 * is not a JSON object with a string/array `detail` — a validation error's
 * `detail` is a list of field errors, which is still more useful joined than
 * as raw JSON.
 */
export function extractDetail(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    const detail = parsed?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((d) => (typeof d === "string" ? d : (d as { msg?: string })?.msg))
        .filter(Boolean);
      return parts.length ? parts.join("; ") : null;
    }
    return null;
  } catch {
    return null;
  }
}

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
      // FastAPI puts the human-readable reason in `detail`. Forwarding the raw
      // body left the UI rendering `{"detail":"..."}` verbatim, so unwrap it and
      // pass it on as `data.detail` — which is what callers read first.
      const detail = extractDetail(body);
      throw createError({
        statusCode: res.status,
        statusMessage: detail || body || res.statusText,
        data: detail ? { detail } : undefined,
      });
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

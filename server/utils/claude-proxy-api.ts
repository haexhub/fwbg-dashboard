/**
 * HTTP client for haex-claude-proxy's web-driven OAuth setup API
 * (/setup/status, /setup/login, /setup/code, /setup/reset).
 *
 * Proxies requests from the Nuxt server to the claude-proxy service.
 * Configured via CLAUDE_PROXY_URL / CLAUDE_PROXY_SETUP_TOKEN environment
 * variables. The bearer token never reaches the browser — only this
 * server-side client ever sees it.
 */

const CLAUDE_PROXY_URL = process.env.CLAUDE_PROXY_URL || "http://localhost:12102";
const CLAUDE_PROXY_SETUP_TOKEN = process.env.CLAUDE_PROXY_SETUP_TOKEN || "";

/** Default timeout for claude-proxy setup calls (ms). All fast reads/kickoffs. */
const DEFAULT_TIMEOUT = 30_000;

export async function claudeProxyFetch<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const url = `${CLAUDE_PROXY_URL}${path}`;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLAUDE_PROXY_SETUP_TOKEN}`,
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

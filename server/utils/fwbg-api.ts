/**
 * HTTP client for the fwbg REST API server.
 *
 * Proxies requests from the Nuxt server to the fwbg FastAPI backend.
 * Configured via FWBG_API_URL environment variable.
 */

const FWBG_API_URL = process.env.FWBG_API_URL || "http://localhost:8420";

export async function fwbgFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${FWBG_API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
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
}

/**
 * GET /api/runs/:id/discovery/:symbol
 * SSE proxy: streams feature discovery events from fwbg API.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const symbol = getRouterParam(event, "symbol");

  const apiUrl = process.env.FWBG_API_URL || "http://localhost:8420";
  const apiKey = process.env.FWBG_API_KEY || "";
  const url = `${apiUrl}/api/runs/${id}/discovery/${symbol}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300_000);

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: apiKey ? { "X-API-Key": apiKey } : undefined,
    });

    if (!upstream.ok) {
      clearTimeout(timer);
      const body = await upstream.text();
      throw createError({ statusCode: upstream.status, statusMessage: body });
    }

    // Set SSE headers and pipe the stream through
    setResponseHeaders(event, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    return upstream.body;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
});

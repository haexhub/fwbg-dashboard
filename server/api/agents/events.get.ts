/**
 * GET /api/agents/events
 * SSE proxy: streams orchestrator events from fwbg-agents. Long-lived
 * heartbeat stream, so it's tied to the client disconnecting rather than
 * a fixed timeout.
 */
export default defineEventHandler(async (event) => {
  const apiUrl = process.env.FWBG_AGENTS_API_URL || "http://localhost:8421";
  const url = `${apiUrl}/events/stream`;

  const controller = new AbortController();
  event.node.req.on("close", () => controller.abort());

  const upstream = await fetch(url, { signal: controller.signal });

  if (!upstream.ok) {
    const body = await upstream.text();
    throw createError({ statusCode: upstream.status, statusMessage: body });
  }

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  return upstream.body;
});

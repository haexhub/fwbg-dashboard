/**
 * POST /api/research
 * Proxy to fwbg API: register a new research card.
 * A `warning` in the response means the card was written but not committed;
 * the card exists, so the request must not be retried.
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, newResearchCardSchema.parse);
  return fwbgFetch<unknown>("/api/research", {
    method: "POST",
    body: JSON.stringify(body),
  });
});

/**
 * POST /api/research
 * Proxy to fwbg API: register a new research card.
 * A `warning` in the response means the card was written but not committed;
 * the card exists, so the request must not be retried.
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, newResearchCardSchema.parse);
  const result = await fwbgFetch<unknown>("/api/research", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setResponseStatus(event, 201);
  return result;
});

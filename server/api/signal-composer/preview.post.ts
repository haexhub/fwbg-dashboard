export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch("/api/signal-composer/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
});

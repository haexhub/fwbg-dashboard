export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch<unknown>("/api/custom-signals", {
    method: "POST",
    body: JSON.stringify(body),
  });
});

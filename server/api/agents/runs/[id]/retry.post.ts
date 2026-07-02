export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch(`/agents/runs/${id}/retry`, { method: "POST" });
});

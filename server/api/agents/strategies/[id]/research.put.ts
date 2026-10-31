/**
 * PUT /api/agents/strategies/:id/research
 * Proxy to fwbg-agents: attach an existing register card to a lineage root.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readValidatedBody(event, attachCardBodySchema.parse);
  return fwbgAgentsFetch<{ strategy_id: number; research_id: string }>(
    `/strategies/${id}/research`,
    { method: "PUT", body: JSON.stringify(body) }
  );
});

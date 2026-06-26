import type { ResearchBriefInput, ResearchBriefResponse } from "~/types/agents";

/**
 * POST /api/agents/research/brief
 * Proxy to fwbg-agents: kick off Researcher -> Translator for a new hypothesis.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<ResearchBriefInput>(event);
  return fwbgAgentsFetch<ResearchBriefResponse>("/research/brief", {
    method: "POST",
    body: JSON.stringify(body),
  });
});

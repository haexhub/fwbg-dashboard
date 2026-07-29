import { fwbgAgentsFetch } from "~/server/utils/fwbg-agents-api";
import type { AgentSecretKey, AgentSecretsStatus, AgentSecretsUpdate } from "~/types/agents";
import { AGENT_SECRET_LABELS } from "~/types/agents";

const KNOWN_KEYS = Object.keys(AGENT_SECRET_LABELS) as AgentSecretKey[];

/**
 * PUT /api/agents/secrets
 * Proxy to fwbg-agents: set or clear one or more provider API keys. Keys
 * omitted from the body are left untouched (partial update). Unknown keys
 * and non-string/non-null values are dropped before forwarding; fwbg-agents
 * itself is the source of truth for what's actually valid.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event);
  const update: AgentSecretsUpdate = {};
  for (const key of KNOWN_KEYS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null) update[key] = null;
    else if (typeof value === "string") update[key] = value.trim();
  }
  return fwbgAgentsFetch<AgentSecretsStatus>("/agents/secrets", {
    method: "PUT",
    body: JSON.stringify(update),
  });
});

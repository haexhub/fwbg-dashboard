import { loadAccounts } from "~/server/utils/ig-client";
import { fwbgFetch } from "~/server/utils/fwbg-api";
import { claudeProxyFetch } from "~/server/utils/claude-proxy-api";
import type { ClaudeProxySetupStatus } from "~/types/claude-proxy";
import type { SetupStatus } from "~/types/setup";

/**
 * GET /api/setup/status
 *
 * Aggregated first-run readiness for the onboarding wizard, the dashboard
 * checklist and the redirect middleware. Each backend is probed independently
 * with a short timeout; a failing/unreachable backend degrades to `false`
 * ("not configured yet") instead of bubbling up a 500.
 */
export default defineEventHandler(async (): Promise<SetupStatus> => {
  const [hasDataSource, hasBroker, hasLlm] = await Promise.all([
    fwbgFetch<unknown[]>("/api/datasources", { timeout: 4000 })
      .then((s) => Array.isArray(s) && s.length > 0)
      .catch(() => false),
    loadAccounts()
      .then((a) => a.length > 0)
      .catch(() => false),
    claudeProxyFetch<ClaudeProxySetupStatus>("/setup/status", { timeout: 4000 })
      .then((s) => !!s.credentialsExist && (s.state === "idle" || s.state === "done"))
      .catch(() => false),
  ]);

  return {
    hasDataSource,
    hasBroker,
    hasLlm,
    // A broker is only needed for paper/live trading, so it does not block
    // completion — it shows up as an optional step in the wizard/checklist.
    isComplete: hasDataSource && hasLlm,
  };
});

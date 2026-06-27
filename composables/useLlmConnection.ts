import type { ClaudeProxySetupStatus } from "~/types/claude-proxy";

/**
 * Composable for the haex-claude-proxy OAuth setup flow. `useFetch`'s
 * shared payload cache means the header badge and the /agents page's
 * connection card stay in sync without any extra plumbing — both just
 * call this composable.
 */
export function useLlmConnection() {
  const {
    data: status,
    status: fetchStatus,
    error,
    refresh,
  } = useFetch<ClaudeProxySetupStatus>("/api/agents/llm/status", {
    key: "llm-connection-status",
  });

  /** True once the request to claude-proxy itself failed (container down, etc.) — distinct from "not logged in yet". */
  const unreachable = computed(() => fetchStatus.value === "error");

  async function startLogin(): Promise<{ oauthUrl: string }> {
    const result = await $fetch<{ oauthUrl: string }>("/api/agents/llm/login", {
      method: "POST",
    });
    await refresh();
    return result;
  }

  async function submitCode(code: string): Promise<void> {
    await $fetch("/api/agents/llm/code", {
      method: "POST",
      body: { code },
    });
    await refresh();
  }

  async function reset(): Promise<void> {
    await $fetch("/api/agents/llm/reset", { method: "POST" });
    await refresh();
  }

  return {
    status,
    unreachable,
    error,
    refresh,
    startLogin,
    submitCode,
    reset,
  };
}

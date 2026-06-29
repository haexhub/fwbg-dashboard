import type { SetupStatus, SetupStep } from "~/types/setup";

/**
 * Aggregated onboarding readiness, shared by the /setup wizard, the dashboard
 * checklist card and the redirect middleware. Backed by the server aggregator
 * `/api/setup/status` (one resilient call, see that handler). The `useFetch`
 * key means every consumer stays in sync and a single `refresh()` updates all.
 */
export function useSetupStatus() {
  const { data, refresh, status } = useFetch<SetupStatus>("/api/setup/status", {
    key: "setup-status",
    default: () => ({
      hasDataSource: false,
      hasBroker: false,
      hasLlm: false,
      isComplete: false,
    }),
  });

  // Non-blocking dismissal: the wizard's "Später" button sets this and the
  // middleware then stops auto-redirecting. A cookie so it survives reloads
  // and is readable during SSR (the middleware runs server-side too).
  const dismissed = useCookie<boolean>("fwbg_setup_dismissed", {
    default: () => false,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const isComplete = computed(() => data.value?.isComplete ?? false);

  const steps = computed<SetupStep[]>(() => [
    {
      key: "data",
      label: "Datenquelle",
      description:
        "Historische Kursdaten (CSV-Upload, URL/REST oder Dukascopy) für die Assets, die getestet werden sollen.",
      done: data.value?.hasDataSource ?? false,
      to: "/datasources",
      required: true,
      icon: "i-heroicons-circle-stack",
    },
    {
      key: "broker",
      label: "Broker",
      description:
        "Broker-Account (IG) für Paper- und Live-Trading. Optional – nur nötig, wenn Strategien echt traden sollen.",
      done: data.value?.hasBroker ?? false,
      to: "/settings",
      required: false,
      icon: "i-heroicons-building-library",
    },
    {
      key: "llm",
      label: "Claude-Verbindung",
      description:
        "Verbindung zu Claude (über haex-claude-proxy). Ohne sie können die Agents nicht arbeiten.",
      done: data.value?.hasLlm ?? false,
      to: "/ai",
      required: true,
      icon: "i-heroicons-cpu-chip",
    },
  ]);

  return { data, status, refresh, dismissed, isComplete, steps };
}

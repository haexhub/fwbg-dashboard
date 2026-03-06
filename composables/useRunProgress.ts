import { useIntervalFn } from "@vueuse/core";
import type {
  RunProgress,
  RunLogEntry,
  LogLevel,
  AssetProgress,
} from "~/types/run-progress";

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  completed: 1,
  pending: 2,
  failed: 3,
  skipped: 4,
};

export function useRunProgress(runId: MaybeRef<string>, options: {
  progressInterval?: number;
  logsInterval?: number;
  logLimit?: number;
} = {}) {
  const {
    progressInterval = 2000,
    logsInterval = 4000,
    logLimit = 500,
  } = options;

  const id = toValue(runId);

  // ── State ──
  const progress = ref<RunProgress | null>(null);
  const logs = ref<RunLogEntry[]>([]);
  const progressError = ref<string | null>(null);
  const logsError = ref<string | null>(null);

  // ── Filters ──
  const logLevelFilter = ref<LogLevel | undefined>(undefined);
  const logSymbolFilter = ref<string | undefined>(undefined);

  // ── Derived ──
  const isTerminal = computed(() => {
    const s = progress.value?.status;
    return s === "completed" || s === "failed";
  });

  const isActive = computed(() => {
    const s = progress.value?.status;
    return s === "initializing" || s === "running";
  });

  const assetList = computed<AssetProgress[]>(() => {
    if (!progress.value?.assets) return [];
    return Object.values(progress.value.assets)
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5));
  });

  const availableSymbols = computed(() => {
    if (!progress.value?.assets) return [];
    return Object.keys(progress.value.assets).sort();
  });

  // ── Fetchers ──
  async function fetchProgress() {
    try {
      progress.value = await $fetch<RunProgress>(`/api/runs/${id}/progress`);
      progressError.value = null;
    } catch (e) {
      progressError.value = e instanceof Error ? e.message : "Failed to fetch progress";
    }
  }

  async function fetchLogs() {
    try {
      const params: Record<string, string | number> = { limit: logLimit };
      if (logLevelFilter.value) params.level = logLevelFilter.value;
      if (logSymbolFilter.value) params.symbol = logSymbolFilter.value;

      logs.value = await $fetch<RunLogEntry[]>(`/api/runs/${id}/logs`, { query: params });
      logsError.value = null;
    } catch (e) {
      logsError.value = e instanceof Error ? e.message : "Failed to fetch logs";
    }
  }

  // ── Polling ──
  const { pause: pauseProgress, resume: resumeProgress } = useIntervalFn(
    fetchProgress,
    progressInterval,
    { immediate: false },
  );

  const { pause: pauseLogs, resume: resumeLogs } = useIntervalFn(
    fetchLogs,
    logsInterval,
    { immediate: false },
  );

  function stopPolling() {
    pauseProgress();
    pauseLogs();
  }

  watch(isTerminal, (terminal) => {
    if (terminal) {
      stopPolling();
      fetchLogs();
    }
  });

  watch([logLevelFilter, logSymbolFilter], () => {
    fetchLogs();
  });

  // ── Lifecycle ──
  async function init() {
    await Promise.all([fetchProgress(), fetchLogs()]);
    if (!isTerminal.value) {
      resumeProgress();
      resumeLogs();
    }
  }

  onBeforeUnmount(stopPolling);

  return {
    progress,
    logs,
    progressError,
    logsError,
    isTerminal,
    isActive,
    assetList,
    availableSymbols,
    logLevelFilter,
    logSymbolFilter,
    init,
    stopPolling,
    fetchProgress,
    fetchLogs,
  };
}

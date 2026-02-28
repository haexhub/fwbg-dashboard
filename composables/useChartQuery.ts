import { useDebounceFn } from "@vueuse/core";

/**
 * URL query-param persistence for the chart view.
 *
 * Provides reactive computed accessors for every chart-state query param and
 * a debounced `syncToUrl` function that writes current state back to the URL
 * without pushing a new history entry.
 *
 * URL key ↔ meaning
 *   source            data source name (e.g. "dukascopy")
 *   symbol            chart symbol AND trade-overlay asset (e.g. "EURUSD")
 *   timeframe         bar timeframe (e.g. "HOUR")
 *   chartType         kline style — omitted when default "candle_solid"
 *   rangeInterval     range-rect mode (e.g. "1d") — omitted when empty
 *   rangeStartTime    range start HH:MM — only written with rangeInterval
 *   rangeEndTime      range end   HH:MM — only written with rangeInterval
 *   rangeWeekdays     comma-separated day numbers — omitted when "1,2,3,4,5"
 *   rangeUseOpenClose "1" when enabled — omitted otherwise
 *   sessionIds        comma-separated session id list — omitted when empty
 *   indicators        JSON array of active indicators — omitted when empty
 *   run               trade-overlay run id (preserved but not written here)
 */

export interface ChartUrlIndicator {
  fqn: string;
  params: Record<string, unknown>;
  columns: string[];
  isSignal: boolean;
}

export interface ChartUrlState {
  source: string;
  symbol: string;
  timeframe: string;
  chartType: string;
  rangeInterval: string;
  rangeStartTime: string;
  rangeEndTime: string;
  rangeWeekdays: number[];
  rangeUseOpenClose: boolean;
  sessionIds: string[];
  indicators: ChartUrlIndicator[];
}

export function useChartQuery() {
  const route = useRoute();
  const router = useRouter();
  const { plugins } = storeToRefs(usePluginStore());

  // ── Reactive query-param accessors ──
  const querySource            = computed(() => route.query.source            as string | undefined);
  const querySymbol            = computed(() => route.query.symbol            as string | undefined);
  const queryTimeframe         = computed(() => route.query.timeframe         as string | undefined);
  const queryChartType         = computed(() => route.query.chartType         as string | undefined);
  const queryRangeInterval     = computed(() => route.query.rangeInterval     as string | undefined);
  const queryRangeStartTime    = computed(() => route.query.rangeStartTime    as string | undefined);
  const queryRangeEndTime      = computed(() => route.query.rangeEndTime      as string | undefined);
  const queryRangeWeekdays     = computed(() => route.query.rangeWeekdays     as string | undefined);
  const queryRangeUseOpenClose = computed(() => route.query.rangeUseOpenClose as string | undefined);
  const querySessionIds        = computed(() => route.query.sessionIds        as string | undefined);
  const queryRunId             = computed(() => route.query.run               as string | undefined);
  const queryIndicators        = computed(() => route.query.indicators        as string | undefined);
  const queryStrategy          = computed(() => route.query.strategy          as string | undefined);

  // ── Debounced URL sync ──
  const syncToUrl = useDebounceFn((state: ChartUrlState) => {
    if (!state.source) return;

    const query: Record<string, string> = {};

    // Preserve the trade-overlay run param when active
    if (queryRunId.value) query.run = queryRunId.value;
    // Preserve strategy reference
    if (queryStrategy.value) query.strategy = queryStrategy.value;

    query.source    = state.source;
    query.symbol    = state.symbol;
    query.timeframe = state.timeframe;
    if (state.chartType !== "candle_solid") query.chartType = state.chartType;

    if (state.rangeInterval) {
      query.rangeInterval  = state.rangeInterval;
      query.rangeStartTime = state.rangeStartTime;
      query.rangeEndTime   = state.rangeEndTime;
      if (state.rangeWeekdays.join(",") !== "1,2,3,4,5") {
        query.rangeWeekdays = state.rangeWeekdays.join(",");
      }
      if (state.rangeUseOpenClose) query.rangeUseOpenClose = "1";
    }

    if (state.sessionIds.length) query.sessionIds = state.sessionIds.join(",");

    const validIndicators = state.indicators.filter((ind) =>
      plugins.value.some((p) => p.fqn === ind.fqn),
    );
    if (validIndicators.length) query.indicators = JSON.stringify(validIndicators);

    router.replace({ query });
  }, 500);

  return {
    querySource,
    querySymbol,
    queryTimeframe,
    queryChartType,
    queryRangeInterval,
    queryRangeStartTime,
    queryRangeEndTime,
    queryRangeWeekdays,
    queryRangeUseOpenClose,
    querySessionIds,
    queryRunId,
    queryIndicators,
    queryStrategy,
    syncToUrl,
  };
}

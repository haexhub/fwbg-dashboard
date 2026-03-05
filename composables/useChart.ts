import type {
  ChartSource,
  ChartSymbol,
  ActiveIndicator,
} from "~/types/chart";
import type { ChartUrlIndicator } from "~/composables/useChartQuery";

export function useChart() {
  // ── Source, Symbol & Timeframe ──
  const source = ref("");
  const symbol = ref("EURUSD");
  const timeframe = ref("HOUR");

  // ── Available sources ──
  const { data: sources } = useFetch<ChartSource[]>("/api/chart/sources", {
    default: () => [],
  });

  // Auto-select first source once sources are loaded
  watch(sources, (list) => {
    if (list && list.length > 0 && !list.find((s) => s.name === source.value)) {
      source.value = list[0]!.name;
      const firstSymbol = list[0]!.symbols[0]?.symbol;
      if (firstSymbol) symbol.value = firstSymbol;
    }
  }, { immediate: true });

  // ── Derived: current source, symbols, timeframes ──
  const currentSource = computed(
    () => sources.value?.find((s) => s.name === source.value)
  );

  const availableSymbols = computed<ChartSymbol[]>(
    () => currentSource.value?.symbols ?? []
  );

  const currentSymbol = computed(
    () => availableSymbols.value.find((s) => s.symbol === symbol.value)
  );

  const availableTimeframes = computed<string[]>(
    () => currentSymbol.value?.timeframes ?? []
  );

  // ── Active Indicators ──
  const activeIndicators = ref<ActiveIndicator[]>([]);
  let _syncIndicators: ((indicators: ChartUrlIndicator[]) => void) | null = null;

  function setSyncIndicators(fn: (indicators: ChartUrlIndicator[]) => void) {
    _syncIndicators = fn;
  }

  function _syncToUrl() {
    if (!_syncIndicators) return;
    _syncIndicators(activeIndicators.value.map((i) => ({
      fqn: i.fqn,
      params: i.params,
      columns: i.columns,
      isSignal: i.isSignal || false,
      ...(i.indicatorTimeframe ? { indicatorTimeframe: i.indicatorTimeframe } : {}),
    })));
  }

  function addIndicator(indicator: ActiveIndicator) {
    activeIndicators.value.push(indicator);
    _syncToUrl();
  }

  function removeIndicator(id: string) {
    activeIndicators.value = activeIndicators.value.filter((i) => i.id !== id);
    _syncToUrl();
  }

  // ── Chart Type ──
  const chartType = ref<"candle_solid" | "ohlc" | "area">("candle_solid");

  function setChartType(type: "candle_solid" | "ohlc" | "area") {
    chartType.value = type;
  }

  // ── Drawing Tools ──
  const activeDrawingTool = ref<string | null>(null);

  function setDrawingTool(tool: string | null) {
    activeDrawingTool.value = tool;
  }

  // ── Setters ──
  function setSource(s: string) {
    source.value = s;
    const firstSymbol = sources.value?.find((src) => src.name === s)?.symbols[0]
      ?.symbol;
    if (firstSymbol) symbol.value = firstSymbol;
  }

  function setSymbol(s: string) {
    symbol.value = s;
    const sym = availableSymbols.value.find((x) => x.symbol === s);
    if (sym && !sym.timeframes.includes(timeframe.value)) {
      timeframe.value = sym.timeframes[0] ?? "HOUR";
    }
  }

  function setTimeframe(tf: string) {
    timeframe.value = tf;
  }

  return {
    source: readonly(source),
    symbol: readonly(symbol),
    timeframe: readonly(timeframe),
    sources,
    currentSource,
    availableSymbols,
    currentSymbol,
    availableTimeframes,
    activeIndicators,
    activeDrawingTool,
    chartType: readonly(chartType),
    setSource,
    setSymbol,
    setTimeframe,
    setChartType,
    addIndicator,
    removeIndicator,
    setSyncIndicators,
    setDrawingTool,
  };
}

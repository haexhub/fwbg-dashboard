import type { RunTradeMarker } from "~/composables/useChartIndicators";

interface PreviewTradeState {
  markers: RunTradeMarker[];
  strategyName: string;
}

/**
 * Shared state for passing preview trade markers from the strategy preview
 * panel to the chart page. Indicators travel via URL query params instead.
 */
export function usePreviewTrades() {
  const state = useState<PreviewTradeState | null>("preview-trades", () => null);

  function set(data: PreviewTradeState) {
    state.value = data;
  }

  function consume(): PreviewTradeState | null {
    const data = state.value;
    state.value = null;
    return data;
  }

  return { state, set, consume };
}

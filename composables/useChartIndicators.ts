import { registerIndicator } from "klinecharts";
import type { IndicatorResponse } from "~/types/chart";

// Distinct colors for indicator lines (dark-bg friendly)
export const LINE_COLORS = [
  "#2196F3", // blue
  "#FF9800", // orange
  "#4CAF50", // green
  "#E91E63", // pink
  "#00BCD4", // cyan
  "#FFEB3B", // yellow
  "#9C27B0", // purple
  "#FF5722", // deep orange
  "#8BC34A", // light green
  "#03A9F4", // light blue
  "#F44336", // red
  "#009688", // teal
  "#CDDC39", // lime
  "#3F51B5", // indigo
  "#FFC107", // amber
  "#607D8B", // blue grey
];

/**
 * Strip common prefix from column names for a shorter legend.
 * e.g. ["ichi_tenkan", "ichi_kijun", "ichi_senkou_a"] → ["tenkan", "kijun", "senkou_a"]
 */
function _shortenColumns(columns: string[]): string[] {
  if (columns.length <= 1) return columns;
  // Find common prefix up to last underscore
  const parts = columns.map((c) => c.split("_"));
  let commonLen = 0;
  for (let i = 0; i < parts[0]!.length - 1; i++) {
    if (parts.every((p) => p[i] === parts[0]![i])) {
      commonLen = i + 1;
    } else {
      break;
    }
  }
  if (commonLen === 0) return columns;
  return columns.map((c) => c.split("_").slice(commonLen).join("_"));
}

/**
 * Auto-detect appropriate decimal precision from indicator data.
 * Looks at actual values to determine if they're integers, low-precision, etc.
 */
function _detectPrecision(
  response: IndicatorResponse,
  columns: string[]
): number {
  let maxDecimals = 0;
  const sampleSize = Math.min(200, response.timestamps.length);
  for (const col of columns) {
    const values = response.data[col];
    if (!values) continue;
    for (let i = 0; i < sampleSize; i++) {
      const v = values[i];
      if (v == null) continue;
      const str = String(v);
      const dotIdx = str.indexOf(".");
      if (dotIdx >= 0) {
        // Trim trailing zeros to find meaningful precision
        const decimals = str.replace(/0+$/, "").length - dotIdx - 1;
        maxDecimals = Math.max(maxDecimals, Math.min(decimals, 4));
      }
    }
  }
  return maxDecimals;
}

/**
 * Build a timestamp → index lookup map from IndicatorResponse.
 */
function _buildTimestampIndex(
  response: IndicatorResponse
): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < response.timestamps.length; i++) {
    map.set(response.timestamps[i]!, i);
  }
  return map;
}

/**
 * Build a calc function that maps kline bars to pre-computed indicator data.
 * Uses index-based alignment with timestamp verification fallback.
 */
function _buildCalc(
  response: IndicatorResponse,
  columns: string[]
): (klineDataList: { timestamp: number }[]) => Record<string, number | null>[] {
  const tsIndex = _buildTimestampIndex(response);
  let diagnosed = false;

  return (klineDataList) => {
    // Try index-based alignment first (both datasets load from end with same limit)
    const offset = klineDataList.length - response.timestamps.length;

    // Diagnose on first call
    if (!diagnosed) {
      diagnosed = true;
      let indexMatches = 0;
      let tsMatches = 0;
      const sample = Math.min(100, klineDataList.length);
      for (let i = 0; i < sample; i++) {
        const idx = klineDataList.length - 1 - i;
        const dataIdx = idx - offset;
        if (dataIdx >= 0 && dataIdx < response.timestamps.length) {
          if (klineDataList[idx]!.timestamp === response.timestamps[dataIdx]) {
            indexMatches++;
          }
        }
        if (tsIndex.has(klineDataList[idx]!.timestamp)) {
          tsMatches++;
        }
      }
      if (indexMatches < sample * 0.9) {
        console.warn(
          `[fwbg] Indicator alignment: index=${indexMatches}/${sample}, ts=${tsMatches}/${sample}, ` +
          `kline=${klineDataList.length}, indicator=${response.timestamps.length}`
        );
      }
    }

    return klineDataList.map((kline, i) => {
      // Primary: index-based alignment
      const dataIdx = i - offset;
      if (dataIdx >= 0 && dataIdx < response.timestamps.length) {
        // Verify timestamp matches (fast path)
        if (kline.timestamp === response.timestamps[dataIdx]) {
          const result: Record<string, number | null> = {};
          for (const col of columns) {
            result[col] = response.data[col]?.[dataIdx] ?? null;
          }
          return result;
        }
      }
      // Fallback: timestamp lookup
      const tsIdx = tsIndex.get(kline.timestamp);
      if (tsIdx !== undefined) {
        const result: Record<string, number | null> = {};
        for (const col of columns) {
          result[col] = response.data[col]?.[tsIdx] ?? null;
        }
        return result;
      }
      return {};
    });
  };
}

/**
 * Register a fwbg plugin's pre-computed output as a KLineChart custom indicator.
 *
 * Uses index-based alignment (primary) with timestamp lookup fallback.
 * Colors are set via the indicator-level `styles` property for consistent
 * line segment merging in KlineCharts.
 */
export function registerFwbgIndicator(
  indicatorId: string,
  response: IndicatorResponse,
  columns: string[],
  colors?: Record<string, string>
) {
  // Shorten column names for legend: strip common prefix
  const shortNames = _shortenColumns(columns);

  // Auto-detect precision from data values
  const precision = _detectPrecision(response, columns);

  // Build line styles for the indicator-level styles property
  const lines = columns.map((col, i) => {
    const color = colors?.[col] ?? LINE_COLORS[i % LINE_COLORS.length]!;
    return { style: "solid" as const, size: 1, color, smooth: false, dashedValue: [2, 2] };
  });

  registerIndicator({
    name: indicatorId,
    shortName: indicatorId.replace(/^fwbg_/, "").replace(/_\d+$/, ""),
    precision,
    calcParams: [],
    styles: { lines },
    figures: columns.map((col, i) => ({
      key: col,
      title: `${shortNames[i]}: `,
      type: "line" as const,
    })),
    calc: _buildCalc(response, columns),
  });
}

/**
 * Register signal columns ({-1, 0, 1}) as a histogram-bar indicator.
 * Each signal gets its own bar with dynamic color (green = 1, red = -1, gray = 0).
 */
export function registerFwbgSignalIndicator(
  indicatorId: string,
  response: IndicatorResponse,
  columns: string[],
  colors?: Record<string, string>
) {
  const shortNames = _shortenColumns(columns);

  registerIndicator({
    name: indicatorId,
    shortName: indicatorId.replace(/^fwbg_/, "").replace(/_\d+$/, "") + " (sig)",
    precision: 0,
    calcParams: [],
    figures: columns.map((col, i) => {
      const baseColor = colors?.[col] ?? LINE_COLORS[i % LINE_COLORS.length]!;
      return {
        key: col,
        title: `${shortNames[i]}: `,
        type: "bar" as const,
        baseValue: 0,
        styles: (params: { data: { current: Record<string, unknown> | null } }) => {
          const val = (params.data.current as Record<string, unknown> | null)?.[col] as number | null;
          if (val == null || val === 0) return { color: "rgba(100,100,100,0.3)" };
          return {
            color: val > 0 ? baseColor : adjustColorOpacity(baseColor, 0.6),
          };
        },
      };
    }),
    calc: _buildCalc(response, columns),
  });
}

/**
 * Stable signal marker overlay for the candle pane.
 * Uses mutable data so we can update without re-registering.
 * Markers are color-coded by signal value:
 *   value > 0 (e.g. 1)  → green triangle up (positive signal)
 *   value < 0 (e.g. -1) → red triangle down (negative signal)
 *   value === 0          → small gray dot (neutral/reset)
 */
export const SIGNAL_MARKER_NAME = "fwbg_signal_markers";

// Mutable data — updated in-place, read by the registered indicator's draw
const _signalTimestampSet = new Set<number>();
const _signalValueMap = new Map<number, number>();
let _signalMarkerRegistered = false;

export function updateSignalMarkerData(
  timestamps: number[],
  valueMap?: Map<number, number>
) {
  _signalTimestampSet.clear();
  _signalValueMap.clear();
  for (const ts of timestamps) {
    _signalTimestampSet.add(ts);
  }
  if (valueMap) {
    for (const [ts, val] of valueMap) {
      _signalValueMap.set(ts, val);
    }
  }
}

function _getSignalColor(value: number): string {
  if (value > 0) return "rgba(76, 175, 80, 0.9)";   // green
  if (value < 0) return "rgba(244, 67, 54, 0.9)";   // red
  return "rgba(158, 158, 158, 0.6)";                 // gray
}

export function ensureSignalMarkerRegistered() {
  if (_signalMarkerRegistered) return;
  _signalMarkerRegistered = true;

  registerIndicator({
    name: SIGNAL_MARKER_NAME,
    shortName: "",
    calcParams: [],
    figures: [],
    calc: (klineDataList) => klineDataList.map(() => ({})),
    draw: ({ ctx, chart, xAxis, yAxis }) => {
      if (_signalTimestampSet.size === 0) return true;

      const range = chart.getVisibleRange();
      const data = chart.getDataList();

      ctx.save();
      for (let i = range.from; i <= range.to; i++) {
        const bar = data[i];
        if (!bar || !_signalTimestampSet.has(bar.timestamp)) continue;

        const x = xAxis.convertToPixel(i);
        const value = _signalValueMap.get(bar.timestamp) ?? 0;
        const color = _getSignalColor(value);

        if (value > 0) {
          // Green upward triangle below candle low
          const y = yAxis.convertToPixel(bar.low) + 12;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 5, y + 9);
          ctx.lineTo(x + 5, y + 9);
          ctx.closePath();
          ctx.fill();
        } else if (value < 0) {
          // Red downward triangle above candle high
          const y = yAxis.convertToPixel(bar.high) - 12;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 5, y - 9);
          ctx.lineTo(x + 5, y - 9);
          ctx.closePath();
          ctx.fill();
        } else {
          // Gray dot below candle low
          const y = yAxis.convertToPixel(bar.low) + 14;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return true;
    },
  });
}

/**
 * Adjust a hex color's opacity by mixing with black.
 */
function adjustColorOpacity(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, 0.8)`;
}

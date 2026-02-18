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
 * Register a fwbg plugin's pre-computed output as a KLineChart custom indicator.
 *
 * Builds a timestamp → values lookup map. The KLineChart `calc` function
 * maps each bar's timestamp to the pre-computed server-side values.
 */
export function registerFwbgIndicator(
  indicatorId: string,
  response: IndicatorResponse,
  columns: string[],
  colors?: Record<string, string>
) {
  const dataMap = new Map<number, Record<string, number | null>>();
  for (let i = 0; i < response.timestamps.length; i++) {
    const entry: Record<string, number | null> = {};
    for (const col of columns) {
      entry[col] = response.data[col]?.[i] ?? null;
    }
    dataMap.set(response.timestamps[i]!, entry);
  }

  // Shorten column names for legend: strip common prefix
  const shortNames = _shortenColumns(columns);

  registerIndicator({
    name: indicatorId,
    shortName: indicatorId.replace(/^fwbg_/, "").replace(/_\d+$/, ""),
    calcParams: [],
    figures: columns.map((col, i) => {
      const color = colors?.[col] ?? LINE_COLORS[i % LINE_COLORS.length]!;
      return {
        key: col,
        title: `${shortNames[i]}: `,
        type: "line" as const,
        styles: () => ({ color }),
      };
    }),
    calc: (klineDataList) => {
      return klineDataList.map((kline) => {
        const entry = dataMap.get(kline.timestamp);
        if (!entry) return {};
        const result: Record<string, number | null> = {};
        for (const col of columns) {
          result[col] = entry[col] ?? null;
        }
        return result;
      });
    },
  });
}

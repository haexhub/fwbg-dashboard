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

// ─────────────────────────────────────────────────────────────────────────────
// Trade Overlay — draws run backtest trades on the candle pane
// Each trade: entry triangle + exit circle + TP/SL dashed lines + connector
// ─────────────────────────────────────────────────────────────────────────────

export const TRADE_MARKER_NAME = "fwbg_trade_markers";

export interface RunTradeMarker {
  entryTime: number;        // ms timestamp
  exitTime: number;         // ms timestamp
  entryPrice: number;
  exitPrice: number;
  direction: "LONG" | "SHORT";
  result: number;           // 1 = win, -1 = loss
  pnlRaw: number;
  tpLevel?: number;
  slLevel?: number;
  foldId?: number;
}

const _tradeMarkers: RunTradeMarker[] = [];
let _tradeMarkerRegistered = false;
let _tradeDrawDebugDone = false;
let _tradeDrawDebugCount = 0;

export function updateTradeMarkerData(trades: RunTradeMarker[]) {
  _tradeMarkers.length = 0;
  _tradeMarkers.push(...trades);
  _tradeDrawDebugDone = false;
}

export function clearTradeMarkerData() {
  _tradeMarkers.length = 0;
}

export function ensureTradeMarkerRegistered() {
  if (_tradeMarkerRegistered) return;
  _tradeMarkerRegistered = true;

  registerIndicator({
    name: TRADE_MARKER_NAME,
    shortName: "",
    calcParams: [],
    figures: [],
    calc: (klineDataList) => klineDataList.map(() => ({})),
    draw: ({ ctx, chart, xAxis, yAxis }) => {
      if (_tradeMarkers.length === 0) return true;

      const data = chart.getDataList();
      const range = chart.getVisibleRange();
      if (data.length === 0) return true;

      // Build full timestamp → bar-index map (all bars, not just visible)
      const tsToIdx = new Map<number, number>();
      for (let i = 0; i < data.length; i++) {
        tsToIdx.set(data[i]!.timestamp, i);
      }

      // Find bar index for a timestamp: exact match, snap to nearest loaded bar,
      // or interpolate fractional index for timestamps outside loaded range
      function findBarIndex(targetTs: number): number {
        // Exact match
        const exact = tsToIdx.get(targetTs);
        if (exact !== undefined) return exact;

        // Binary search: find bar with largest timestamp <= target
        let lo = 0, hi = data.length - 1, snapIdx = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (data[mid]!.timestamp <= targetTs) { snapIdx = mid; lo = mid + 1; }
          else { hi = mid - 1; }
        }

        if (snapIdx >= 0 && snapIdx < data.length - 1) {
          // Interpolate between two bars for sub-bar precision
          const t0 = data[snapIdx]!.timestamp;
          const t1 = data[snapIdx + 1]!.timestamp;
          const frac = (targetTs - t0) / (t1 - t0);
          return snapIdx + Math.min(frac, 1);
        }
        if (snapIdx >= 0) return snapIdx;

        // Target is before all loaded bars — extrapolate using avg bar spacing
        if (data.length >= 2) {
          const avgSpacing = (data[data.length - 1]!.timestamp - data[0]!.timestamp) / (data.length - 1);
          if (avgSpacing > 0) {
            return (targetTs - data[0]!.timestamp) / avgSpacing; // negative index = before loaded data
          }
        }
        return 0;
      }

      // Debug: log once per data change how many trades are drawn vs skipped
      if (!_tradeDrawDebugDone || _tradeDrawDebugCount !== _tradeMarkers.length) {
        _tradeDrawDebugCount = _tradeMarkers.length;
        _tradeDrawDebugDone = true;
        let drawn = 0, skipped = 0, beforeRange = 0, afterRange = 0;
        for (const t of _tradeMarkers) {
          const eIdx = findBarIndex(t.entryTime);
          const xIdx = findBarIndex(t.exitTime);
          const eVis = eIdx >= range.from - 5 && eIdx <= range.to + 5;
          const xVis = xIdx >= range.from - 5 && xIdx <= range.to + 5;
          if (eVis || xVis) { drawn++; } else {
            skipped++;
            if (eIdx < range.from) beforeRange++;
            else afterRange++;
          }
        }
        console.log(`[trade draw] total=${_tradeMarkers.length}, drawn=${drawn}, skipped=${skipped} (before=${beforeRange}, after=${afterRange}), bars=${data.length}, visible=${range.from}-${range.to}`);
      }

      ctx.save();
      ctx.setLineDash([]);

      for (const trade of _tradeMarkers) {
        const entryIdx = findBarIndex(trade.entryTime);
        const exitIdx  = findBarIndex(trade.exitTime);

        const isLong = trade.direction === "LONG";
        const isWin  = trade.result > 0;

        // Colors: LONG entry = teal, SHORT entry = orange, win exit = green, loss exit = red
        const entryColor = isLong ? "#14b8a6" : "#f97316";
        const exitColor  = isWin  ? "#22c55e" : "#ef4444";
        const lineColor  = isWin  ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.5)";

        const entryX = xAxis.convertToPixel(entryIdx);
        const exitX  = xAxis.convertToPixel(exitIdx);
        const entryY = yAxis.convertToPixel(trade.entryPrice);
        const exitY  = yAxis.convertToPixel(trade.exitPrice);

        // Only draw if at least one endpoint is near the visible bar range
        const entryVisible = entryIdx >= range.from - 5 && entryIdx <= range.to + 5;
        const exitVisible  = exitIdx  >= range.from - 5 && exitIdx  <= range.to + 5;
        if (!entryVisible && !exitVisible) continue;

        // ── TP / SL dashed horizontal lines (entry → exit) ──
        if (trade.tpLevel != null) {
          const tpY = yAxis.convertToPixel(trade.tpLevel);
          ctx.strokeStyle = "rgba(34,197,94,0.35)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(entryX, tpY);
          ctx.lineTo(exitX, tpY);
          ctx.stroke();
        }
        if (trade.slLevel != null) {
          const slY = yAxis.convertToPixel(trade.slLevel);
          ctx.strokeStyle = "rgba(239,68,68,0.35)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(entryX, slY);
          ctx.lineTo(exitX, slY);
          ctx.stroke();
        }

        // ── Connector line (entry price → exit price) ──
        ctx.setLineDash([]);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(exitX, exitY);
        ctx.stroke();

        // ── Entry triangle (▲ LONG below price, ▼ SHORT above price) ──
        if (entryVisible) {
          const s = 10;
          const h = 14;
          ctx.fillStyle = entryColor;
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (isLong) {
            const ty = entryY + 20;
            ctx.moveTo(entryX,      ty - h);
            ctx.lineTo(entryX - s,  ty);
            ctx.lineTo(entryX + s,  ty);
          } else {
            const ty = entryY - 20;
            ctx.moveTo(entryX,      ty + h);
            ctx.lineTo(entryX - s,  ty);
            ctx.lineTo(entryX + s,  ty);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // ── Exit circle ──
        if (exitVisible) {
          ctx.fillStyle = exitColor;
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(exitX, exitY, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
      return true;
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Range Rectangles — groups bars into calendar-based time windows and draws
// alternating rects spanning each window's high/low price range
// ─────────────────────────────────────────────────────────────────────────────

export const RANGE_RECT_NAME = "fwbg_range_rects";

let _rangeMode = "";  // "", "1h", "4h", "8h", "1d", "1w", "1m"
let _rangeStartMinutes = 0;  // minutes from midnight (0+0 = no filter)
let _rangeEndMinutes = 0;
let _rangeWeekdays = new Set([1, 2, 3, 4, 5]); // 0=Sun .. 6=Sat, default Mon-Fri
let _rangeChartTimeframe = "HOUR"; // chart timeframe — time filter only applies to intraday
let _rangeUseOpenClose = false; // true = use open/close instead of high/low for rect bounds
let _rangeRectRegistered = false;

const RANGE_COLORS = [
  "rgba(59, 130, 246, 0.10)",   // blue
  "rgba(139, 92, 246, 0.10)",   // purple
];
const RANGE_BORDERS = [
  "rgba(59, 130, 246, 0.30)",
  "rgba(139, 92, 246, 0.30)",
];

export function updateRangeMode(mode: string) {
  _rangeMode = mode;
}

export function updateRangeTimeFilter(startMinutes: number, endMinutes: number) {
  _rangeStartMinutes = startMinutes;
  _rangeEndMinutes = endMinutes;
}

export function updateRangeWeekdays(days: number[]) {
  _rangeWeekdays = new Set(days);
}

export function updateRangeChartTimeframe(tf: string) {
  _rangeChartTimeframe = tf;
}

export function updateRangeUseOpenClose(value: boolean) {
  _rangeUseOpenClose = value;
}

const INTRADAY_TIMEFRAMES = new Set(["MINUTE_1", "MINUTE_5", "MINUTE_15", "MINUTE_30", "HOUR", "HOUR_4"]);

/** Check if bar falls within the time-of-day filter (local time, matching x-axis) */
function _isInTimeRange(timestamp: number): boolean {
  if (_rangeStartMinutes === 0 && _rangeEndMinutes === 0) return true;
  // Time filter only makes sense for intraday chart timeframes
  if (!INTRADAY_TIMEFRAMES.has(_rangeChartTimeframe)) return true;
  const d = new Date(timestamp);
  const m = d.getHours() * 60 + d.getMinutes();
  if (_rangeStartMinutes <= _rangeEndMinutes) {
    return m >= _rangeStartMinutes && m < _rangeEndMinutes;
  }
  // Overnight range (e.g. 22:00–06:00)
  return m >= _rangeStartMinutes || m < _rangeEndMinutes;
}

/** Check if bar falls on an allowed weekday (for 1w mode) */
function _isAllowedWeekday(timestamp: number): boolean {
  return _rangeWeekdays.has(new Date(timestamp).getDay());
}

/** Calendar-based window ID computation (local time, matching x-axis) */
function _getWindowId(timestamp: number): number {
  const d = new Date(timestamp);
  switch (_rangeMode) {
    case "1h": {
      // Local-time-aware hourly windows
      return d.getFullYear() * 1_000_000 + (d.getMonth() + 1) * 10_000 + d.getDate() * 100 + d.getHours();
    }
    case "4h": {
      const block = Math.floor(d.getHours() / 4);
      return d.getFullYear() * 1_000_000 + (d.getMonth() + 1) * 10_000 + d.getDate() * 100 + block;
    }
    case "8h": {
      const block = Math.floor(d.getHours() / 8);
      return d.getFullYear() * 1_000_000 + (d.getMonth() + 1) * 10_000 + d.getDate() * 100 + block;
    }
    case "1d":
      return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    case "1w": {
      // ISO week: align to Monday (local time)
      const day = d.getDay(); // 0=Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(timestamp + mondayOffset * 86_400_000);
      return monday.getFullYear() * 100 +
        Math.ceil(((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86_400_000 + 1) / 7);
    }
    case "1m":
      return d.getFullYear() * 100 + d.getMonth();
    default: return 0;
  }
}

export function ensureRangeRectRegistered() {
  if (_rangeRectRegistered) return;
  _rangeRectRegistered = true;

  registerIndicator({
    name: RANGE_RECT_NAME,
    shortName: "",
    calcParams: [],
    figures: [],
    calc: (klineDataList) => klineDataList.map(() => ({})),
    draw: ({ ctx, chart, xAxis, yAxis }) => {
      if (!_rangeMode) return true;

      const data = chart.getDataList();
      if (data.length === 0) return true;

      const range = chart.getVisibleRange();

      const hasTimeFilter = _rangeStartMinutes !== 0 || _rangeEndMinutes !== 0;
      const hasWeekdayFilter = _rangeMode === "1w";

      // Group ALL bars into time windows (not just visible ones) so that
      // rectangles always show the full high/low of the entire window,
      // even when parts are scrolled out of view
      interface Window { fromIdx: number; toIdx: number; high: number; low: number; windowId: number; }
      const windowMap = new Map<number, Window>();

      for (let i = 0; i < data.length; i++) {
        const bar = data[i]!;

        // Skip bars outside filters
        if (hasTimeFilter && !_isInTimeRange(bar.timestamp)) continue;
        if (hasWeekdayFilter && !_isAllowedWeekday(bar.timestamp)) continue;

        const windowId = _getWindowId(bar.timestamp);
        const bHigh = _rangeUseOpenClose ? Math.max(bar.open, bar.close) : bar.high;
        const bLow = _rangeUseOpenClose ? Math.min(bar.open, bar.close) : bar.low;
        const win = windowMap.get(windowId);
        if (win) {
          win.toIdx = i;
          win.high = Math.max(win.high, bHigh);
          win.low = Math.min(win.low, bLow);
        } else {
          windowMap.set(windowId, { fromIdx: i, toIdx: i, high: bHigh, low: bLow, windowId });
        }
      }

      // Only draw windows that overlap with the visible range
      const windows = [...windowMap.values()].filter(
        (w) => w.toIdx >= range.from && w.fromIdx <= range.to
      );

      ctx.save();
      for (let w = 0; w < windows.length; w++) {
        const win = windows[w]!;
        const colorIdx = win.windowId % 2 === 0 ? 0 : 1;

        const x1 = xAxis.convertToPixel(win.fromIdx);
        const x2 = xAxis.convertToPixel(win.toIdx);
        const yTop = yAxis.convertToPixel(win.high);
        const yBot = yAxis.convertToPixel(win.low);

        // Half-bar padding: use the pixel distance of one bar step, clamped
        const barCount = win.toIdx - win.fromIdx;
        const oneBarPx = barCount > 0 ? (x2 - x1) / barCount : 0;
        const halfBar = Math.max(2, Math.min(oneBarPx * 0.5, 8));
        const rx = x1 - halfBar;
        const rw = (x2 - x1) + halfBar * 2;
        const ry = yTop;
        const rh = yBot - yTop;

        ctx.fillStyle = RANGE_COLORS[colorIdx]!;
        ctx.fillRect(rx, ry, rw, rh);

        ctx.strokeStyle = RANGE_BORDERS[colorIdx]!;
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
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

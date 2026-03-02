import { describe, it, expect } from "vitest";
import type { IndicatorResponse } from "../../types/chart";

// We import the pure utility functions directly — they don't depend on klinecharts.
// The klinecharts import at the top of useChartIndicators.ts needs a mock.
import {
  _shortenColumns,
  _detectPrecision,
  _buildTimestampIndex,
  _buildCalc,
} from "../../composables/useChartIndicators";

import { extractSignalTransitions } from "../../composables/useChartSignalNav";
import {
  stripParamPrefixes,
  remapColumns,
} from "../../composables/useChartIndicatorActions";

// ── Helpers ──

function makeResponse(
  overrides: Partial<IndicatorResponse> = {}
): IndicatorResponse {
  return {
    fqn: "test:indicator",
    columns: [],
    plot_columns: [],
    signal_columns: [],
    timestamps: [],
    data: {},
    ...overrides,
  };
}

// ── _shortenColumns ──

describe("_shortenColumns", () => {
  it("returns single column unchanged", () => {
    expect(_shortenColumns(["trend_ema"])).toEqual(["trend_ema"]);
  });

  it("strips common prefix", () => {
    expect(
      _shortenColumns(["ichi_tenkan", "ichi_kijun", "ichi_senkou_a"])
    ).toEqual(["tenkan", "kijun", "senkou_a"]);
  });

  it("handles no common prefix", () => {
    expect(_shortenColumns(["alpha_x", "beta_y"])).toEqual([
      "alpha_x",
      "beta_y",
    ]);
  });

  it("handles ORB session columns", () => {
    const cols = [
      "rb1_orb_s00_range",
      "rb1_orb_s00_position",
      "rb1_orb_s00_poc_dist",
    ];
    expect(_shortenColumns(cols)).toEqual(["range", "position", "poc_dist"]);
  });
});

// ── _detectPrecision ──

describe("_detectPrecision", () => {
  it("returns 0 for integer data", () => {
    const resp = makeResponse({
      timestamps: [1, 2, 3],
      data: { col: [1, 2, 3] },
    });
    expect(_detectPrecision(resp, ["col"])).toBe(0);
  });

  it("detects 2 decimal places", () => {
    const resp = makeResponse({
      timestamps: [1, 2, 3],
      data: { col: [1.23, 2.45, 3.67] },
    });
    expect(_detectPrecision(resp, ["col"])).toBe(2);
  });

  it("caps at 4 decimal places", () => {
    const resp = makeResponse({
      timestamps: [1],
      data: { col: [1.123456789] },
    });
    expect(_detectPrecision(resp, ["col"])).toBe(4);
  });

  it("ignores trailing zeros", () => {
    const resp = makeResponse({
      timestamps: [1],
      data: { col: [1.5] },
    });
    expect(_detectPrecision(resp, ["col"])).toBe(1);
  });

  it("handles null values", () => {
    const resp = makeResponse({
      timestamps: [1, 2],
      data: { col: [null, 1.5] },
    });
    expect(_detectPrecision(resp, ["col"])).toBe(1);
  });
});

// ── _buildTimestampIndex ──

describe("_buildTimestampIndex", () => {
  it("builds correct map", () => {
    const resp = makeResponse({ timestamps: [100, 200, 300] });
    const map = _buildTimestampIndex(resp);
    expect(map.get(100)).toBe(0);
    expect(map.get(200)).toBe(1);
    expect(map.get(300)).toBe(2);
    expect(map.get(999)).toBeUndefined();
  });
});

// ── _buildCalc — the core alignment logic ──

describe("_buildCalc", () => {
  it("aligns data by index when chart and indicator have same length", () => {
    const resp = makeResponse({
      timestamps: [100, 200, 300],
      data: { val: [10, 20, 30] },
    });
    const calc = _buildCalc(resp, ["val"]);
    const klines = [
      { timestamp: 100 },
      { timestamp: 200 },
      { timestamp: 300 },
    ];
    const result = calc(klines);
    expect(result).toEqual([{ val: 10 }, { val: 20 }, { val: 30 }]);
  });

  it("aligns when indicator has more data than chart (INDICATOR_LIMIT > PAGE_SIZE)", () => {
    // Simulate: indicator has 6 timestamps, chart only shows last 3
    const resp = makeResponse({
      timestamps: [100, 200, 300, 400, 500, 600],
      data: { val: [1, 2, 3, 4, 5, 6] },
    });
    const calc = _buildCalc(resp, ["val"]);
    // Chart shows last 3 bars (timestamps 400, 500, 600)
    const klines = [
      { timestamp: 400 },
      { timestamp: 500 },
      { timestamp: 600 },
    ];
    const result = calc(klines);
    // offset = 3 - 6 = -3, so dataIdx = i + 3
    // kline[0] → resp[3] = 4, kline[1] → resp[4] = 5, kline[2] → resp[5] = 6
    expect(result).toEqual([{ val: 4 }, { val: 5 }, { val: 6 }]);
  });

  it("falls back to timestamp lookup when index alignment fails", () => {
    // Indicator and chart have different lengths AND timestamps don't match by index
    const resp = makeResponse({
      timestamps: [100, 300, 500],
      data: { val: [10, 30, 50] },
    });
    const calc = _buildCalc(resp, ["val"]);
    // Chart has bars that only partially overlap with indicator
    const klines = [
      { timestamp: 200 }, // no match
      { timestamp: 300 }, // match by ts lookup
      { timestamp: 400 }, // no match
      { timestamp: 500 }, // match by ts lookup
    ];
    const result = calc(klines);
    expect(result[0]).toEqual({}); // no data for ts 200
    expect(result[1]).toEqual({ val: 30 }); // ts 300 → index 1
    expect(result[2]).toEqual({}); // no data for ts 400
    expect(result[3]).toEqual({ val: 50 }); // ts 500 → index 2
  });

  it("returns null for columns without data at given index", () => {
    const resp = makeResponse({
      timestamps: [100, 200],
      data: { val: [null, 42] },
    });
    const calc = _buildCalc(resp, ["val"]);
    const klines = [{ timestamp: 100 }, { timestamp: 200 }];
    const result = calc(klines);
    expect(result[0]).toEqual({ val: null });
    expect(result[1]).toEqual({ val: 42 });
  });

  it("returns empty object when column doesn't exist in response data", () => {
    const resp = makeResponse({
      timestamps: [100],
      data: { other_col: [42] },
    });
    const calc = _buildCalc(resp, ["missing_col"]);
    const klines = [{ timestamp: 100 }];
    const result = calc(klines);
    // Column exists in columns list but not in data → null
    expect(result[0]).toEqual({ missing_col: null });
  });

  it("handles multiple columns", () => {
    const resp = makeResponse({
      timestamps: [100, 200],
      data: { a: [1, 2], b: [10, 20] },
    });
    const calc = _buildCalc(resp, ["a", "b"]);
    const klines = [{ timestamp: 100 }, { timestamp: 200 }];
    const result = calc(klines);
    expect(result).toEqual([
      { a: 1, b: 10 },
      { a: 2, b: 20 },
    ]);
  });

  it("returns empty object for kline bars beyond indicator range", () => {
    const resp = makeResponse({
      timestamps: [200, 300],
      data: { val: [20, 30] },
    });
    const calc = _buildCalc(resp, ["val"]);
    // Chart has a bar before the indicator data starts
    const klines = [
      { timestamp: 100 }, // before indicator range
      { timestamp: 200 },
      { timestamp: 300 },
    ];
    const result = calc(klines);
    expect(result[0]).toEqual({}); // no data
    expect(result[1]).toEqual({ val: 20 });
    expect(result[2]).toEqual({ val: 30 });
  });
});

// ── extractSignalTransitions ──

describe("extractSignalTransitions", () => {
  it("detects transition from null to 1 as bullish", () => {
    const resp = makeResponse({
      timestamps: [100, 200, 300],
      data: { breakout_up: [null, 1, 1] },
    });
    const { timestamps, valueMap } = extractSignalTransitions(resp, [
      "breakout_up",
    ]);
    expect(timestamps).toEqual([200]);
    expect(valueMap.get(200)).toBe(1); // positive = bullish
  });

  it("detects bearish signal from column name pattern", () => {
    const resp = makeResponse({
      timestamps: [100, 200, 300],
      data: { breakout_down: [null, 1, 1] },
    });
    const { timestamps, valueMap } = extractSignalTransitions(resp, [
      "breakout_down",
    ]);
    expect(timestamps).toEqual([200]);
    expect(valueMap.get(200)).toBe(-1); // negative = bearish
  });

  it("skips transitions to 0 (resets)", () => {
    const resp = makeResponse({
      timestamps: [100, 200, 300],
      data: { signal: [1, 0, 1] },
    });
    const { timestamps } = extractSignalTransitions(resp, ["signal"]);
    // ts 100: null→1 = transition, ts 200: 1→0 = skip (val===0), ts 300: 0→1 = transition
    expect(timestamps).toEqual([100, 300]);
  });

  it("handles multiple signal columns", () => {
    const resp = makeResponse({
      timestamps: [100, 200, 300],
      data: {
        sig_up: [null, 1, 1],
        sig_down: [null, null, 1],
      },
    });
    // First matching column per timestamp wins
    const { timestamps, valueMap } = extractSignalTransitions(resp, [
      "sig_up",
      "sig_down",
    ]);
    // ts 200: sig_up transitions null→1 (bullish)
    // ts 300: sig_up still 1 (no transition), sig_down transitions null→1 (but "down" → bearish)
    expect(timestamps).toContain(200);
    expect(valueMap.get(200)).toBe(1);
  });

  it("returns empty for all-null data", () => {
    const resp = makeResponse({
      timestamps: [100, 200],
      data: { sig: [null, null] },
    });
    const { timestamps } = extractSignalTransitions(resp, ["sig"]);
    expect(timestamps).toEqual([]);
  });

  it("detects _sell pattern as bearish", () => {
    const resp = makeResponse({
      timestamps: [100, 200],
      data: { entry_sell: [null, 2] },
    });
    const { valueMap } = extractSignalTransitions(resp, ["entry_sell"]);
    expect(valueMap.get(200)).toBe(-2); // |2| * -1 = -2
  });

  it("detects _short pattern as bearish", () => {
    const resp = makeResponse({
      timestamps: [100, 200],
      data: { go_short: [null, 1] },
    });
    const { valueMap } = extractSignalTransitions(resp, ["go_short"]);
    expect(valueMap.get(200)).toBe(-1);
  });

  it("detects _bear pattern as bearish", () => {
    const resp = makeResponse({
      timestamps: [100, 200],
      data: { trend_bear: [null, 3] },
    });
    const { valueMap } = extractSignalTransitions(resp, ["trend_bear"]);
    expect(valueMap.get(200)).toBe(-3);
  });
});

// ── stripParamPrefixes ──

describe("stripParamPrefixes", () => {
  it("strips rb prefix", () => {
    expect(stripParamPrefixes("rb1_orb_s00_range")).toBe("orb_s00_range");
  });

  it("strips rb+cf+prb prefix", () => {
    expect(stripParamPrefixes("rb2_cf3_prb1_orb_s00_range")).toBe(
      "orb_s00_range"
    );
  });

  it("leaves non-prefixed columns unchanged", () => {
    expect(stripParamPrefixes("orb_s00_range")).toBe("orb_s00_range");
  });

  it("strips only param prefixes, not session prefix", () => {
    expect(stripParamPrefixes("rb1_orb_s08_poc_dist")).toBe(
      "orb_s08_poc_dist"
    );
  });
});

// ── remapColumns ──

describe("remapColumns", () => {
  it("returns original columns when all match", () => {
    const selected = ["rb1_orb_s00_range", "rb1_orb_s00_position"];
    const response = ["rb1_orb_s00_range", "rb1_orb_s00_position", "rb1_orb_s00_poc_dist"];
    const result = remapColumns(selected, response);
    expect(result).toBe(selected); // same reference = no remap needed
  });

  it("remaps when range_bars changes (rb1 → rb2)", () => {
    const selected = ["rb1_orb_s00_range", "rb1_orb_s00_position"];
    const response = ["rb2_orb_s00_range", "rb2_orb_s00_position", "rb2_orb_s00_poc_dist"];
    const result = remapColumns(selected, response);
    expect(result).toEqual(["rb2_orb_s00_range", "rb2_orb_s00_position"]);
  });

  it("remaps with multiple prefix changes (rb1_cf1 → rb2_cf3)", () => {
    const selected = ["rb1_cf1_orb_s00_range"];
    const response = ["rb2_cf3_orb_s00_range", "rb2_cf3_orb_s00_position"];
    const result = remapColumns(selected, response);
    expect(result).toEqual(["rb2_cf3_orb_s00_range"]);
  });

  it("keeps matched columns, remaps only mismatched", () => {
    const selected = ["trend_ema", "rb1_orb_s00_range"];
    const response = ["trend_ema", "rb2_orb_s00_range"];
    const result = remapColumns(selected, response);
    expect(result).toEqual(["trend_ema", "rb2_orb_s00_range"]);
  });

  it("drops columns that can't be remapped", () => {
    const selected = ["rb1_orb_s00_range", "completely_different"];
    const response = ["rb2_orb_s00_range"];
    const result = remapColumns(selected, response);
    // "completely_different" has no match in response
    expect(result).toEqual(["rb2_orb_s00_range"]);
  });

  it("preserves session-specific selection (only s00, not s08)", () => {
    const selected = ["rb1_orb_s00_range"];
    const response = ["rb2_orb_s00_range", "rb2_orb_s08_range"];
    const result = remapColumns(selected, response);
    expect(result).toEqual(["rb2_orb_s00_range"]);
  });

  it("falls back to original columns if nothing can be mapped", () => {
    const selected = ["foo_bar"];
    const response = ["baz_qux"];
    const result = remapColumns(selected, response);
    expect(result).toEqual(["foo_bar"]); // unchanged fallback
  });

  it("remaps signal columns the same way", () => {
    const selected = ["rb1_orb_s00_breakout_up", "rb1_orb_s00_breakout_down"];
    const response = ["rb2_orb_s00_breakout_up", "rb2_orb_s00_breakout_down"];
    const result = remapColumns(selected, response);
    expect(result).toEqual(["rb2_orb_s00_breakout_up", "rb2_orb_s00_breakout_down"]);
  });
});

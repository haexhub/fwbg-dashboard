import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndicatorResponse } from "../../types/chart";

interface RegisteredIndicator {
  precision: number;
  styles: { lines: Array<{ color: string }> };
  figures: Array<{ key: string; type: string }>;
}

const registered = vi.hoisted(() => [] as RegisteredIndicator[]);
// klinecharts touches `window` on import, so it is mocked as in chartIndicators.test.ts.
vi.mock("klinecharts", () => ({
  registerIndicator: (indicator: RegisteredIndicator) => registered.push(indicator),
}));

import { registerFwbgSignalIndicator } from "../../composables/useChartIndicators";
import { extractSignalTransitions } from "../../composables/useChartSignalNav";
import { discreteSignalColumns, isDiscreteSignal } from "../../utils/signalColumns";

const TIMESTAMPS = [100, 200, 300, 400, 500];
const IBS = [0.12, 0.8, 0.45, 0.97, 0.3];
const IBS_DOWN = [null, 1, 1, 0, 1];

function response(data: IndicatorResponse["data"]): IndicatorResponse {
  return {
    fqn: "fwbg-core:ibs",
    columns: Object.keys(data),
    plot_columns: [],
    signal_columns: Object.keys(data),
    timestamps: TIMESTAMPS,
    data,
  };
}

describe("isDiscreteSignal", () => {
  it.each([
    ["flags", [0, 1, 1, 0]],
    ["directions", [-1, 0, 1]],
    ["flags with a warm-up gap", [null, 1, 0]],
    ["no values at all", [null, null]],
    ["an empty column", []],
  ])("treats %s as discrete", (_, values) => {
    expect(isDiscreteSignal(values)).toBe(true);
  });

  it.each([
    ["a ratio", IBS],
    ["a z-score", [-1.7, 0, 2.1]],
    ["a single fraction among flags", [0, 1, 0.5]],
  ])("treats %s as continuous", (_, values) => {
    expect(isDiscreteSignal(values)).toBe(false);
  });
});

describe("discreteSignalColumns", () => {
  it("keeps only the discrete columns, in the given order", () => {
    const data = { ibs: IBS, ibs_down: IBS_DOWN, ibs_above_prev_high: [0, 0, 1, 0, 0] };
    expect(discreteSignalColumns(data, ["ibs", "ibs_down", "ibs_above_prev_high"])).toEqual([
      "ibs_down",
      "ibs_above_prev_high",
    ]);
  });

  it("treats a column missing from the data as discrete", () => {
    expect(discreteSignalColumns({}, ["gone"])).toEqual(["gone"]);
  });
});

describe("extractSignalTransitions with a continuous signal column", () => {
  it("draws no marker for a continuous column", () => {
    const { timestamps } = extractSignalTransitions(response({ ibs: IBS }), ["ibs"]);
    expect(timestamps).toEqual([]);
  });

  it("marks only the firings of the discrete columns next to it", () => {
    const { timestamps, valueMap } = extractSignalTransitions(
      response({ ibs: IBS, ibs_down: IBS_DOWN }),
      ["ibs", "ibs_down"],
    );
    // ibs_down: null -> 1 at 200, 1 -> 0 at 400 (reset, skipped), 0 -> 1 at 500.
    expect(timestamps).toEqual([200, 500]);
    expect(valueMap.get(200)).toBe(-1);
  });
});

describe("registerFwbgSignalIndicator", () => {
  beforeEach(() => {
    registered.length = 0;
  });

  it("draws discrete columns as bars and continuous columns as lines", () => {
    registerFwbgSignalIndicator(
      "fwbg_sig_ibs_1",
      response({ ibs: IBS, ibs_down: IBS_DOWN }),
      ["ibs", "ibs_down"],
      { ibs: "#111111", ibs_down: "#222222" },
    );

    const [indicator] = registered;
    expect(indicator!.figures.map((f) => [f.key, f.type])).toEqual([
      ["ibs", "line"],
      ["ibs_down", "bar"],
    ]);
    expect(indicator!.styles.lines).toHaveLength(1);
    expect(indicator!.styles.lines[0].color).toBe("#111111");
    expect(indicator!.precision).toBe(2);
  });

  it("keeps an all-discrete signal pane as bars with whole-number precision", () => {
    registerFwbgSignalIndicator("fwbg_sig_flags_1", response({ ibs_down: IBS_DOWN }), ["ibs_down"]);

    const [indicator] = registered;
    expect(indicator!.figures.map((f) => f.type)).toEqual(["bar"]);
    expect(indicator!.styles.lines).toEqual([]);
    expect(indicator!.precision).toBe(0);
  });
});

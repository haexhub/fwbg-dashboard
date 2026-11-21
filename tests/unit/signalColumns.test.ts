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
import { discreteSignalColumns } from "../../utils/signalColumns";

const TIMESTAMPS = [100, 200, 300, 400, 500];
const IBS = [0.12, 0.8, 0.45, 0.97, 0.3];
const IBS_DOWN = [null, 1, 1, 0, 1];

function response(data: IndicatorResponse["data"], discrete = Object.keys(data).filter((key) => key !== "ibs")): IndicatorResponse {
  return {
    fqn: "fwbg-core:ibs",
    columns: Object.keys(data),
    plot_columns: [],
    signal_columns: Object.keys(data),
    discrete_signal_columns: discrete,
    timestamps: TIMESTAMPS,
    data,
  };
}

describe("discreteSignalColumns", () => {
  it("keeps only the discrete columns, in the given order", () => {
    expect(discreteSignalColumns(["ibs", "ibs_down", "ibs_above_prev_high"], ["ibs_down", "ibs_above_prev_high"])).toEqual([
      "ibs_down",
      "ibs_above_prev_high",
    ]);
  });

  it("does not infer kind from an integer-only window of a continuous column", () => {
    const integerWindow = response({ ibs: [0, 1, 0] }, []);
    expect(discreteSignalColumns(["ibs"], integerWindow.discrete_signal_columns)).toEqual([]);
    expect(extractSignalTransitions(integerWindow, ["ibs"]).timestamps).toEqual([]);
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
    expect(indicator!.styles.lines[0]!.color).toBe("#111111");
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

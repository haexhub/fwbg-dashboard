import { describe, expect, it } from "vitest";

import { aggregatePerformance } from "~/composables/useRunPerformance";
import type { TrialsSummary } from "~/types/agents";
import type { GridDetail } from "~/types/grid-detail";

/** One asset with four real-P&L trades, enough for a frontend Sharpe and a DSR. */
function asset(symbol: string, metrics: Partial<GridDetail> = {}): GridDetail {
  return {
    symbol,
    status: "ok",
    total_combinations: 1,
    walk_forward: {
      n_folds: 1,
      successful_folds: 1,
      mean_win_rate: 0.5,
      mean_pnl: 0,
      total_trades: 4,
      fold_details: [
        {
          fold_id: 0,
          test_pnl: 3,
          test_win_rate: 0.5,
          test_trades: 4,
          test_trades_trace: [
            { result: 1, pnl_raw: 2 },
            { result: -1, pnl_raw: -1 },
            { result: 1, pnl_raw: 2.5 },
            { result: -1, pnl_raw: -0.5 },
          ],
        },
      ],
    },
    ...metrics,
  };
}

const trials: TrialsSummary = { n_trials: 10, sr_variance_across_trials: 0.1, sr_variance_sample_size: 10 };

describe("aggregatePerformance Sharpe", () => {
  it("shows no edge instead of a frontend Sharpe when fwbg reported a null Sharpe", () => {
    const perf = aggregatePerformance([asset("AAA", { status: "no_edge", sharpe: null })], trials);

    expect(perf.sharpeRatio).toBeNull();
    expect(perf.noEdge).toBe(true);
    // The deflated Sharpe would be a frontend Sharpe as well.
    expect(perf.dsr).toBeNull();
    expect(perf.assetBreakdown[0]?.sharpeRatio).toBeNull();
  });

  // Older runs wrote no key, or a 0 for no edge.
  it.each([
    ["no Sharpe", {}],
    ["a zero Sharpe", { sharpe: 0 }],
  ])("computes the Sharpe from the trades for an older run that reported %s", (_, metrics) => {
    const perf = aggregatePerformance([asset("AAA", metrics)], trials);

    expect(perf.sharpeRatio).toEqual(expect.any(Number));
    expect(perf.noEdge).toBe(false);
    expect(perf.dsr).toEqual(expect.any(Number));
  });

  it("averages only the assets with a Sharpe when others have no edge", () => {
    const perf = aggregatePerformance([
      asset("AAA", { sharpe: 1.2 }),
      asset("BBB", { status: "no_edge", sharpe: null }),
      asset("CCC", { sharpe: 0.8 }),
    ]);

    expect(perf.sharpeRatio).toBe(1);
    expect(perf.noEdge).toBe(false);
    expect(perf.assetBreakdown.map((a) => a.sharpeRatio)).toEqual([1.2, null, 0.8]);
  });
});

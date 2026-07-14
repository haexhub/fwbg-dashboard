import { describe, it, expect } from "vitest";
import {
  deflatedSharpeRatio,
  expectedMaxSharpe,
  seriesMoments,
} from "../../utils/dsr";

// Same worked numerical example as fwbg-agents' orchestrator/trials.py
// (Bailey & López de Prado 2014, "A Numerical Example", pp. 9-10) — keeps
// the TS port and the Python original in verified agreement.
const ANNUAL_SR = 2.5;
const OBS_PER_YEAR = 250;
const DAILY_SR = ANNUAL_SR / Math.sqrt(OBS_PER_YEAR);
const DAILY_VAR = 0.5 / OBS_PER_YEAR; // V[SR_n] = 1/2 annualized
const T = 1250;

describe("expectedMaxSharpe", () => {
  it("matches the paper's SR0 (~0.1132)", () => {
    expect(expectedMaxSharpe(DAILY_VAR, 100)).toBeCloseTo(0.1132, 2);
  });
});

describe("deflatedSharpeRatio", () => {
  it("matches the paper's non-normal example (DSR ~0.9004)", () => {
    const dsr = deflatedSharpeRatio(DAILY_SR, DAILY_VAR, 100, T, -3, 10);
    expect(dsr).toBeCloseTo(0.9004, 2);
  });

  it("matches the paper's normal-returns example (N=88, DSR ~0.9505)", () => {
    const dsr = deflatedSharpeRatio(DAILY_SR, DAILY_VAR, 88, T, 0, 3);
    expect(dsr).toBeCloseTo(0.9505, 2);
  });

  it("matches the paper's fewer-trials example (N=46, DSR ~0.9505)", () => {
    const dsr = deflatedSharpeRatio(DAILY_SR, DAILY_VAR, 46, T, -3, 10);
    expect(dsr).toBeCloseTo(0.9505, 2);
  });

  it("returns 0 for a degenerate denominator instead of NaN", () => {
    expect(deflatedSharpeRatio(5, 1, 10, 100, 10, 1)).toBe(0);
  });
});

describe("seriesMoments", () => {
  it("returns null for fewer than 2 trades", () => {
    expect(seriesMoments([1])).toBeNull();
    expect(seriesMoments([])).toBeNull();
  });

  it("returns null for zero-variance series", () => {
    expect(seriesMoments([1, 1, 1])).toBeNull();
  });

  it("computes sr/skew/kurtosis for a simple series", () => {
    const moments = seriesMoments([1, -2, 3, -1, 2]);
    expect(moments).not.toBeNull();
    expect(typeof moments!.sr).toBe("number");
    expect(typeof moments!.skew).toBe("number");
    expect(typeof moments!.kurtosis).toBe("number");
  });
});

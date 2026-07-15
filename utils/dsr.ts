/**
 * Deflated Sharpe Ratio (Bailey & López de Prado, 2014).
 *
 * Client-side port of fwbg-agents' orchestrator/trials.py, used only for
 * display on the generic run-detail page (no gating decision depends on
 * this) — verified against the paper's worked numerical example there.
 * Precision here (~1e-7) is ample for a display value.
 */

const EULER_GAMMA = 0.5772156649015329;

/** Abramowitz & Stegun 7.1.26 (max error ~1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Peter Acklam's rational approximation of the standard normal quantile. */
function normalInvCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) *
      q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/** E[max SR] of `nTrials` zero-skill trials. */
export function expectedMaxSharpe(srVarianceAcrossTrials: number, nTrials: number): number {
  if (nTrials <= 1 || srVarianceAcrossTrials <= 0) return 0;
  const maxZ =
    (1 - EULER_GAMMA) * normalInvCdf(1 - 1 / nTrials) +
    EULER_GAMMA * normalInvCdf(1 - 1 / (nTrials * Math.E));
  return Math.sqrt(srVarianceAcrossTrials) * maxZ;
}

/**
 * Probability that the true Sharpe exceeds the best-of-N-noise benchmark.
 * `kurtosis` is raw (normal = 3), not excess.
 */
export function deflatedSharpeRatio(
  sr: number,
  srVarianceAcrossTrials: number,
  nTrials: number,
  nObs: number,
  skew: number,
  kurtosis: number,
): number {
  if (nObs <= 1) return 0;
  const sr0 = expectedMaxSharpe(srVarianceAcrossTrials, nTrials);
  const denom = 1 - skew * sr + ((kurtosis - 1) / 4) * sr * sr;
  if (denom <= 0) return 0;
  const z = ((sr - sr0) * Math.sqrt(nObs - 1)) / Math.sqrt(denom);
  return normalCdf(z);
}

/** (per-trade SR, skew, raw kurtosis) of a P&L series; null if undefined. */
export function seriesMoments(pnls: number[]): { sr: number; skew: number; kurtosis: number } | null {
  const n = pnls.length;
  if (n < 2) return null;
  const mean = pnls.reduce((a, b) => a + b, 0) / n;
  const m2 = pnls.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  if (m2 === 0) return null;
  const m3 = pnls.reduce((a, v) => a + (v - mean) ** 3, 0) / n;
  const m4 = pnls.reduce((a, v) => a + (v - mean) ** 4, 0) / n;
  const sr = mean / Math.sqrt(m2);
  return { sr, skew: m3 / m2 ** 1.5, kurtosis: m4 / m2 ** 2 };
}

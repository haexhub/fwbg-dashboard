/**
 * Tells discrete signal columns from continuous ones.
 *
 * fwbg's chart endpoint lists a plugin's `signal_columns` (decision inputs for
 * the signal rules) without saying what kind of values they hold. Since
 * continuous, unshifted columns such as `ibs`, `zscore_*` or `nb_*` are signal
 * columns too, the chart cannot treat every one of them as an event marker.
 * This is the only place that guesses: a column is discrete when each value it
 * holds is an integer (0/1 flags, -1/0/1 directions, small codes). Continuous
 * values are drawn as a line instead of markers.
 */

type Values = ReadonlyArray<number | null | undefined>;

/** True when every finite value is an integer; a column without values counts as discrete. */
export function isDiscreteSignal(values: Values): boolean {
  return values.every((v) => v == null || !Number.isFinite(v) || Number.isInteger(v));
}

/** The columns of `columns` that are discrete, in their given order. */
export function discreteSignalColumns(
  data: Record<string, Values | undefined>,
  columns: string[],
): string[] {
  return columns.filter((col) => isDiscreteSignal(data[col] ?? []));
}

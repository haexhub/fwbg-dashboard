/**
 * Tells discrete signal columns from continuous ones.
 *
 * The API classifies each signal column from plugin metadata. Values are not
 * enough to infer a column's kind because a continuous series can be integral
 * over a particular chart window.
 */

/** The columns of `columns` that are discrete, in their given order. */
export function discreteSignalColumns(
  columns: string[],
  discreteColumns: string[],
): string[] {
  const discrete = new Set(discreteColumns);
  return columns.filter((col) => discrete.has(col));
}

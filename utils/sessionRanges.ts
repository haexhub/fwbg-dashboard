/**
 * The `session_ranges` plugin parameter: `{name: [start_hour, end_hour]}` in the
 * index clock, or `{name: [start_hour, end_hour, "Area/City"]}` to read the hours
 * in that time zone's local time (follows daylight saving time).
 */

export interface SessionEntry {
  name: string;
  start: number;
  end: number;
  /** IANA time zone of the hours; empty reads them in the index clock. */
  timezone: string;
}

/** The editor rows of a stored value; anything that is not a name-to-range object has none. */
export function sessionEntries(raw: unknown): SessionEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown[]>).map(([name, range]) => ({
    name,
    start: Number(range?.[0] ?? 0),
    end: Number(range?.[1] ?? 0),
    timezone: typeof range?.[2] === "string" ? range[2] : "",
  }));
}

/** The value to store for the editor rows; a blank time zone leaves the range at two elements. */
export function sessionRangesValue(entries: SessionEntry[]): Record<string, [number, number] | [number, number, string]> {
  const value: Record<string, [number, number] | [number, number, string]> = {};
  for (const e of entries) {
    const key = e.name.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) continue;
    const timezone = e.timezone.trim();
    value[key] = timezone ? [e.start, e.end, timezone] : [e.start, e.end];
  }
  return value;
}

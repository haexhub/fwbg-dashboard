import { describe, expect, it } from "vitest";

import { sessionEntries, sessionRangesValue } from "../../utils/sessionRanges";

describe("sessionEntries", () => {
  it("reads a range with and without a time zone", () => {
    expect(
      sessionEntries({ asia: [0, 8], ny: [9, 16, "America/New_York"] }),
    ).toEqual([
      { name: "asia", start: 0, end: 8, timezone: "" },
      { name: "ny", start: 9, end: 16, timezone: "America/New_York" },
    ]);
  });

  it("reads a null time zone as none", () => {
    expect(sessionEntries({ asia: [0, 8, null] })[0]?.timezone).toBe("");
  });

  it.each([[null], [undefined], [[]], ["asia"]])("has no rows for %j", (raw) => {
    expect(sessionEntries(raw)).toEqual([]);
  });
});

describe("sessionRangesValue", () => {
  it("keeps the time zone of a range through an edit of another session", () => {
    const stored = { asia: [0, 8], ny: [9, 16, "America/New_York"] };

    const rows = sessionEntries(stored);
    rows[0] = { ...rows[0]!, end: 7 };

    expect(sessionRangesValue(rows)).toEqual({
      asia: [0, 7],
      ny: [9, 16, "America/New_York"],
    });
  });

  it("round-trips a stored value unchanged", () => {
    const stored = { asia: [0, 8], ny: [9, 16, "America/New_York"] };
    expect(sessionRangesValue(sessionEntries(stored))).toEqual(stored);
  });

  it("writes a trimmed time zone and drops a blank one", () => {
    expect(
      sessionRangesValue([
        { name: "ny", start: 9, end: 16, timezone: " America/New_York " },
        { name: "asia", start: 0, end: 8, timezone: "  " },
      ]),
    ).toEqual({ ny: [9, 16, "America/New_York"], asia: [0, 8] });
  });

  it("normalises names and skips blank ones", () => {
    expect(
      sessionRangesValue([
        { name: " New York ", start: 9, end: 16, timezone: "" },
        { name: " ", start: 0, end: 1, timezone: "" },
      ]),
    ).toEqual({ new_york: [9, 16] });
  });
});

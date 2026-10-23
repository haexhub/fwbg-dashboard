import { describe, expect, it } from "vitest";

import { startRunSummary } from "~/utils/startRunSummary";

const input = { strategy_name: "example_strategy", research_id: "S-9999", note: "first look" };

describe("startRunSummary for the chat's start_run tool", () => {
  it("shows the card and the note the run is counted against", () => {
    expect(startRunSummary(input)).toBe("S-9999 · Notiz: first look");
  });

  it("adds a reason and the holdout look when set", () => {
    expect(startRunSummary({ ...input, reason: "rerun after a data fix", holdout: true })).toBe(
      "S-9999 · Notiz: first look · Grund: rerun after a data fix · Holdout",
    );
  });

  it("leaves out a holdout flag that is false", () => {
    expect(startRunSummary({ ...input, holdout: false })).toBe("S-9999 · Notiz: first look");
  });

  it.each([
    ["no input", undefined],
    ["an input that is not an object", "S-9999"],
    ["an input without research fields", { strategy_name: "example_strategy" }],
  ])("shows nothing for %s", (_, value) => {
    expect(startRunSummary(value)).toBeUndefined();
  });

  it("skips fields that are not text", () => {
    expect(startRunSummary({ research_id: "S-9999", note: 42, reason: null })).toBe("S-9999");
  });
});

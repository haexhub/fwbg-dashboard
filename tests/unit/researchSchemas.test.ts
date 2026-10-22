import { describe, expect, it } from "vitest";

import {
  newResearchCardSchema,
  researchListQuerySchema,
  runStartBodySchema,
} from "~/server/utils/research-schemas";

const validStart = {
  strategy_name: "example_strategy",
  research_id: "S-9999",
  note: "first look at the idea",
};

describe("runStartBodySchema", () => {
  it("accepts the minimal research fields", () => {
    expect(runStartBodySchema.parse(validStart)).toEqual(validStart);
  });

  it("accepts every optional field", () => {
    const body = {
      ...validStart,
      assets: ["NAS100"],
      asset_classes: ["indices"],
      description: "",
      reason: "rerun after a data fix",
      holdout: true,
    };
    expect(runStartBodySchema.parse(body)).toEqual(body);
  });

  it.each([
    ["a blank strategy name", { strategy_name: "  " }],
    ["a missing research id", { research_id: undefined }],
    ["a research id without four digits", { research_id: "S-12" }],
    ["a research id with extra text", { research_id: "S-99999" }],
    ["a missing note", { note: undefined }],
    ["a blank note", { note: " \t " }],
    ["a blank reason", { reason: "" }],
    ["a holdout flag that is not a boolean", { holdout: "yes" }],
    ["assets that are not strings", { assets: [1] }],
    ["a field fwbg would not honour", { end_date: "2026-01-01" }],
  ])("rejects %s", (_, override) => {
    expect(runStartBodySchema.safeParse({ ...validStart, ...override }).success).toBe(false);
  });

  // fwbg requires note.splitlines() == [note]; these are Python's line boundaries.
  it.each(["\n", "\r", "\r\n", "\v", "\f", "\x1c", "\x1d", "\x1e", "\x85", "\u2028", "\u2029"])(
    "rejects a note containing line boundary %j",
    (boundary) => {
      const note = `first${boundary}second`;
      expect(runStartBodySchema.safeParse({ ...validStart, note }).success).toBe(false);
      expect(runStartBodySchema.safeParse({ ...validStart, note: `note${boundary}` }).success).toBe(false);
    },
  );
});

const validCard = {
  title: "Example idea",
  tags: ["example"],
  hypothesis: "Something predicts something.",
  mechanism: "Because of a reason.",
};

describe("newResearchCardSchema", () => {
  it("accepts a card with and without a cutoff", () => {
    expect(newResearchCardSchema.parse(validCard)).toEqual(validCard);
    const withCutoff = { ...validCard, cutoff: "2024-02-29" };
    expect(newResearchCardSchema.parse(withCutoff)).toEqual(withCutoff);
  });

  it.each([
    ["a blank title", { title: " " }],
    ["no tags", { tags: [] }],
    ["a blank tag", { tags: ["ok", " "] }],
    ["a blank hypothesis", { hypothesis: "" }],
    ["a missing mechanism", { mechanism: undefined }],
    ["a cutoff with a time", { cutoff: "2024-01-01T00:00:00Z" }],
    ["a cutoff that is not a calendar date", { cutoff: "2023-02-29" }],
    ["a cutoff in another format", { cutoff: "01.02.2024" }],
  ])("rejects %s", (_, override) => {
    expect(newResearchCardSchema.safeParse({ ...validCard, ...override }).success).toBe(false);
  });
});

describe("researchListQuerySchema", () => {
  it("accepts an empty query and the status/tag filters", () => {
    expect(researchListQuerySchema.parse({})).toEqual({});
    expect(researchListQuerySchema.parse({ status: "active", tag: "fx" })).toEqual({
      status: "active",
      tag: "fx",
    });
  });

  it.each([
    ["an unknown status", { status: "done" }],
    ["a repeated status", { status: ["active", "parked"] }],
    ["a blank tag", { tag: "" }],
  ])("rejects %s", (_, query) => {
    expect(researchListQuerySchema.safeParse(query).success).toBe(false);
  });
});

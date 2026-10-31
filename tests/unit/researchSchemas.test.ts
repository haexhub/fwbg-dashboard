import { asSchema } from "ai";
import { describe, expect, it } from "vitest";

import {
  attachCardBodySchema,
  exitOptimizationBodySchema,
  newResearchCardSchema,
  researchListQuerySchema,
  runStartBodySchema,
  startRunToolInputSchema,
} from "~/server/utils/research-schemas";

const validStart = {
  strategy_name: "example_strategy",
  research_id: "S-9999",
  note: "first look at the idea",
};

describe("exitOptimizationBodySchema", () => {
  const valid = { source: "dukascopy", symbol: "NAS100", research_id: "S-9999", note: "ranges" };

  it("accepts an analysis with its research fields", () => {
    const body = { ...valid, timeframe: "HOUR", exit_params: { atr_period: 14 }, reason: "again" };
    expect(exitOptimizationBodySchema.parse(body)).toEqual(body);
  });

  it.each([
    ["a missing research id", { research_id: undefined }],
    ["a missing note", { note: undefined }],
    ["a note over two lines", { note: "a\nb" }],
    ["a blank reason", { reason: " " }],
    ["a blank symbol", { symbol: "" }],
    ["max bars that are not a positive integer", { max_bars: 0 }],
    ["a field fwbg does not take", { end_date: "2026-01-01" }],
  ])("rejects %s", (_, override) => {
    expect(exitOptimizationBodySchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

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
    ["a field the dashboard does not send", { end_date: "2026-01-01" }],
  ])("rejects %s", (_, override) => {
    expect(runStartBodySchema.safeParse({ ...validStart, ...override }).success).toBe(false);
  });

  // fwbg passes these as CLI arguments, and an argument with a NUL cannot be built.
  it.each([
    ["note", { note: "first\0look" }],
    ["reason", { reason: "rerun\0" }],
    ["description", { description: "\0" }],
  ])("rejects a %s containing NUL", (_, override) => {
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

describe("startRunToolInputSchema", () => {
  it("accepts the research fields the chat tool sends", () => {
    const input = {
      ...validStart,
      assets: ["NAS100"],
      description: "",
      reason: "rerun after a data fix",
      holdout: true,
    };
    expect(startRunToolInputSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["a missing research id", { research_id: undefined }],
    ["a research id without four digits", { research_id: "S-12" }],
    ["a missing note", { note: undefined }],
    ["a blank note", { note: "  " }],
    ["a note on two lines", { note: "first\nsecond" }],
    ["a blank reason", { reason: " " }],
    ["a holdout flag that is not a boolean", { holdout: "yes" }],
    ["asset classes, which the tool does not offer", { asset_classes: ["indices"] }],
  ])("rejects %s", (_, override) => {
    expect(startRunToolInputSchema.safeParse({ ...validStart, ...override }).success).toBe(false);
  });

  it("tells the model which fields are required and describes the research fields", async () => {
    const schema = (await asSchema(startRunToolInputSchema).jsonSchema) as {
      required?: string[];
      properties: Record<string, { description?: string }>;
    };
    expect(schema.required?.sort()).toEqual(["note", "research_id", "strategy_name"]);
    for (const field of ["research_id", "note", "reason", "holdout"]) {
      expect(schema.properties[field]?.description).toBeTruthy();
    }
  });
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

describe("attachCardBodySchema", () => {
  it("accepts a card id", () => {
    expect(attachCardBodySchema.parse({ research_id: "S-0007" })).toEqual({ research_id: "S-0007" });
  });

  it.each([{}, { research_id: "S-7" }, { research_id: "S-0007", extra: 1 }])("rejects %j", (body) => {
    expect(() => attachCardBodySchema.parse(body)).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { newResearchCardSchema, runStartBodySchema } from "~/server/utils/research-schemas";
import {
  buildNewCardInput,
  buildRunStartBody,
  cardSelection,
  formAfterStart,
  researchCardItem,
  type NewCardForm,
  type RunStartForm,
} from "~/utils/researchForms";

const STRATEGY = "example_strategy";

const runForm: RunStartForm = {
  researchId: "S-9999",
  note: "first look",
  reason: "",
  holdout: false,
  assetClasses: [],
  customAssets: "",
  description: "",
};

describe("buildRunStartBody", () => {
  it("sends the strategy, the card and the note when only those are set", () => {
    expect(buildRunStartBody(STRATEGY, runForm)).toEqual({
      strategy_name: STRATEGY,
      research_id: "S-9999",
      note: "first look",
    });
  });

  it.each([
    ["no card", { researchId: undefined }],
    ["a blank note", { note: " \t " }],
    ["a note of line breaks only", { note: "\n\u2028" }],
  ])("builds nothing with %s, so the start stays disabled", (_, change) => {
    expect(buildRunStartBody(STRATEGY, { ...runForm, ...change })).toBeUndefined();
  });

  it("turns line breaks in the note into spaces, which the server accepts", () => {
    const note = " a\nb\r\nc\vd\fe\x1cf\x1dg\x1eh\x85i\u2028j\u2029k ";

    const body = buildRunStartBody(STRATEGY, { ...runForm, note });

    expect(body?.note).toBe("a b c d e f g h i j k");
    expect(runStartBodySchema.safeParse(body).success).toBe(true);
  });

  it("sends a reason only when it is not blank, trimmed", () => {
    expect(buildRunStartBody(STRATEGY, { ...runForm, reason: "   " })).not.toHaveProperty("reason");
    expect(buildRunStartBody(STRATEGY, { ...runForm, reason: " second look " })?.reason).toBe(
      "second look",
    );
  });

  it("asks for the holdout look only when it is checked", () => {
    expect(buildRunStartBody(STRATEGY, runForm)).not.toHaveProperty("holdout");
    expect(buildRunStartBody(STRATEGY, { ...runForm, holdout: true })?.holdout).toBe(true);
  });

  it("keeps the asset classes, the specific assets and the description", () => {
    const body = buildRunStartBody(STRATEGY, {
      ...runForm,
      assetClasses: ["FOREX", "INDEX"],
      customAssets: " eurusd, ,gold ",
      description: "  wider stops ",
    });

    expect(body).toMatchObject({
      asset_classes: ["FOREX", "INDEX"],
      assets: ["EURUSD", "GOLD"],
      description: "wider stops",
    });
    expect(runStartBodySchema.safeParse(body).success).toBe(true);
  });

  it("leaves out empty asset and description fields", () => {
    const body = buildRunStartBody(STRATEGY, { ...runForm, customAssets: " , ", description: " " });

    expect(body).not.toHaveProperty("assets");
    expect(body).not.toHaveProperty("asset_classes");
    expect(body).not.toHaveProperty("description");
  });
});

describe("formAfterStart", () => {
  it("clears note, reason and holdout so the next start asks for them again", () => {
    const form = { ...runForm, reason: "second look", holdout: true, assetClasses: ["FOREX"] };

    expect(formAfterStart(form)).toEqual({
      ...form,
      note: "",
      reason: "",
      holdout: false,
    });
  });

  it("keeps the card, so the next run is another trial of it", () => {
    expect(formAfterStart(runForm).researchId).toBe("S-9999");
  });
});

const cardForm: NewCardForm = {
  title: "Example idea",
  tags: ["example"],
  hypothesis: "prices revert",
  mechanism: "liquidity providers fade moves",
  cutoff: "",
};

describe("buildNewCardInput", () => {
  it("trims the fields and leaves out an empty cutoff", () => {
    const input = buildNewCardInput({
      ...cardForm,
      title: " Example idea ",
      tags: [" example ", " ", "second"],
      hypothesis: " prices revert\n",
    });

    expect(input).toEqual({
      title: "Example idea",
      tags: ["example", "second"],
      hypothesis: "prices revert",
      mechanism: "liquidity providers fade moves",
    });
    expect(newResearchCardSchema.safeParse(input).success).toBe(true);
  });

  it("sends the cutoff date when one is set", () => {
    const input = buildNewCardInput({ ...cardForm, cutoff: "2025-01-01" });

    expect(input?.cutoff).toBe("2025-01-01");
    expect(newResearchCardSchema.safeParse(input).success).toBe(true);
  });

  it("sends each tag once", () => {
    expect(buildNewCardInput({ ...cardForm, tags: ["fx", " fx ", "trend", "fx"] })?.tags).toEqual([
      "fx",
      "trend",
    ]);
  });

  it.each([
    ["a blank title", { title: " " }],
    ["no tag", { tags: [] }],
    ["only blank tags", { tags: [" "] }],
    ["a blank hypothesis", { hypothesis: "" }],
    ["a blank mechanism", { mechanism: "\n" }],
  ])("builds nothing with %s, so the card cannot be created", (_, change) => {
    expect(buildNewCardInput({ ...cardForm, ...change })).toBeUndefined();
  });
});

describe("researchCardItem", () => {
  it("labels a card with its id and title", () => {
    expect(researchCardItem({ id: "S-9999", title: "Example idea" })).toEqual({
      label: "S-9999 · Example idea",
      value: "S-9999",
    });
  });

  it("shows an unreadable card disabled, with the reason", () => {
    expect(researchCardItem({ id: "S-9998", error: "invalid front matter" })).toEqual({
      label: "S-9998 · unreadable: invalid front matter",
      value: "S-9998",
      disabled: true,
    });
  });
});

describe("cardSelection", () => {
  const listed = { label: "S-9001 · Example idea", value: "S-9001" };
  const unreadable = { label: "S-9002 · unreadable: x", value: "S-9002", disabled: true };
  const created = { label: "S-9003 · New idea", value: "S-9003" };

  it("keeps a selected card that is listed", () => {
    expect(cardSelection([listed], [], "S-9001")).toEqual({ items: [listed], researchId: "S-9001" });
  });

  it("clears a selection that is no longer listed, so the start disables", () => {
    expect(cardSelection([listed], [], "S-9004").researchId).toBeUndefined();
  });

  it("clears a selection of a card that became unreadable", () => {
    expect(cardSelection([listed, unreadable], [], "S-9002").researchId).toBeUndefined();
  });

  it("adds a card created here that a list fetched before its creation lacks", () => {
    expect(cardSelection([listed], [created], "S-9003")).toEqual({
      items: [listed, created],
      researchId: "S-9003",
    });
  });

  it("lists a created card once when the list already has it", () => {
    expect(cardSelection([listed, created], [created], "S-9003").items).toEqual([listed, created]);
  });
});

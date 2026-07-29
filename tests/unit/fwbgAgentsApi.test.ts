import { describe, expect, it } from "vitest";

import { extractDetail } from "~/server/utils/fwbg-agents-api";

describe("extractDetail", () => {
  it("unwraps FastAPI's detail string", () => {
    // Without this, the UI rendered the whole JSON object in a toast.
    const body = JSON.stringify({
      detail:
        "model 'gemini-3-pro-preview' is not usable: status_code: 429, " +
        "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0",
    });
    expect(extractDetail(body)).toContain("limit: 0");
    expect(extractDetail(body)).not.toContain("{");
  });

  it("joins a validation error's detail list", () => {
    const body = JSON.stringify({
      detail: [{ msg: "field required" }, { msg: "must be a string" }],
    });
    expect(extractDetail(body)).toBe("field required; must be a string");
  });

  it("returns null for a body it cannot read, so the caller keeps the raw text", () => {
    expect(extractDetail("502 Bad Gateway")).toBeNull();
    expect(extractDetail("")).toBeNull();
    expect(extractDetail(JSON.stringify({ error: "nope" }))).toBeNull();
    expect(extractDetail(JSON.stringify({ detail: { code: 7 } }))).toBeNull();
  });
});

import * as h3 from "h3";
import nitroErrorHandler from "nitropack/runtime/internal/error/prod";
import { createFetch } from "ofetch";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { fwbgFetch } from "~/server/utils/fwbg-api";
import { runStartBodySchema } from "~/server/utils/research-schemas";
import { fetchErrorLines } from "~/utils/fetchErrorLines";

const FALLBACK = "Run konnte nicht gestartet werden";
const validStart = { strategy_name: "example_strategy", research_id: "S-9999", note: "first look" };

let startRoute: h3.EventHandler;

beforeAll(async () => {
  // Nitro auto-imports these at build time; the route module needs them as globals.
  vi.stubGlobal("createError", h3.createError);
  vi.stubGlobal("defineEventHandler", h3.defineEventHandler);
  vi.stubGlobal("readValidatedBody", h3.readValidatedBody);
  vi.stubGlobal("runStartBodySchema", runStartBodySchema);
  vi.stubGlobal("fwbgFetch", fwbgFetch);
  // Imported after the stubs: the module calls defineEventHandler when it loads.
  startRoute = (await import("~/server/api/runs/start.post")).default;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * fwbg answers the proxied request with this status and body. Each test that
 * reaches fwbg calls this first: the stub is replaced per test, not reset.
 */
function fwbgResponds(status: number, body: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
}

/**
 * The error the browser's $fetch throws for a run start: the real route, behind
 * an h3 app with nitro's production error handler, called through ofetch.
 * Nuxt's own error handler steps aside for JSON requests (every /api/ path), so
 * nitro's production handler builds the envelope the browser receives.
 */
async function startRunError(body: Record<string, unknown>): Promise<unknown> {
  const app = h3.createApp({ onError: nitroErrorHandler });
  app.use("/api/runs/start", startRoute);
  const server = h3.toWebHandler(app);
  const $fetch = createFetch({
    fetch: (input, init) => server(new Request(new URL(String(input), "http://dashboard.test"), init)),
  });
  try {
    await $fetch("/api/runs/start", { method: "POST", body });
  } catch (err) {
    return err;
  }
  throw new Error("expected the run start to fail");
}

describe("fetchErrorLines for a refused run start", () => {
  it("shows one line per gate denial", async () => {
    fwbgResponds(
      409,
      JSON.stringify({
        detail: {
          message: "research gate refused the run",
          denials: [
            { code: "duplicate_fingerprint", status: 409, message: "this config already ran" },
            { code: "after_cutoff", status: 422, message: "the window reaches past the cutoff" },
          ],
        },
      }),
    );

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual([
      "duplicate_fingerprint: this config already ran",
      "after_cutoff: the window reaches past the cutoff",
    ]);
  });

  it("skips malformed denials and keeps the valid ones", async () => {
    fwbgResponds(
      409,
      JSON.stringify({
        detail: {
          message: "research gate refused the run",
          denials: [null, "holdout_repeat", { code: 7 }, { code: "holdout_repeat", status: 409, message: "seen" }],
        },
      }),
    );

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual(["holdout_repeat: seen"]);
  });

  it("shows the refusal message when no denial is readable", async () => {
    fwbgResponds(
      409,
      JSON.stringify({ detail: { message: "research gate refused the run", denials: [{ code: "x" }, 3] } }),
    );

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual([
      "research gate refused the run",
    ]);
  });

  it("shows fwbg's request validation errors per field", async () => {
    fwbgResponds(
      422,
      JSON.stringify({
        detail: [
          { loc: ["body", "note"], msg: "Field required", type: "missing" },
          { loc: ["body", "tags", 0], msg: "String should have at least 1 character", type: "string_too_short" },
          { loc: ["query", "status"], msg: "Input should be 'active'", type: "enum" },
          { msg: "Value error, bad window", type: "value_error" },
          { loc: ["body"], type: "missing" },
        ],
      }),
    );

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual([
      "note: Field required",
      "tags.0: String should have at least 1 character",
      "query.status: Input should be 'active'",
      "Value error, bad window",
    ]);
  });

  it("shows the message and the output lines of a failed preflight", async () => {
    fwbgResponds(
      422,
      JSON.stringify({
        detail: {
          message: "research preflight failed",
          output: "Traceback (most recent call last):\n\nValueError: bad strategy",
        },
      }),
    );

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual([
      "research preflight failed",
      "Traceback (most recent call last):",
      "ValueError: bad strategy",
    ]);
  });

  it("shows only the message of a failed preflight without output", async () => {
    fwbgResponds(422, JSON.stringify({ detail: { message: "research preflight failed", output: "" } }));

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual([
      "research preflight failed",
    ]);
  });

  it.each([
    [504, "research preflight timed out"],
    [409, "run was cancelled before it started"],
    [404, "Strategy not found: example_strategy"],
  ])("shows fwbg's %i detail text", async (status, detail) => {
    fwbgResponds(status, JSON.stringify({ detail }));

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual([detail]);
  });

  it("shows the dashboard's own validation errors per field", async () => {
    const body = { ...validStart, research_id: "S-1", note: "two\nlines", end_date: "2026-01-01" };

    expect(fetchErrorLines(await startRunError(body), FALLBACK)).toEqual([
      "research_id: must be S- followed by four digits",
      "note: must be a single line",
      'Unrecognized key: "end_date"',
    ]);
  });

  it("shows a validation error's message when it is not a list of issues", () => {
    const err = { data: { statusCode: 400, statusMessage: "Validation Error", message: "Validation Error" } };

    expect(fetchErrorLines(err, FALLBACK)).toEqual(["Validation Error"]);
  });

  it("shows the dashboard's own timeout when fwbg does not answer", () => {
    const err = {
      data: {
        statusCode: 504,
        statusMessage: "fwbg did not answer within 150 s",
        message: "fwbg did not answer within 150 s",
      },
      statusMessage: "fwbg did not answer within 150 s",
    };

    expect(fetchErrorLines(err, FALLBACK)).toEqual(["fwbg did not answer within 150 s"]);
  });

  it("shows a text body from fwbg as it is", async () => {
    fwbgResponds(502, "upstream down");

    expect(fetchErrorLines(await startRunError(validStart), FALLBACK)).toEqual(["upstream down"]);
  });

  it("shows a detail text at the top of the error data", () => {
    expect(fetchErrorLines({ data: { detail: "not allowed" } }, FALLBACK)).toEqual(["not allowed"]);
  });

  it("falls back to the error's message when the server is not reached", async () => {
    const $fetch = createFetch({
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    const err = await $fetch("/api/runs/start", { method: "POST", retry: 0 }).catch((e: unknown) => e);

    const lines = fetchErrorLines(err, FALLBACK);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("fetch failed");
  });

  it.each([
    ["nothing", undefined],
    ["a string", "boom"],
    ["an array", [{ data: { detail: "not allowed" } }]],
    ["an error without text", { data: { message: "" }, statusMessage: "  " }],
  ])("falls back to the given text for %s", (_, err) => {
    expect(fetchErrorLines(err, FALLBACK)).toEqual([FALLBACK]);
  });
});

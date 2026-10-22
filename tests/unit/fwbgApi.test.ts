import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fwbgErrorMessage, fwbgFetch } from "~/server/utils/fwbg-api";

function respondWith(body: string, status: number, statusText: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status, statusText })));
}

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e as { statusCode?: number; statusMessage?: string; data?: unknown };
  }
  throw new Error("expected fwbgFetch to reject");
}

describe("fwbgFetch on a non-2xx response", () => {
  beforeEach(() => {
    // Nitro auto-imports createError at build time; the unit runs without nitro.
    vi.stubGlobal("createError", createError);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carries fwbg's parsed JSON body as data, so callers read detail without re-parsing", async () => {
    const body = {
      detail: { message: "refused", denials: [{ code: "holdout_repeat", status: 409, message: "x" }] },
    };
    respondWith(JSON.stringify(body), 422, "Unprocessable Entity");

    const err = await rejectionOf(fwbgFetch("/api/runs/start", { method: "POST" }));

    expect(err.statusCode).toBe(422);
    expect(err.data).toEqual(body);
    expect(err.statusMessage).toBe(JSON.stringify(body));
  });

  it("keeps a text body as statusMessage without data", async () => {
    respondWith("upstream down", 502, "Bad Gateway");

    const err = await rejectionOf(fwbgFetch("/api/runs"));

    expect(err.statusCode).toBe(502);
    expect(err.statusMessage).toBe("upstream down");
    expect(err.data).toBeUndefined();
  });

  it("falls back to the status text for an empty body", async () => {
    respondWith("", 503, "Service Unavailable");

    const err = await rejectionOf(fwbgFetch("/api/runs"));

    expect(err.statusMessage).toBe("Service Unavailable");
    expect(err.data).toBeUndefined();
  });
});

describe("fwbgFetch when fwbg does not answer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("createError", createError);
    // fwbg never answers; the request ends only when its signal aborts.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("answers 504 with the timeout in the message and keeps the abort as cause", async () => {
    const pending = rejectionOf(fwbgFetch("/api/runs/start", { method: "POST", timeout: 150_000 }));

    await vi.advanceTimersByTimeAsync(150_000);
    const err = (await pending) as { statusCode?: number; statusMessage?: string; cause?: unknown };

    expect(err.statusCode).toBe(504);
    expect(err.statusMessage).toBe("fwbg did not answer within 150 s");
    expect((err.cause as Error).name).toBe("AbortError");
  });

  it("answers 504 when the response body does not arrive in time", async () => {
    // Headers arrive, the body stream stalls until the request's signal aborts.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = new ReadableStream({
          start(stream) {
            init.signal?.addEventListener("abort", () => stream.error(init.signal?.reason));
          },
        });
        return new Response(body, { status: 200 });
      }),
    );
    const settled = fwbgFetch("/api/research", { timeout: 1_000 }).then(
      () => "resolved",
      (e: { statusCode?: number }) => e.statusCode,
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await Promise.race([settled, Promise.resolve("still pending")])).toBe(504);
  });

  it("passes other network errors on unchanged", async () => {
    const failure = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(failure)));

    await expect(fwbgFetch("/api/runs")).rejects.toBe(failure);
  });
});

describe("fwbgErrorMessage for a tool that calls fwbg directly", () => {
  it("shows one line per gate denial after the status", () => {
    const body = {
      detail: {
        message: "research gate refused the run",
        denials: [
          { code: "duplicate_fingerprint", status: 409, message: "same config as an earlier trial" },
          { code: "holdout_repeat", status: 409, message: "holdout already used" },
        ],
      },
    };
    expect(fwbgErrorMessage(409, JSON.stringify(body))).toBe(
      "409 duplicate_fingerprint: same config as an earlier trial\nholdout_repeat: holdout already used",
    );
  });

  it("shows a failed preflight's message and output lines", () => {
    const body = { detail: { message: "research preflight failed", output: "line one\n\nline two\n" } };
    expect(fwbgErrorMessage(422, JSON.stringify(body))).toBe(
      "422 research preflight failed\nline one\nline two",
    );
  });

  it("shows a text detail as it is", () => {
    expect(fwbgErrorMessage(504, JSON.stringify({ detail: "research preflight timed out" }))).toBe(
      "504 research preflight timed out",
    );
  });

  it.each([
    ["a body that is not JSON", "Internal Server Error"],
    ["a JSON body without a readable detail", JSON.stringify({ error: "x" })],
    ["an empty body", ""],
  ])("keeps %s unchanged", (_, body) => {
    expect(fwbgErrorMessage(500, body)).toBe(`500 ${body}`);
  });
});

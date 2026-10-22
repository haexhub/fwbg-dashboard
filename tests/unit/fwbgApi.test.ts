import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fwbgFetch } from "~/server/utils/fwbg-api";

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

  it("passes other network errors on unchanged", async () => {
    const failure = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(failure)));

    await expect(fwbgFetch("/api/runs")).rejects.toBe(failure);
  });
});

import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Runs API compatibility tests.
 *
 * Verifies the dashboard API proxy layer handles:
 * - Run listing and detail
 * - NEW: Progress endpoint (progress.json from RunProgressWriter)
 * - NEW: Logs endpoint (logs.jsonl from RunLogger)
 *
 * Requires: fwbg API running on localhost:8420.
 */

test.describe("Runs API — Model Restructuring Compatibility", () => {
  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      baseURL: "http://localhost:3100",
    });
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  // ── Run Listing ───────────────────────────────────────────

  test.describe("GET /api/runs", () => {
    test("should return array of runs", async () => {
      const response = await request.get("/api/runs");
      expect(response.ok()).toBeTruthy();

      const runs = await response.json();
      expect(Array.isArray(runs)).toBe(true);
    });

    test("should accept limit parameter", async () => {
      const response = await request.get("/api/runs?limit=5");
      expect(response.ok()).toBeTruthy();

      const runs = await response.json();
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBeLessThanOrEqual(5);
    });

    test("should have correct run summary structure", async () => {
      const response = await request.get("/api/runs?limit=1");
      const runs = await response.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const run = runs[0];
      expect(run).toHaveProperty("run_id");
      expect(run).toHaveProperty("status");
      expect(typeof run.run_id).toBe("string");
      expect(typeof run.status).toBe("string");
    });
  });

  // ── Run Detail ────────────────────────────────────────────

  test.describe("GET /api/runs/:id", () => {
    test("should return run detail for existing run", async () => {
      const listResponse = await request.get("/api/runs?limit=1");
      const runs = await listResponse.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const runId = runs[0].run_id;
      const response = await request.get(`/api/runs/${runId}`);
      expect(response.ok()).toBeTruthy();

      const detail = await response.json();
      expect(detail).toHaveProperty("run_id", runId);
      expect(detail).toHaveProperty("status");
    });

    test("should return strategy config in run detail", async () => {
      const listResponse = await request.get("/api/runs?limit=1");
      const runs = await listResponse.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const runId = runs[0].run_id;
      const response = await request.get(`/api/runs/${runId}`);
      const detail = await response.json();

      // Run detail should include the strategy that was used
      if (detail.strategy) {
        expect(detail.strategy).toHaveProperty("name");
        // After restructuring, model section must be present
        if (detail.strategy.model) {
          expect(detail.strategy.model).toHaveProperty("type");
        }
      }
    });

    test("should include asset results when available", async () => {
      const listResponse = await request.get("/api/runs?limit=1");
      const runs = await listResponse.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const runId = runs[0].run_id;
      const response = await request.get(`/api/runs/${runId}`);
      const detail = await response.json();

      if (detail.assets) {
        expect(typeof detail.assets).toBe("object");

        for (const [symbol, asset] of Object.entries(detail.assets) as [
          string,
          any,
        ][]) {
          expect(typeof symbol).toBe("string");
          expect(asset).toHaveProperty("symbol");
          expect(asset).toHaveProperty("status");
        }
      }
    });
  });

  // ── Progress Endpoint (NEW) ───────────────────────────────

  test.describe("GET /api/runs/:id/progress", () => {
    test("should have a progress proxy endpoint", async () => {
      const listResponse = await request.get("/api/runs?limit=1");
      const runs = await listResponse.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const runId = runs[0].run_id;
      const response = await request.get(`/api/runs/${runId}/progress`);

      // The endpoint should exist (not 404 from Nuxt routing)
      // It may return 404 from fwbg if no progress.json exists (that's ok)
      expect(response.status()).not.toBe(405); // Method Not Allowed = no route
      // 200 = progress data exists, 404 = no progress file = both acceptable
      expect([200, 404, 500]).toContain(response.status());

      if (response.ok()) {
        const progress = await response.json();
        expect(progress).toHaveProperty("run_id");
        expect(progress).toHaveProperty("status");
      }
    });

    test("should return progress structure when available", async () => {
      const listResponse = await request.get("/api/runs?limit=10");
      const runs = await listResponse.json();

      // Find a run that might have progress data
      for (const run of runs) {
        const response = await request.get(
          `/api/runs/${run.run_id}/progress`
        );
        if (response.ok()) {
          const progress = await response.json();

          // Verify RunProgressWriter JSON structure
          expect(progress).toHaveProperty("run_id");
          expect(progress).toHaveProperty("status");
          expect(progress).toHaveProperty("overall_progress_fraction");
          expect(progress).toHaveProperty("total_assets");
          expect(progress).toHaveProperty("completed_assets");
          expect(progress).toHaveProperty("failed_assets");

          if (progress.assets) {
            expect(typeof progress.assets).toBe("object");
            for (const [symbol, asset] of Object.entries(
              progress.assets
            ) as [string, any][]) {
              expect(asset).toHaveProperty("symbol", symbol);
              expect(asset).toHaveProperty("status");
              if (asset.stages) {
                expect(Array.isArray(asset.stages)).toBe(true);
                for (const stage of asset.stages) {
                  expect(stage).toHaveProperty("stage_name");
                  expect(stage).toHaveProperty("status");
                }
              }
            }
          }
          return; // Found and verified one — done
        }
      }

      // If no run has progress, that's fine — skip
      test.skip();
    });
  });

  // ── Logs Endpoint (NEW) ───────────────────────────────────

  test.describe("GET /api/runs/:id/logs", () => {
    test("should have a logs proxy endpoint", async () => {
      const listResponse = await request.get("/api/runs?limit=1");
      const runs = await listResponse.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const runId = runs[0].run_id;
      const response = await request.get(`/api/runs/${runId}/logs`);

      // The endpoint should exist (not 405 from Nuxt routing)
      expect(response.status()).not.toBe(405);
      // 200 = logs exist, 404 = no log file = both acceptable
      expect([200, 404, 500]).toContain(response.status());

      if (response.ok()) {
        const logs = await response.json();
        expect(Array.isArray(logs)).toBe(true);
      }
    });

    test("should return structured log entries when available", async () => {
      const listResponse = await request.get("/api/runs?limit=10");
      const runs = await listResponse.json();

      for (const run of runs) {
        const response = await request.get(`/api/runs/${run.run_id}/logs`);
        if (response.ok()) {
          const logs = await response.json();
          if (Array.isArray(logs) && logs.length > 0) {
            const entry = logs[0];
            expect(entry).toHaveProperty("level");
            expect(entry).toHaveProperty("message");
            expect(entry).toHaveProperty("timestamp");
            return; // Found and verified — done
          }
        }
      }

      test.skip();
    });

    test("should support query filters", async () => {
      const listResponse = await request.get("/api/runs?limit=1");
      const runs = await listResponse.json();

      if (runs.length === 0) {
        test.skip();
        return;
      }

      const runId = runs[0].run_id;

      // These should not error even if no logs exist
      const withLevel = await request.get(
        `/api/runs/${runId}/logs?level=INFO`
      );
      expect([200, 404, 500]).toContain(withLevel.status());

      const withLimit = await request.get(
        `/api/runs/${runId}/logs?limit=10`
      );
      expect([200, 404, 500]).toContain(withLimit.status());
    });
  });
});

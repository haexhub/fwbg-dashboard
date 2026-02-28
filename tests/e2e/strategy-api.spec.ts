import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Strategy API compatibility tests.
 *
 * Verifies the dashboard API proxy layer returns correctly structured
 * data after the fwbg model restructuring (BaseModel plugin system,
 * simplified ResourceConfig, new progress/logs endpoints).
 *
 * Requires: fwbg API running on localhost:8420 with at least one strategy.
 */

test.describe("Strategy API — Model Restructuring Compatibility", () => {
  let request: APIRequestContext;
  let firstStrategyFilename: string;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      baseURL: "http://localhost:3100",
    });

    // Discover first available strategy for detail tests
    const listResponse = await request.get("/api/strategy/strategies");
    expect(listResponse.ok()).toBeTruthy();
    const strategies = await listResponse.json();
    expect(Array.isArray(strategies)).toBe(true);
    expect(strategies.length).toBeGreaterThan(0);
    firstStrategyFilename = strategies[0].filename;
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  // ── Strategy List ──────────────────────────────────────────

  test.describe("GET /api/strategy/strategies", () => {
    test("should return strategy summaries with expected fields", async () => {
      const response = await request.get("/api/strategy/strategies");
      expect(response.ok()).toBeTruthy();

      const strategies = await response.json();
      expect(strategies.length).toBeGreaterThan(0);

      const strategy = strategies[0];
      expect(strategy).toHaveProperty("filename");
      expect(strategy).toHaveProperty("name");
      expect(strategy).toHaveProperty("description");
      expect(strategy).toHaveProperty("tags");
      expect(typeof strategy.filename).toBe("string");
      expect(typeof strategy.name).toBe("string");
    });
  });

  // ── Strategy Detail Structure ─────────────────────────────

  test.describe("GET /api/strategy/strategies/:name", () => {
    test("should return full strategy config", async () => {
      const response = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      expect(response.ok()).toBeTruthy();

      const config = await response.json();

      // Top-level required fields
      expect(config).toHaveProperty("name");
      expect(config).toHaveProperty("pipeline");
      expect(config).toHaveProperty("exit_strategies");
      expect(Array.isArray(config.exit_strategies)).toBe(true);
      expect(config).toHaveProperty("model");
      expect(config).toHaveProperty("validation");
      expect(config).toHaveProperty("filters");
      expect(config).toHaveProperty("resources");
    });

    test("should have correctly structured model config", async () => {
      const response = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const config = await response.json();

      const model = config.model;
      expect(model).toBeDefined();

      // Required model fields after restructuring
      expect(model).toHaveProperty("type");
      expect(typeof model.type).toBe("string");
      expect(model.type.length).toBeGreaterThan(0);

      expect(model).toHaveProperty("architecture");
      expect(["unified", "long_short_separate"]).toContain(model.architecture);

      expect(model).toHaveProperty("trade_directions");
      expect(Array.isArray(model.trade_directions)).toBe(true);
      for (const dir of model.trade_directions) {
        expect(["long", "short"]).toContain(dir);
      }

      expect(model).toHaveProperty("hyperparameters");
      expect(typeof model.hyperparameters).toBe("object");
    });

    test("should have max_concurrent_assets in resources", async () => {
      const response = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const config = await response.json();

      const resources = config.resources;
      expect(resources).toBeDefined();

      // The only field that matters after simplification
      expect(resources).toHaveProperty("max_concurrent_assets");
      expect(typeof resources.max_concurrent_assets).toBe("number");
      expect(resources.max_concurrent_assets).toBeGreaterThanOrEqual(1);
    });

    test("should have correctly structured pipeline", async () => {
      const response = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const config = await response.json();

      const pipeline = config.pipeline;
      expect(pipeline).toBeDefined();
      expect(typeof pipeline).toBe("object");

      // Pipeline sections are optional but must be arrays when present
      for (const key of [
        "indicators",
        "preprocessing",
        "feature_selection",
        "data_loading",
      ]) {
        if (pipeline[key] !== undefined && pipeline[key] !== null) {
          expect(Array.isArray(pipeline[key])).toBe(true);

          // Each entry must have name, params is optional (data_loading uses source)
          for (const entry of pipeline[key]) {
            expect(entry).toHaveProperty("name");
            expect(typeof entry.name).toBe("string");
            if (entry.params !== undefined) {
              expect(typeof entry.params).toBe("object");
            }
          }
        }
      }
    });

    test("should have correctly structured exit_strategies", async () => {
      const response = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const config = await response.json();

      const exitStrategies = config.exit_strategies;
      expect(Array.isArray(exitStrategies)).toBe(true);
      expect(exitStrategies.length).toBeGreaterThan(0);

      for (const es of exitStrategies) {
        expect(es).toHaveProperty("name");
        expect(typeof es.name).toBe("string");
        expect(es).toHaveProperty("params");
        expect(typeof es.params).toBe("object");
        expect(es).toHaveProperty("ct");
        expect(Array.isArray(es.ct)).toBe(true);
      }
    });

    test("should have correctly structured validation config", async () => {
      const response = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const config = await response.json();

      const validation = config.validation;
      expect(validation).toBeDefined();
      expect(typeof validation).toBe("object");

      // Key validation fields
      expect(validation).toHaveProperty("n_inner_folds");
      expect(typeof validation.n_inner_folds).toBe("number");
    });
  });

  // ── Strategy Save Roundtrip ───────────────────────────────

  test.describe("PUT /api/strategy/strategies/:name", () => {
    test("should save and reload strategy without data loss", async () => {
      // Load original
      const getResponse = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const original = await getResponse.json();

      // Save unchanged config
      const putResponse = await request.put(
        `/api/strategy/strategies/${firstStrategyFilename}`,
        { data: original }
      );
      expect(putResponse.ok()).toBeTruthy();

      // Reload and verify
      const verifyResponse = await request.get(
        `/api/strategy/strategies/${firstStrategyFilename}`
      );
      const reloaded = await verifyResponse.json();

      // Core sections must match
      expect(reloaded.name).toBe(original.name);
      expect(reloaded.model.type).toBe(original.model.type);
      expect(reloaded.model.architecture).toBe(original.model.architecture);
      expect(reloaded.model.trade_directions).toEqual(
        original.model.trade_directions
      );
      expect(reloaded.model.hyperparameters).toEqual(
        original.model.hyperparameters
      );
      expect(reloaded.exit_strategies).toEqual(original.exit_strategies);
      expect(reloaded.resources.max_concurrent_assets).toBe(
        original.resources.max_concurrent_assets
      );
    });
  });

  // ── Plugins API ───────────────────────────────────────────

  test.describe("GET /api/plugins", () => {
    test("should list available plugins", async () => {
      const response = await request.get("/api/plugins");
      expect(response.ok()).toBeTruthy();

      const plugins = await response.json();
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);

      // Each plugin has required fields
      const plugin = plugins[0];
      expect(plugin).toHaveProperty("fqn");
      expect(plugin).toHaveProperty("name");
      expect(plugin).toHaveProperty("phase");
    });

    test("should filter plugins by model phase", async () => {
      const response = await request.get("/api/plugins?phase=model");
      expect(response.ok()).toBeTruthy();

      const plugins = await response.json();
      expect(Array.isArray(plugins)).toBe(true);

      // Should find at least xgboost
      if (plugins.length > 0) {
        for (const plugin of plugins) {
          expect(plugin.phase).toBe("model");
        }
        const names = plugins.map((p: any) => p.name);
        expect(names).toContain("xgboost");
      }
    });

    test("should filter plugins by indicators phase", async () => {
      const response = await request.get(
        "/api/plugins?phase=indicators"
      );
      expect(response.ok()).toBeTruthy();

      const plugins = await response.json();
      expect(Array.isArray(plugins)).toBe(true);

      for (const plugin of plugins) {
        expect(plugin.phase).toBe("indicators");
      }
    });
  });
});

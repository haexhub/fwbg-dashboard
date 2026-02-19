import { test, expect, type APIRequestContext } from "@playwright/test";

// Test account name (created in fwbg/accounts/test/)
const TEST_ACCOUNT = "test";

test.describe("Settings API", () => {
  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  test.describe("GET /api/settings/accounts", () => {
    test("should return list of accounts", async () => {
      const response = await request.get("/api/settings/accounts");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("accounts");
      expect(Array.isArray(data.accounts)).toBe(true);
      expect(data.accounts).toContain(TEST_ACCOUNT);
    });
  });

  test.describe("GET /api/settings/[account]/info", () => {
    test("should return account info for test account", async () => {
      const response = await request.get(
        `/api/settings/${TEST_ACCOUNT}/info`
      );
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("broker_type");
      expect(data).toHaveProperty("credentials");
      expect(data).toHaveProperty("money_management");
      expect(data).toHaveProperty("metadata");
      expect(typeof data.credentials).toBe("object");
      expect(data.metadata).toHaveProperty("account_name");
      expect(data.metadata).toHaveProperty("currency");
      expect(data.metadata).toHaveProperty("env");
      expect(data.metadata.env).toMatch(/^(DEMO|LIVE)$/);
      expect(data.metadata).toHaveProperty("is_active");
    });

    test("should return 404 for non-existent account", async () => {
      const response = await request.get(
        "/api/settings/non_existent_account/info"
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("GET /api/settings/[account]/assets", () => {
    test("should return assets config for test account", async () => {
      const response = await request.get(
        `/api/settings/${TEST_ACCOUNT}/assets`
      );
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(typeof data).toBe("object");
      expect(data).toHaveProperty("EURUSD");

      const asset = data.EURUSD;
      expect(asset).toHaveProperty("kelly_risk");
      expect(asset).toHaveProperty("point_value");
      expect(asset).toHaveProperty("spread");
      expect(asset).toHaveProperty("tp_mult");
      expect(asset).toHaveProperty("sl_mult");
      expect(asset).toHaveProperty("conf_thresh");
      expect(asset).toHaveProperty("features");
      expect(asset).toHaveProperty("good_hours");
      expect(asset).toHaveProperty("ensemble");
      expect(asset).toHaveProperty("dd_scaling");
      expect(Array.isArray(asset.features)).toBe(true);
      expect(Array.isArray(asset.good_hours)).toBe(true);
      expect(Array.isArray(asset.ensemble)).toBe(true);
    });

    test("should return 404 for non-existent account", async () => {
      const response = await request.get(
        "/api/settings/non_existent_account/assets"
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("PUT /api/settings/[account]/info", () => {
    test("should update account info", async () => {
      // Get current info first
      const getResponse = await request.get(`/api/settings/${TEST_ACCOUNT}/info`);
      const originalInfo = await getResponse.json();

      const updatedInfo = {
        ...originalInfo,
        metadata: {
          ...originalInfo.metadata,
          account_name: "Test Account Updated",
        },
      };

      const response = await request.put(`/api/settings/${TEST_ACCOUNT}/info`, {
        data: updatedInfo,
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("success", true);

      // Verify the update
      const verifyResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/info`
      );
      const verifyData = await verifyResponse.json();
      expect(verifyData.metadata.account_name).toBe("Test Account Updated");

      // Restore original
      await request.put(`/api/settings/${TEST_ACCOUNT}/info`, {
        data: originalInfo,
      });
    });

    test("should reject invalid account info structure", async () => {
      const response = await request.put(`/api/settings/${TEST_ACCOUNT}/info`, {
        data: { invalid: "data" },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe("PUT /api/settings/[account]/assets/[assetName]", () => {
    test("should update a single asset", async () => {
      // Get current asset first
      const getResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/assets`
      );
      const assets = await getResponse.json();
      const originalAsset = assets.EURUSD;

      const updatedAsset = {
        ...originalAsset,
        conf_thresh: 0.6,
      };

      const response = await request.put(
        `/api/settings/${TEST_ACCOUNT}/assets/EURUSD`,
        {
          data: updatedAsset,
        }
      );
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("success", true);

      // Verify the update
      const verifyResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/assets`
      );
      const verifyAssets = await verifyResponse.json();
      expect(verifyAssets.EURUSD.conf_thresh).toBe(0.6);

      // Restore original
      await request.put(`/api/settings/${TEST_ACCOUNT}/assets/EURUSD`, {
        data: originalAsset,
      });
    });

    test("should return 404 for non-existent asset", async () => {
      // Get a valid asset config to use
      const getResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/assets`
      );
      const assets = await getResponse.json();
      const sampleAsset = assets.EURUSD;

      const response = await request.put(
        `/api/settings/${TEST_ACCOUNT}/assets/NON_EXISTENT_ASSET`,
        {
          data: sampleAsset,
        }
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("POST /api/settings/[account]/assets", () => {
    const newAssetName = "TEST_ASSET_" + Date.now();

    test.afterAll(async () => {
      // Clean up test asset
      try {
        await request.delete(
          `/api/settings/${TEST_ACCOUNT}/assets/${newAssetName}`
        );
      } catch {
        // Asset might not exist if test failed
      }
    });

    test("should create a new asset", async () => {
      const newAsset = {
        name: newAssetName,
        config: {
          kelly_risk: 0.01,
          point_value: 0.0001,
          spread: 0.0001,
          tp_mult: 40,
          sl_mult: 20,
          conf_thresh: 0.55,
          features: ["test_feature"],
          good_hours: [8, 9, 10, 11, 12],
          ensemble: [],
          dd_scaling: { "10": 0.5 },
        },
      };

      const response = await request.post(
        `/api/settings/${TEST_ACCOUNT}/assets`,
        {
          data: newAsset,
        }
      );
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("assetName", newAssetName);

      // Verify the asset was created
      const verifyResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/assets`
      );
      const assets = await verifyResponse.json();
      expect(assets).toHaveProperty(newAssetName);
    });

    test("should reject duplicate asset name", async () => {
      const response = await request.post(
        `/api/settings/${TEST_ACCOUNT}/assets`,
        {
          data: {
            name: "EURUSD",
            config: {
              kelly_risk: 0.01,
              point_value: 0.0001,
              spread: 0.0001,
              tp_mult: 40,
              sl_mult: 20,
              conf_thresh: 0.55,
              features: [],
              good_hours: [],
              ensemble: [],
              dd_scaling: {},
            },
          },
        }
      );
      expect(response.status()).toBe(409);
    });
  });

  test.describe("DELETE /api/settings/[account]/assets/[assetName]", () => {
    const tempAssetName = "TEMP_DELETE_TEST_" + Date.now();

    test.beforeAll(async () => {
      // Create a temp asset to delete
      await request.post(`/api/settings/${TEST_ACCOUNT}/assets`, {
        data: {
          name: tempAssetName,
          config: {
            kelly_risk: 0.01,
            point_value: 0.0001,
            spread: 0.0001,
            tp_mult: 40,
            sl_mult: 20,
            conf_thresh: 0.55,
            features: [],
            good_hours: [],
            ensemble: [],
            dd_scaling: {},
          },
        },
      });
    });

    test("should delete an asset", async () => {
      const response = await request.delete(
        `/api/settings/${TEST_ACCOUNT}/assets/${tempAssetName}`
      );
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("success", true);

      // Verify the asset was deleted
      const verifyResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/assets`
      );
      const assets = await verifyResponse.json();
      expect(assets).not.toHaveProperty(tempAssetName);
    });

    test("should return 404 for non-existent asset", async () => {
      const response = await request.delete(
        `/api/settings/${TEST_ACCOUNT}/assets/NON_EXISTENT_ASSET`
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("POST /api/settings/[account]/toggle-active", () => {
    test("should toggle account active state", async () => {
      const infoResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/info`
      );
      const infoBefore = await infoResponse.json();
      const stateBefore = infoBefore.metadata.is_active ?? true;

      const response = await request.post(
        `/api/settings/${TEST_ACCOUNT}/toggle-active`
      );
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("isActive", !stateBefore);

      // Verify the change
      const verifyResponse = await request.get(
        `/api/settings/${TEST_ACCOUNT}/info`
      );
      const infoAfter = await verifyResponse.json();
      expect(infoAfter.metadata.is_active).toBe(!stateBefore);

      // Toggle back to restore original state
      await request.post(`/api/settings/${TEST_ACCOUNT}/toggle-active`);
    });
  });
});

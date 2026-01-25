import { test, expect } from "@playwright/test";

// Test account name (created in fwbg/accounts/test/)
const TEST_ACCOUNT = "test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page with test account
    await page.goto(`/settings?account=${TEST_ACCOUNT}`);
    // Wait for the page to fully load - wait for account data to appear
    await page.waitForSelector("text=Test Account", { timeout: 15000 });
  });

  test("should display settings page header", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Settings");
    // The link contains "Zurück zum Dashboard"
    await expect(page.getByRole("link", { name: /Dashboard/i })).toBeVisible();
  });

  test("should display account tabs", async ({ page }) => {
    // Check that the test account tab is visible
    await expect(page.getByRole("tab", { name: TEST_ACCOUNT })).toBeVisible();
  });

  test("should display account status card", async ({ page }) => {
    // Check status card with active/inactive indicator
    await expect(page.getByText("Test Account")).toBeVisible();
    await expect(page.getByText(/Status:/)).toBeVisible();
  });

  test("should display account info section", async ({ page }) => {
    // The card header contains "Account Info"
    await expect(page.locator("text=Account Info").first()).toBeVisible();
    // Form fields - look for the label text
    await expect(page.locator("text=Account Name").first()).toBeVisible();
    await expect(page.locator("text=Währung").first()).toBeVisible();
    await expect(page.locator("text=Umgebung").first()).toBeVisible();
  });

  test("should display money management section", async ({ page }) => {
    await expect(page.locator("text=Money Management").first()).toBeVisible();
    await expect(page.locator("text=Max Margin Usage").first()).toBeVisible();
    await expect(page.locator("text=Min Lot Size").first()).toBeVisible();
    await expect(page.locator("text=Emergency Stop %").first()).toBeVisible();
  });

  test("should display credentials section", async ({ page }) => {
    await expect(page.locator("text=Credentials").first()).toBeVisible();
    await expect(page.locator("text=API Key").first()).toBeVisible();
    await expect(page.locator("text=Username").first()).toBeVisible();
    await expect(page.locator("text=Password").first()).toBeVisible();
  });

  test("should have password field in credentials section", async ({ page }) => {
    // Check that credentials section exists with password field
    await expect(page.locator("text=Credentials").first()).toBeVisible();
    await expect(page.locator("text=Password").first()).toBeVisible();
    // Check that there's a password input somewhere on the page
    const passwordInputs = page.locator('input[type="password"]');
    expect(await passwordInputs.count()).toBeGreaterThan(0);
  });

  test("should display assets section", async ({ page }) => {
    await expect(page.locator("text=Assets").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Neues Asset/i })).toBeVisible();
  });

  test("should display EURUSD asset", async ({ page }) => {
    // The test account has EURUSD configured
    await expect(page.locator("h3:has-text('EURUSD')")).toBeVisible();
  });

  test("should display asset cards with expand button", async ({ page }) => {
    // Wait for page content
    await page.waitForSelector("text=Assets", { timeout: 15000 });

    // Check that expand button exists for EURUSD
    const expandButton = page.locator('[data-testid="expand-EURUSD"]');
    await expect(expandButton).toBeVisible({ timeout: 10000 });

    // Check that "2 Features" badge is visible for EURUSD
    await expect(page.locator("text=2 Features").first()).toBeVisible();

    // Check that Speichern button exists for assets
    await expect(page.getByRole("button", { name: "Speichern" }).first()).toBeVisible();
  });

  test("should show emergency stop button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Notschalter/i })).toBeVisible();
  });

  test("should have emergency stop button visible", async ({ page }) => {
    // Just verify the emergency stop button exists
    const notschalter = page.getByRole("button", { name: /Notschalter/i });
    await expect(notschalter).toBeVisible();
  });

  test("should have activate/deactivate button visible", async ({ page }) => {
    // Verify the toggle button exists
    const toggleButton = page.getByRole("button", {
      name: /Aktivieren|Deaktivieren/i,
    }).first();
    await expect(toggleButton).toBeVisible();
  });

  test("should navigate back to dashboard", async ({ page }) => {
    await page.getByRole("link", { name: /Dashboard/i }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Settings Page - Asset Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/settings?account=${TEST_ACCOUNT}`);
    // Wait for account data to load
    await page.waitForSelector("text=Test Account", { timeout: 15000 });
  });

  test("should have new asset button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Neues Asset/i })).toBeVisible();
  });

  test("should display multiple asset cards", async ({ page }) => {
    // Check that at least the EURUSD card exists (via its expand button)
    const expandButtons = page.locator('[data-testid^="expand-"]');
    const count = await expandButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Dashboard Settings Navigation", () => {
  test("should navigate to settings from dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=FWBG Trading Dashboard");

    await page.getByRole("link", { name: /Settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText("Settings")).toBeVisible();
  });
});

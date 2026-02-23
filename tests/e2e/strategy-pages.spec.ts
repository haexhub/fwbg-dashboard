import { test, expect } from "@playwright/test";

/**
 * Strategy UI page tests.
 *
 * Verifies the strategy editor pages render correctly after the fwbg
 * model restructuring (simplified resources, model plugin system).
 *
 * Requires: fwbg API running on localhost:8420 with at least one strategy.
 */

let firstStrategyFilename: string;

test.beforeAll(async ({ request }) => {
  // Discover first strategy via API
  const response = await request.get("http://localhost:3100/api/strategy/strategies");
  const strategies = await response.json();
  expect(strategies.length).toBeGreaterThan(0);
  firstStrategyFilename = strategies[0].filename;
});

// ── Strategy List Page ────────────────────────────────────────

test.describe("Strategy List Page", () => {
  test("should display strategy list", async ({ page }) => {
    await page.goto("/strategy");
    await page.waitForSelector("text=Strategies", { timeout: 15000 });

    await expect(page.locator("h2:has-text('Strategies')").first()).toBeVisible();
  });

  test("should navigate to strategy detail", async ({ page }) => {
    await page.goto("/strategy");
    await page.waitForSelector("text=Strategies", { timeout: 15000 });

    // Click the first strategy link
    const strategyLink = page.locator(`a[href*="/strategy/${firstStrategyFilename}"]`).first();
    if (await strategyLink.isVisible()) {
      await strategyLink.click();
      await expect(page).toHaveURL(new RegExp(`/strategy/${firstStrategyFilename}`));
    }
  });
});

// ── Strategy Detail — Tab Navigation ─────────────────────────

test.describe("Strategy Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}`);
    // Wait for strategy config to load — the tab navigation appears when loaded
    await page.waitForSelector("text=Übersicht", { timeout: 15000 });
  });

  test("should display strategy name and action buttons", async ({ page }) => {
    // Header should show strategy name
    await expect(page.locator("h2").first()).toBeVisible();

    // Action buttons render via ClientOnly — wait for hydration
    await expect(page.getByRole("button", { name: /Save/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Run/ }).first()).toBeVisible();
  });

  test("should display all tabs", async ({ page }) => {
    const expectedTabs = [
      "Übersicht",
      "Pipeline",
      "Model",
      "Grids",
      "Validation",
      "Filters",
      "Resources",
    ];

    for (const tabLabel of expectedTabs) {
      await expect(page.locator(`a:has-text("${tabLabel}")`).first()).toBeVisible();
    }
  });

  test("should navigate between tabs", async ({ page }) => {
    // Navigate to Model tab
    await page.locator(`a:has-text("Model")`).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/strategy/${firstStrategyFilename}/model`)
    );

    // Navigate to Resources tab
    await page.locator(`a:has-text("Resources")`).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/strategy/${firstStrategyFilename}/resources`)
    );

    // Navigate back to Overview
    await page.locator(`a:has-text("Übersicht")`).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/strategy/${firstStrategyFilename}$`)
    );
  });
});

// ── Overview Tab ─────────────────────────────────────────────

test.describe("Strategy Overview Tab", () => {
  test("should display metadata fields", async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}`);
    await page.waitForSelector("text=Metadata", { timeout: 15000 });

    await expect(page.locator("text=Metadata").first()).toBeVisible();
    await expect(page.locator("text=Name").first()).toBeVisible();
    await expect(page.locator("text=Beschreibung").first()).toBeVisible();
    await expect(page.locator("text=Tags").first()).toBeVisible();
  });

  test("should display quick stats including model type", async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}`);
    await page.waitForSelector("text=Model", { timeout: 15000 });

    // Should show model type in quick stats
    await expect(page.locator("text=Model").first()).toBeVisible();
    await expect(page.locator("text=Indikatoren").first()).toBeVisible();
    await expect(page.locator("text=Exit-Strategie").first()).toBeVisible();
  });
});

// ── Model Tab ───────────────────────────────────────────────

test.describe("Strategy Model Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}/model`);
    await page.waitForSelector("text=Model-Konfiguration", { timeout: 15000 });
  });

  test("should display model type field", async ({ page }) => {
    await expect(page.locator("text=Typ").first()).toBeVisible();

    // Model type should be an input with a value (e.g. "xgboost")
    const typeInput = page.locator("input").first();
    const value = await typeInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("should display architecture selector", async ({ page }) => {
    await expect(page.locator("text=Architektur").first()).toBeVisible();
  });

  test("should display trade direction buttons", async ({ page }) => {
    await expect(page.locator("text=Trade-Richtungen").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Long" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Short" })).toBeVisible();
  });

  test("should display hyperparameters section", async ({ page }) => {
    await expect(page.locator("text=Hyperparameter").first()).toBeVisible();

    // Should have add hyperparameter form
    await expect(page.locator("input[placeholder='Key']")).toBeVisible();
    await expect(page.locator("input[placeholder='Value']")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hinzufügen" })
    ).toBeVisible();
  });

  test("should show existing hyperparameters", async ({ page }) => {
    const hyperparamRows = page.locator(".font-mono.text-sm.text-gray-400");
    const count = await hyperparamRows.count();

    // Strategy might have zero hyperparameters explicitly set, that's ok
    const noParams = page.locator("text=Keine Hyperparameter konfiguriert");
    if (count === 0) {
      await expect(noParams).toBeVisible();
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ── Resources Tab ───────────────────────────────────────────

test.describe("Strategy Resources Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}/resources`);
    await page.waitForSelector("text=Ressourcen", { timeout: 15000 });
  });

  test("should display max_concurrent_assets field", async ({ page }) => {
    await expect(
      page.locator("text=Max. Concurrent Assets").first()
    ).toBeVisible();
  });

  test("max_concurrent_assets should have a valid value", async ({ page }) => {
    const formField = page.locator("text=Max. Concurrent Assets").first();
    await expect(formField).toBeVisible();

    const input = page.locator('input[type="number"][min="1"]').first();
    if (await input.isVisible()) {
      const value = await input.inputValue();
      expect(Number(value)).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * COMPATIBILITY CHECK: These fields were REMOVED from fwbg's ResourceConfig.
   * After the fix, the dashboard should only show max_concurrent_assets.
   */
  test("should NOT show obsolete ram_per_worker_gb field", async ({ page }) => {
    const obsoleteField = page.locator("text=RAM pro Worker");
    await expect(obsoleteField).not.toBeVisible();
  });

  test("should NOT show obsolete min_free_ram_percent field", async ({ page }) => {
    const obsoleteField = page.locator("text=Min. Free RAM");
    await expect(obsoleteField).not.toBeVisible();
  });

  test("should NOT show obsolete max_cpu_percent field", async ({ page }) => {
    const obsoleteField = page.locator("text=Max. CPU");
    await expect(obsoleteField).not.toBeVisible();
  });

  test("should NOT show obsolete xgboost_n_jobs field", async ({ page }) => {
    const obsoleteField = page.locator("text=XGBoost n_jobs");
    await expect(obsoleteField).not.toBeVisible();
  });
});

// ── Validation Tab ──────────────────────────────────────────

test.describe("Strategy Validation Tab", () => {
  test("should load validation page", async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}/validation`);
    // Should not show a Nuxt error page
    await expect(page.locator("text=500")).not.toBeVisible();
  });
});

// ── Filters Tab ─────────────────────────────────────────────

test.describe("Strategy Filters Tab", () => {
  test("should load filters page", async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}/filters`);
    await expect(page.locator("text=500")).not.toBeVisible();
  });
});

// ── Grids Tab ───────────────────────────────────────────────

test.describe("Strategy Grids Tab", () => {
  test("should load grids page", async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}/grids`);
    // Should not show Nuxt error overlay
    await expect(page.locator("[data-nuxt-error]")).not.toBeVisible();
  });
});

// ── Undo/Redo Buttons ───────────────────────────────────────

test.describe("Strategy Undo/Redo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}`);
    await page.waitForSelector("text=Metadata", { timeout: 15000 });
  });

  test("should show undo/redo/reset buttons in header", async ({ page }) => {
    const undoBtn = page.locator("[data-testid=undo-btn] button");
    const redoBtn = page.locator("[data-testid=redo-btn] button");
    const resetBtn = page.locator("[data-testid=reset-btn] button");

    // Wait for client-side hydration (buttons render via ClientOnly)
    await expect(undoBtn).toBeVisible({ timeout: 5000 });
    await expect(redoBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();

    // All should be disabled initially (no changes yet)
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();
  });

  test("should enable undo after editing", async ({ page }) => {
    const undoBtn = page.locator("[data-testid=undo-btn] button");
    const redoBtn = page.locator("[data-testid=redo-btn] button");

    // Wait for client-side hydration (buttons render via ClientOnly)
    await expect(undoBtn).toBeVisible({ timeout: 5000 });

    // Initially disabled
    await expect(undoBtn).toBeDisabled();

    // Edit the name field (UFormField label="Name" → sibling UInput)
    const nameInput = page.getByLabel("Name", { exact: true });
    const originalValue = await nameInput.inputValue();
    await nameInput.fill(originalValue + " test-undo");

    // Wait for debounced snapshot (300ms + buffer)
    await page.waitForTimeout(500);

    // Undo should now be enabled
    await expect(undoBtn).toBeEnabled({ timeout: 3000 });
    // Redo should still be disabled
    await expect(redoBtn).toBeDisabled();
  });

  test("should undo a change and enable redo", async ({ page }) => {
    const undoBtn = page.locator("[data-testid=undo-btn] button");
    const redoBtn = page.locator("[data-testid=redo-btn] button");

    // Wait for client-side hydration (buttons render via ClientOnly)
    await expect(undoBtn).toBeVisible({ timeout: 5000 });

    const nameInput = page.getByLabel("Name", { exact: true });
    const originalValue = await nameInput.inputValue();
    await nameInput.fill(originalValue + " test-undo");

    // Wait for debounced snapshot
    await page.waitForTimeout(500);
    await expect(undoBtn).toBeEnabled({ timeout: 3000 });

    // Click undo
    await undoBtn.click();

    // Value should be restored
    await expect(nameInput).toHaveValue(originalValue, { timeout: 3000 });

    // Redo should now be enabled
    await expect(redoBtn).toBeEnabled({ timeout: 3000 });
    // Undo should be disabled (no more history)
    await expect(undoBtn).toBeDisabled();
  });

  test("should redo a change after undo", async ({ page }) => {
    const undoBtn = page.locator("[data-testid=undo-btn] button");
    const redoBtn = page.locator("[data-testid=redo-btn] button");

    // Wait for client-side hydration (buttons render via ClientOnly)
    await expect(undoBtn).toBeVisible({ timeout: 5000 });

    const nameInput = page.getByLabel("Name", { exact: true });
    const originalValue = await nameInput.inputValue();
    const editedValue = originalValue + " test-redo";
    await nameInput.fill(editedValue);

    // Wait for debounce, then undo
    await page.waitForTimeout(500);
    await expect(undoBtn).toBeEnabled({ timeout: 3000 });
    await undoBtn.click();
    await expect(nameInput).toHaveValue(originalValue, { timeout: 3000 });

    // Now redo
    await redoBtn.click();
    await expect(nameInput).toHaveValue(editedValue, { timeout: 3000 });

    // After redo, redo should be disabled again
    await expect(redoBtn).toBeDisabled();
    // Undo should be enabled
    await expect(undoBtn).toBeEnabled();
  });

  test("should clear undo/redo on reset", async ({ page }) => {
    const undoBtn = page.locator("[data-testid=undo-btn] button");
    const redoBtn = page.locator("[data-testid=redo-btn] button");
    const resetBtn = page.locator("[data-testid=reset-btn] button");

    // Wait for client-side hydration (buttons render via ClientOnly)
    await expect(undoBtn).toBeVisible({ timeout: 5000 });

    const nameInput = page.getByLabel("Name", { exact: true });
    const originalValue = await nameInput.inputValue();
    await nameInput.fill(originalValue + " test-reset");

    // Wait for debounce
    await page.waitForTimeout(500);
    await expect(undoBtn).toBeEnabled({ timeout: 3000 });

    // Click reset
    await resetBtn.click();

    // Both undo and redo should be disabled after reset
    await expect(undoBtn).toBeDisabled({ timeout: 3000 });
    await expect(redoBtn).toBeDisabled();

    // Value should be back to original
    await expect(nameInput).toHaveValue(originalValue, { timeout: 3000 });
  });

  test("should not show pipeline-specific undo/reset toolbar", async ({
    page,
  }) => {
    // Navigate to pipeline tab
    await page.locator(`a:has-text("Pipeline")`).first().click();
    await page.waitForURL(
      new RegExp(`/strategy/${firstStrategyFilename}/pipeline`),
    );

    // Pipeline-specific undo/reset buttons should NOT exist
    const pipelineUndo = page.locator("button:has-text('Undo')");
    const pipelineReset = page.locator("button:has-text('Reset Pipeline')");
    await expect(pipelineUndo).not.toBeVisible();
    await expect(pipelineReset).not.toBeVisible();
  });
});

// ── Dirty State & Save Flow ─────────────────────────────────

test.describe("Strategy Save Flow", () => {
  test("should mark config as dirty after edit", async ({ page }) => {
    await page.goto(`/strategy/${firstStrategyFilename}`);
    await page.waitForSelector("text=Metadata", { timeout: 15000 });

    // Wait for client-side hydration (buttons render via ClientOnly)
    const resetBtn = page.locator("[data-testid=reset-btn] button");
    await expect(resetBtn).toBeVisible({ timeout: 5000 });

    // The "unsaved" badge should NOT be visible initially
    const unsavedBadge = page.getByText("unsaved");
    await expect(unsavedBadge).not.toBeVisible();

    // Find the name input field and edit it
    const nameInput = page.getByLabel("Name", { exact: true });
    const originalValue = await nameInput.inputValue();
    await nameInput.fill(originalValue + " edited");

    // Wait briefly for Vue reactivity
    await page.waitForTimeout(200);

    // The "unsaved" badge should now be visible
    await expect(unsavedBadge).toBeVisible({ timeout: 5000 });

    // Reset button should be enabled
    await expect(resetBtn).toBeEnabled({ timeout: 5000 });

    // Click reset to undo changes
    await resetBtn.click();

    // Badge should disappear
    await expect(unsavedBadge).not.toBeVisible({ timeout: 5000 });
  });
});

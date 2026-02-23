import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Run tests serially to avoid race conditions with shared test data
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use single worker to prevent parallel access to test account
  reporter: "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

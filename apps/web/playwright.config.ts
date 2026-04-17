/**
 * Playwright configuration for E2E tests.
 *
 * Requires @playwright/test to be installed:
 *   pnpm add -D @playwright/test        (run inside apps/web or from the root)
 *   pnpm exec playwright install chromium
 *
 * Run all E2E tests:
 *   pnpm exec playwright test
 *
 * Run a single spec:
 *   pnpm exec playwright test e2e/bot-wizard.spec.ts
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  /* Run tests in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit workers on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter */
  reporter: "html",

  use: {
    /* Base URL of the Next.js dev server */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    /* Collect traces on first retry (useful in CI) */
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Automatically start the Next.js dev server before running tests */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

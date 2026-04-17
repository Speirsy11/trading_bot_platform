/**
 * T-1: Bot creation wizard E2E tests
 *
 * Prerequisites:
 *   pnpm add -D @playwright/test   (in apps/web — or run from the root)
 *   npx playwright install chromium
 *
 * Run:
 *   pnpm exec playwright test e2e/bot-wizard.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock all tRPC batch calls that the wizard might fire. */
async function mockWizardTrpc(page: Page) {
  await page.route("**/trpc/**", async (route) => {
    const url = route.request().url();

    // market.getStrategies
    if (url.includes("market.getStrategies")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: { data: [{ name: "sma_crossover" }, { name: "rsi_mean_reversion" }] } },
        ]),
      });
      return;
    }

    // exchanges.list
    if (url.includes("exchanges.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: [
                { exchange: "binance", name: "Binance" },
                { exchange: "kraken", name: "Kraken" },
              ],
            },
          },
        ]),
      });
      return;
    }

    // bots.create — return a minimal bot object
    if (url.includes("bots.create")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                id: "00000000-0000-0000-0000-000000000001",
                name: "My E2E Bot",
                status: "idle",
              },
            },
          },
        ]),
      });
      return;
    }

    // Fall through for anything else (e.g. Next.js prefetch, etc.)
    await route.continue();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Bot creation wizard", () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardTrpc(page);
    // Clear any saved draft so tests always start from a clean slate.
    await page.addInitScript(() => {
      localStorage.removeItem("bot-wizard-draft");
    });
    await page.goto("/bots/new");
  });

  // -------------------------------------------------------------------------
  // Step 0 – Strategy
  // -------------------------------------------------------------------------

  test("renders step 0 (Strategy) on first load", async ({ page }) => {
    // Heading
    await expect(page.getByRole("heading", { name: "Select Strategy" })).toBeVisible();

    // Name input
    await expect(page.getByLabel("Bot Name")).toBeVisible();

    // Strategy select
    await expect(page.getByLabel("Strategy")).toBeVisible();

    // Step indicators: "1 Strategy" should be highlighted, others muted
    const stepButtons = page.getByRole("button", {
      name: /Strategy|Parameters|Exchange|Risk|Mode|Review/i,
    });
    await expect(stepButtons.first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  test("Next button advances steps and step indicators update", async ({ page }) => {
    // Fill Step 0 required fields
    await page.getByLabel("Bot Name").fill("My E2E Bot");
    await page.getByLabel("Strategy").selectOption("sma_crossover");

    // Advance to Step 1 (Parameters)
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByRole("heading", { name: "Strategy Parameters" })).toBeVisible();

    // Step 0 indicator should now show a checkmark (lucide Check renders as svg)
    // and Step 2 (Parameters) label should be active text
    const stepIndicator1 = page.getByRole("button", { name: /strategy/i }).first();
    // The step-0 button now renders a <Check> icon — the accessible text changes
    // because the number "1" is replaced with the icon; we verify via the label text.
    await expect(stepIndicator1).toContainText("Strategy");

    // Advance to Step 2 (Exchange & Pair)
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByRole("heading", { name: "Exchange & Pair" })).toBeVisible();

    // Advance to Step 3 (Risk)
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByRole("heading", { name: "Risk Management" })).toBeVisible();

    // Advance to Step 4 (Mode)
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByRole("heading", { name: "Mode Selection" })).toBeVisible();

    // Advance to Step 5 (Review)
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByRole("heading", { name: "Review & Create" })).toBeVisible();

    // On the final step the Next button is replaced with "Create Bot"
    await expect(page.getByRole("button", { name: /create bot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);
  });

  test("Back button navigates to the previous step", async ({ page }) => {
    // Fill Step 0 and advance
    await page.getByLabel("Bot Name").fill("My E2E Bot");
    await page.getByLabel("Strategy").selectOption("sma_crossover");
    await page.getByRole("button", { name: /next/i }).click();

    // Now on Step 1 – go back
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByRole("heading", { name: "Select Strategy" })).toBeVisible();
  });

  test("clicking a completed step indicator jumps back to that step", async ({ page }) => {
    // Complete Step 0 and move to Step 1
    await page.getByLabel("Bot Name").fill("My E2E Bot");
    await page.getByLabel("Strategy").selectOption("sma_crossover");
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByRole("heading", { name: "Strategy Parameters" })).toBeVisible();

    // Click the Step 0 indicator button
    await page
      .getByRole("button", { name: /strategy/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Select Strategy" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  test("Next is blocked when required fields are empty on Step 0", async ({ page }) => {
    // Do not fill Bot Name or Strategy — click Next
    await page.getByRole("button", { name: /next/i }).click();

    // Should still be on Step 0
    await expect(page.getByRole("heading", { name: "Select Strategy" })).toBeVisible();

    // Validation error message for name
    await expect(page.getByRole("alert")).toContainText(/required|name is required/i);
  });

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  test("Templates dropdown loads a template and resets to Step 0", async ({ page }) => {
    // Advance to step 1 first
    await page.getByLabel("Bot Name").fill("Temp Bot");
    await page.getByLabel("Strategy").selectOption("sma_crossover");
    await page.getByRole("button", { name: /next/i }).click();

    // Open templates dropdown
    await page.getByRole("button", { name: /templates/i }).click();
    await expect(page.getByRole("button", { name: /Conservative SMA Crossover/i })).toBeVisible();

    // Load template
    await page.getByRole("button", { name: /Conservative SMA Crossover/i }).click();

    // Should be back at Step 0
    await expect(page.getByRole("heading", { name: "Select Strategy" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Full wizard submission
  // -------------------------------------------------------------------------

  test("submitting the full wizard calls bots.create and navigates to /bots", async ({ page }) => {
    // Step 0
    await page.getByLabel("Bot Name").fill("My E2E Bot");
    await page.getByLabel("Strategy").selectOption("sma_crossover");
    await page.getByRole("button", { name: /next/i }).click();

    // Step 1 – Parameters (timeframe already has a default)
    await page.getByRole("button", { name: /next/i }).click();

    // Step 2 – Exchange & Pair
    await expect(page.getByLabel("Exchange")).toBeVisible();
    await page.getByLabel("Symbol").fill("BTC/USDT");
    await page.getByRole("button", { name: /next/i }).click();

    // Step 3 – Risk (all fields have defaults)
    await page.getByRole("button", { name: /next/i }).click();

    // Step 4 – Mode (default is "paper")
    await page.getByRole("button", { name: /next/i }).click();

    // Step 5 – Review
    await expect(page.getByRole("heading", { name: "Review & Create" })).toBeVisible();
    // Review table should show the bot name
    await expect(page.getByText("My E2E Bot")).toBeVisible();

    // Intercept the navigation to /bots after successful create
    const navPromise = page.waitForURL("**/bots");
    await page.getByRole("button", { name: /create bot/i }).click();
    await navPromise;

    await expect(page).toHaveURL(/\/bots$/);
  });
});

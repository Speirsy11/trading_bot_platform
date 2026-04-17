/**
 * T-2: Trading page E2E tests
 *
 * Prerequisites:
 *   pnpm add -D @playwright/test   (in apps/web — or run from the root)
 *   npx playwright install chromium
 *
 * Run:
 *   pnpm exec playwright test e2e/trading.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_ORDER_ID = "ord_e2e_001";

const MOCK_TICKER = {
  exchange: "binance",
  symbol: "BTC/USDT",
  bid: 68000,
  ask: 68001,
  last: 68000,
  volume: 12345.6,
  change24h: 1.25,
  timestamp: Date.now(),
};

const MOCK_CANDLES = Array.from({ length: 10 }, (_, i) => ({
  time: Date.now() - (10 - i) * 3_600_000,
  open: 67000 + i * 100,
  high: 67500 + i * 100,
  low: 66800 + i * 100,
  close: 67200 + i * 100,
  volume: 100 + i,
}));

const MOCK_ORDER_BOOK = {
  bids: [
    [67999, 0.5],
    [67998, 1.2],
    [67997, 0.3],
    [67996, 2.0],
    [67995, 0.8],
  ],
  asks: [
    [68001, 0.4],
    [68002, 1.1],
    [68003, 0.9],
    [68004, 1.5],
    [68005, 0.6],
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wire up tRPC batch-link mocks for all endpoints the trading page calls.
 * Returns a `capturedOrderRequests` array that is populated each time
 * trading.placeOrder is intercepted, so tests can assert on the payload.
 */
async function mockTradingTrpc(page: Page, capturedOrderRequests: unknown[] = []) {
  await page.route("**/trpc/**", async (route) => {
    const url = route.request().url();
    const body = route.request().postData();

    // market.getTicker
    if (url.includes("market.getTicker")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: MOCK_TICKER } }]),
      });
      return;
    }

    // market.getCandles / getOHLCV
    if (url.includes("market.getOHLCV") || url.includes("market.getCandles")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: MOCK_CANDLES } }]),
      });
      return;
    }

    // market.getOrderBook
    if (url.includes("market.getOrderBook")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: MOCK_ORDER_BOOK } }]),
      });
      return;
    }

    // trading.placeOrder — record the request and return a fake order
    if (url.includes("trading.placeOrder")) {
      if (body) {
        try {
          capturedOrderRequests.push(JSON.parse(body));
        } catch {
          // ignore parse errors
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                id: MOCK_ORDER_ID,
                symbol: "BTC/USDT",
                side: "buy",
                type: "market",
                amount: 0.001,
                status: "open",
                timestamp: Date.now(),
              },
            },
          },
        ]),
      });
      return;
    }

    // trading.cancelOrder
    if (url.includes("trading.cancelOrder")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: { success: true } } }]),
      });
      return;
    }

    // Default: continue (handles Next.js internals, static assets, etc.)
    await route.continue();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Trading page", () => {
  test.beforeEach(async ({ page }) => {
    await mockTradingTrpc(page);
    await page.goto("/trading");
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test("renders the page heading with the selected symbol", async ({ page }) => {
    // The heading shows the symbol from the zustand ui-store (default: BTC/USDT)
    await expect(page.getByRole("heading", { name: /BTC\/USDT/i })).toBeVisible();
  });

  test("renders timeframe selector buttons", async ({ page }) => {
    for (const tf of ["1m", "5m", "15m", "1h", "4h", "1d"]) {
      await expect(page.getByRole("button", { name: tf })).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // Order form – structure
  // -------------------------------------------------------------------------

  test("order form renders with side buttons, type buttons, and amount input", async ({ page }) => {
    // Buy / Sell side buttons
    await expect(page.getByRole("button", { name: /^buy$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sell$/i })).toBeVisible();

    // Market / Limit type buttons
    await expect(page.getByRole("button", { name: /^market$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^limit$/i })).toBeVisible();

    // Amount input (visible for both market and limit)
    await expect(page.getByLabel("Amount")).toBeVisible();

    // Place Order button (initially enabled because the ui-store has defaults)
    await expect(page.getByRole("button", { name: /buy btc/i })).toBeVisible();
  });

  test("price input is hidden for market orders and shown for limit orders", async ({ page }) => {
    // Default order type is "market" — price field should not exist
    await expect(page.getByLabel("Price")).toHaveCount(0);

    // Switch to limit
    await page.getByRole("button", { name: /^limit$/i }).click();
    await expect(page.getByLabel("Price")).toBeVisible();

    // Switch back to market
    await page.getByRole("button", { name: /^market$/i }).click();
    await expect(page.getByLabel("Price")).toHaveCount(0);
  });

  test("switching side updates the submit button label and color", async ({ page }) => {
    // Default: buy side
    await expect(page.getByRole("button", { name: /buy btc/i })).toBeVisible();

    // Switch to sell
    await page.getByRole("button", { name: /^sell$/i }).click();
    await expect(page.getByRole("button", { name: /sell btc/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Order form – validation
  // -------------------------------------------------------------------------

  test("submitting with empty amount shows an error toast", async ({ page }) => {
    // Amount is empty by default — click the buy button
    await page.getByRole("button", { name: /buy btc/i }).click();

    // A toast error should appear
    await expect(page.getByText(/amount must be greater than 0/i)).toBeVisible();
  });

  test("limit order: submitting without price shows an error toast", async ({ page }) => {
    await page.getByRole("button", { name: /^limit$/i }).click();
    await page.getByLabel("Amount").fill("0.001");
    // Leave price empty
    await page.getByRole("button", { name: /buy btc/i }).click();

    await expect(page.getByText(/price is required for limit orders/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Order form – successful submission
  // -------------------------------------------------------------------------

  test("placing a market order calls trading.placeOrder and shows a success toast", async ({
    page,
  }) => {
    const captured: unknown[] = [];
    // Override route handler to also record payload
    await mockTradingTrpc(page, captured);

    await page.getByLabel("Amount").fill("0.001");

    // The submit button text is "Buy BTC" when exchange/symbol are set
    await page.getByRole("button", { name: /buy btc/i }).click();

    // Success toast with the returned order ID
    await expect(page.getByText(new RegExp(MOCK_ORDER_ID))).toBeVisible();
  });

  test("placing a limit order fills price and amount then succeeds", async ({ page }) => {
    await page.getByRole("button", { name: /^limit$/i }).click();
    await page.getByLabel("Price").fill("67000");
    await page.getByLabel("Amount").fill("0.005");

    await page.getByRole("button", { name: /buy btc/i }).click();

    await expect(page.getByText(new RegExp(MOCK_ORDER_ID))).toBeVisible();
  });

  test("after placing an order, the amount input is cleared", async ({ page }) => {
    await page.getByLabel("Amount").fill("0.001");
    await page.getByRole("button", { name: /buy btc/i }).click();

    // Wait for the toast (order confirmed)
    await expect(page.getByText(new RegExp(MOCK_ORDER_ID))).toBeVisible();

    // Amount should have been reset
    await expect(page.getByLabel("Amount")).toHaveValue("");
  });

  // -------------------------------------------------------------------------
  // Order book
  // -------------------------------------------------------------------------

  test("order book panel is visible", async ({ page }) => {
    // The "Order Book" heading is inside a glass-panel
    await expect(page.getByText("Order Book")).toBeVisible();
  });
});

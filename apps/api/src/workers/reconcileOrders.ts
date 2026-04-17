import { orderAuditLog, type Database } from "@tb/db";
import { and, eq, isNull, lt } from "drizzle-orm";

import type { ExchangeManager } from "../services/exchangeManager";

export interface ReconcileResult {
  checked: number;
  stuck: number;
  updated: number;
}

/**
 * On startup: scan orderAuditLog for "placed" records older than 5 minutes
 * with no settledAt, then reconcile each against the exchange.
 *
 * - filled/cancelled/expired on exchange → write settledAt + exchange status
 * - order not found on exchange (404-like) → mark "failed" with a clear message
 * - exchange fetch errors → warn and skip (order left unchanged)
 */
export async function reconcileOpenOrders(
  db: Database,
  exchangeManager: ExchangeManager
): Promise<ReconcileResult> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);

  const candidates = await db
    .select()
    .from(orderAuditLog)
    .where(
      and(
        eq(orderAuditLog.status, "placed"),
        isNull(orderAuditLog.settledAt),
        lt(orderAuditLog.requestedAt, cutoff)
      )
    );

  let stuck = 0;
  let updated = 0;

  for (const record of candidates) {
    // We need both orderId and symbol to query the exchange
    if (!record.orderId || !record.symbol) {
      console.warn(`[reconcileOrders] skipping record ${record.id}: missing orderId or symbol`);
      continue;
    }

    let exchangeStatus: string;

    try {
      const exchangeOrder = await exchangeManager.fetchOrder(
        record.exchangeId,
        record.orderId,
        record.symbol
      );
      exchangeStatus = exchangeOrder.status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();

      // Treat "order not found" style errors as definitively missing
      const isNotFound =
        lower.includes("order not found") ||
        lower.includes("does not exist") ||
        lower.includes("invalid order") ||
        lower.includes("not found");

      if (isNotFound) {
        stuck++;
        await db
          .update(orderAuditLog)
          .set({
            status: "failed",
            errorMessage: "not found on exchange after restart",
            settledAt: new Date(),
          })
          .where(eq(orderAuditLog.id, record.id));
        updated++;
      } else {
        console.warn(
          `[reconcileOrders] exchange error for order ${record.orderId} (record ${record.id}): ${message}`
        );
      }
      continue;
    }

    // Exchange returned a terminal status — update the audit log
    const terminalStatuses = new Set(["filled", "cancelled", "canceled", "expired", "rejected"]);
    if (terminalStatuses.has(exchangeStatus)) {
      stuck++;
      await db
        .update(orderAuditLog)
        .set({
          status: exchangeStatus === "filled" ? "placed" : "cancelled",
          settledAt: new Date(),
        })
        .where(eq(orderAuditLog.id, record.id));
      updated++;
    }
    // If still "open" / "partial" — genuinely still live, leave alone
  }

  console.info(`[reconcileOrders] checked=${candidates.length} stuck=${stuck} updated=${updated}`);

  return { checked: candidates.length, stuck, updated };
}

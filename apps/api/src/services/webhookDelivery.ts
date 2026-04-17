import { createHmac } from "node:crypto";

import { webhooks, type Database } from "@tb/db";
import { and, eq, sql } from "drizzle-orm";
import pino from "pino";

const logger = pino({ name: "webhookDelivery" });

export async function deliverWebhook(db: Database, event: string, payload: object): Promise<void> {
  let rows: (typeof webhooks.$inferSelect)[];
  try {
    rows = await db
      .select()
      .from(webhooks)
      .where(
        and(eq(webhooks.active, true), sql`${webhooks.events} @> ${JSON.stringify([event])}::jsonb`)
      );
  } catch (err) {
    logger.error({ err, event }, "Failed to query webhooks for delivery");
    return;
  }

  if (rows.length === 0) return;

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  for (const webhook of rows) {
    void (async () => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (webhook.secret) {
          const sig = createHmac("sha256", webhook.secret).update(body).digest("hex");
          headers["X-Signature-256"] = `sha256=${sig}`;
        }

        const res = await fetch(webhook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          logger.warn(
            { webhookId: webhook.id, url: webhook.url, event, status: res.status },
            "Webhook delivery returned non-2xx status"
          );
        }
      } catch (err) {
        logger.error(
          { err, webhookId: webhook.id, url: webhook.url, event },
          "Webhook delivery failed"
        );
      }
    })();
  }
}

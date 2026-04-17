import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";

/**
 * Create a typed tRPC client for the trading bot platform API.
 *
 * Pass your `AppRouter` type as the generic parameter:
 *   import type { AppRouter } from "../../apps/api/src/trpc/router";
 *   const client = createClient<AppRouter>("http://localhost:3001");
 */
export function createClient<TRouter extends AnyTRPCRouter>(baseUrl: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link = httpBatchLink({ url: `${baseUrl}/trpc` }) as any;
  return createTRPCClient<TRouter>({ links: [link] });
}

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";

/**
 * Create a typed tRPC client for the trading bot platform API.
 *
 * Pass your `AppRouter` type as the generic parameter:
 *   import type { AppRouter } from "../../apps/api/src/trpc/router";
 *   const client = createClient<AppRouter>("http://localhost:3001");
 *
 * Optionally supply a bearer token for protected procedures:
 *   const client = createClient<AppRouter>("http://localhost:3001", "my-token");
 */
export function createClient<TRouter extends AnyTRPCRouter>(baseUrl: string, authToken?: string) {
  const link = httpBatchLink({
    url: `${baseUrl}/trpc`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  }) as any;
  return createTRPCClient<TRouter>({ links: [link] });
}

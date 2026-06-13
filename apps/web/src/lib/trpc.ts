import { createTRPCReact, httpBatchLink } from "@trpc/react-query";

import type { AppRouter } from "../../../api/src/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_TRPC_URL = "/api/trpc";

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: process.env.NEXT_PUBLIC_TRPC_URL ?? DEFAULT_TRPC_URL,
      }),
    ],
  });
}

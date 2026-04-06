import { createTRPCReact, httpBatchLink } from "@trpc/react-query";

import type { AppRouter } from "../../../api/src/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_API_URL = "http://localhost:3001";

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL}/trpc`,
      }),
    ],
  });
}

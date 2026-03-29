import { initTRPC } from "@trpc/server";

import type { TrpcContext } from "./context.js";

const trpc = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        appCode:
          error.cause && typeof error.cause === "object" && "appCode" in error.cause
            ? String((error.cause as { appCode?: string }).appCode)
            : null,
      },
    };
  },
});

export const createTrpcRouter = trpc.router;
export const publicProcedure = trpc.procedure;
export const createCallerFactory = trpc.createCallerFactory;

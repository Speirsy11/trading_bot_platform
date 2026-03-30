import { initTRPC, TRPCError } from "@trpc/server";

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
export const protectedProcedure = trpc.procedure.use(({ ctx, next }) => {
  const expectedToken = process.env["API_AUTH_TOKEN"]?.trim();
  const expectedTenantId = process.env["API_TENANT_ID"]?.trim();
  const authorization = ctx.req?.headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : undefined;
  const headerToken =
    typeof ctx.req?.headers["x-api-token"] === "string"
      ? ctx.req.headers["x-api-token"].trim()
      : undefined;
  const providedToken = bearerToken || headerToken;

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  if (expectedTenantId && ctx.auth?.tenantId !== expectedTenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid tenant" });
  }

  return next();
});
export const createCallerFactory = trpc.createCallerFactory;

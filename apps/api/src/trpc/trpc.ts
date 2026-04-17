import { initTRPC, TRPCError } from "@trpc/server";

import type { TrpcContext } from "./context";

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

const loggingMiddleware = trpc.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  ctx.logger.info({ requestId: ctx.requestId, path, type, durationMs, ok: result.ok }, "trpc");
  return result;
});

export const createTrpcRouter = trpc.router;
export const loggedProcedure = trpc.procedure.use(loggingMiddleware);
export const publicProcedure = loggedProcedure;
export const protectedProcedure = loggedProcedure.use(({ ctx, next }) => {
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

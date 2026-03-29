import { backtestRouter } from "./routers/backtest.js";
import { botsRouter } from "./routers/bots.js";
import { dataExportRouter } from "./routers/dataExport.js";
import { exchangesRouter } from "./routers/exchanges.js";
import { marketRouter } from "./routers/market.js";
import { portfolioRouter } from "./routers/portfolio.js";
import { createTrpcRouter, createCallerFactory } from "./trpc.js";

export const appRouter = createTrpcRouter({
  portfolio: portfolioRouter,
  bots: botsRouter,
  backtest: backtestRouter,
  market: marketRouter,
  exchanges: exchangesRouter,
  dataExport: dataExportRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;

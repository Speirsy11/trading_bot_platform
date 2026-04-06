import { backtestRouter } from "./routers/backtest";
import { botsRouter } from "./routers/bots";
import { dataCollectionRouter } from "./routers/dataCollection";
import { dataExportRouter } from "./routers/dataExport";
import { exchangesRouter } from "./routers/exchanges";
import { marketRouter } from "./routers/market";
import { portfolioRouter } from "./routers/portfolio";
import { createTrpcRouter, createCallerFactory } from "./trpc";

export const appRouter = createTrpcRouter({
  portfolio: portfolioRouter,
  bots: botsRouter,
  backtest: backtestRouter,
  market: marketRouter,
  exchanges: exchangesRouter,
  dataExport: dataExportRouter,
  dataCollection: dataCollectionRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;

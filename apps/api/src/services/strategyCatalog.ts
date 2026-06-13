import {
  BollingerBounce,
  BollingerLongBounce,
  DonchianBreakout,
  EMAATRTrend,
  type IStrategy,
  RSIMeanReversion,
  SentimentAwareSMACrossover,
  SMACrossover,
  StrategyRegistry,
} from "@tb/trading-core";
import { z } from "zod";

type StrategyFactory = () => IStrategy;
type StrategyVisibility = "launchable" | "legacy";
type StrategyMarketMode = "spot" | "margin";

type StrategyCatalogDefinition = {
  factory: StrategyFactory;
  visibility: StrategyVisibility;
  marketMode: StrategyMarketMode;
  researchBacked: boolean;
};

export type StrategyCatalogOptions = {
  includeLegacy?: boolean;
};

const STRATEGIES: Record<string, StrategyCatalogDefinition> = {
  "sma-crossover": {
    factory: () => new SMACrossover(),
    visibility: "launchable",
    marketMode: "spot",
    researchBacked: true,
  },
  "sentiment-aware-sma-crossover": {
    factory: () => new SentimentAwareSMACrossover(),
    visibility: "legacy",
    marketMode: "spot",
    researchBacked: false,
  },
  "rsi-mean-reversion": {
    factory: () => new RSIMeanReversion(),
    visibility: "launchable",
    marketMode: "spot",
    researchBacked: true,
  },
  "bollinger-bounce": {
    factory: () => new BollingerBounce(),
    visibility: "legacy",
    marketMode: "margin",
    researchBacked: false,
  },
  "bollinger-long-bounce": {
    factory: () => new BollingerLongBounce(),
    visibility: "launchable",
    marketMode: "spot",
    researchBacked: true,
  },
  "donchian-breakout": {
    factory: () => new DonchianBreakout(),
    visibility: "launchable",
    marketMode: "spot",
    researchBacked: true,
  },
  "ema-atr-trend": {
    factory: () => new EMAATRTrend(),
    visibility: "launchable",
    marketMode: "spot",
    researchBacked: true,
  },
};

export function bootstrapStrategies() {
  for (const [key, definition] of Object.entries(STRATEGIES)) {
    if (!StrategyRegistry.has(key)) {
      StrategyRegistry.register(key, definition.factory);
    }
  }
}

export function getStrategyCatalog(options: StrategyCatalogOptions = {}) {
  bootstrapStrategies();

  return Object.entries(STRATEGIES)
    .filter(([, definition]) => options.includeLegacy || definition.visibility === "launchable")
    .map(([key, definition]) => {
      const strategy = definition.factory();
      return {
        key,
        name: strategy.name,
        description: strategy.description,
        visibility: definition.visibility,
        marketMode: definition.marketMode,
        researchBacked: definition.researchBacked,
        params: describeSchema(strategy.paramsSchema),
      };
    });
}

function describeSchema(schema: z.ZodSchema) {
  const objectSchema = unwrapSchema(schema);

  if (objectSchema instanceof z.ZodObject) {
    const shape = objectSchema.shape;

    return Object.entries(shape as Record<string, z.ZodTypeAny>).map(([name, field]) => {
      const unwrapped = unwrapFieldSchema(field);
      const numberMeta = readNumberMeta(unwrapped);

      return {
        name,
        type: unwrapped._def.typeName,
        inputType: inferInputType(unwrapped),
        options: readOptions(unwrapped),
        defaultValue: readDefault(field),
        description: field.description ?? null,
        min: numberMeta.min,
        max: numberMeta.max,
        integer: numberMeta.integer,
      };
    });
  }

  return [];
}

function unwrapSchema(schema: z.ZodSchema): z.ZodSchema {
  if (schema instanceof z.ZodEffects) return unwrapSchema(schema.innerType());
  return schema;
}

function readDefault(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return readDefault(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  if (schema instanceof z.ZodEffects) {
    return readDefault(schema.innerType());
  }

  return null;
}

function unwrapFieldSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapFieldSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return unwrapFieldSchema(schema.removeDefault());
  }

  if (schema instanceof z.ZodEffects) {
    return unwrapFieldSchema(schema.innerType());
  }

  return schema;
}

function inferInputType(schema: z.ZodTypeAny) {
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodEnum || schema instanceof z.ZodNativeEnum) return "select";
  return "text";
}

function readOptions(schema: z.ZodTypeAny): string[] {
  if (schema instanceof z.ZodEnum) return [...schema.options];
  if (schema instanceof z.ZodNativeEnum) {
    return Object.values(schema.enum).filter((value): value is string => typeof value === "string");
  }
  return [];
}

function readNumberMeta(schema: z.ZodTypeAny) {
  if (!(schema instanceof z.ZodNumber)) {
    return { min: null, max: null, integer: false };
  }

  const checks = schema._def.checks as Array<{ kind: string; value?: number }>;
  return {
    min: checks.find((check) => check.kind === "min")?.value ?? null,
    max: checks.find((check) => check.kind === "max")?.value ?? null,
    integer: checks.some((check) => check.kind === "int"),
  };
}

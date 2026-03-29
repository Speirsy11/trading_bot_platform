import { type IStrategy, RSIMeanReversion, SMACrossover, StrategyRegistry } from "@tb/trading-core";
import { z } from "zod";

type StrategyFactory = () => IStrategy;

const STRATEGIES: Record<string, StrategyFactory> = {
  "sma-crossover": () => new SMACrossover(),
  "rsi-mean-reversion": () => new RSIMeanReversion(),
};

export function bootstrapStrategies() {
  for (const [key, factory] of Object.entries(STRATEGIES)) {
    if (!StrategyRegistry.has(key)) {
      StrategyRegistry.register(key, factory);
    }
  }
}

export function getStrategyCatalog() {
  bootstrapStrategies();

  return Object.entries(STRATEGIES).map(([key, factory]) => {
    const strategy = factory();
    return {
      key,
      name: strategy.name,
      description: strategy.description,
      params: describeSchema(strategy.paramsSchema),
    };
  });
}

function describeSchema(schema: z.ZodSchema) {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;

    return Object.entries(shape as Record<string, z.ZodTypeAny>).map(([name, field]) => ({
      name,
      type: field._def.typeName,
      defaultValue: readDefault(field),
      description: field.description ?? null,
    }));
  }

  return [];
}

function readDefault(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  if (schema instanceof z.ZodEffects) {
    return readDefault(schema.innerType());
  }

  return null;
}

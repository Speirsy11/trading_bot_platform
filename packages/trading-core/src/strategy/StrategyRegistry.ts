import type { IStrategy } from "./IStrategy";

type StrategyFactory = () => IStrategy;

/**
 * Registry of available strategies.
 * Strategies are registered by name and can be instantiated.
 */
export class StrategyRegistry {
  private static strategies: Map<string, StrategyFactory> = new Map();

  static register(name: string, factory: StrategyFactory): void {
    StrategyRegistry.strategies.set(name, factory);
  }

  static create(name: string): IStrategy {
    const factory = StrategyRegistry.strategies.get(name);
    if (!factory) {
      throw new Error(
        `Strategy "${name}" not found. Available: ${[...StrategyRegistry.strategies.keys()].join(", ")}`
      );
    }
    return factory();
  }

  static list(): string[] {
    return [...StrategyRegistry.strategies.keys()];
  }

  static has(name: string): boolean {
    return StrategyRegistry.strategies.has(name);
  }

  static clear(): void {
    StrategyRegistry.strategies.clear();
  }
}

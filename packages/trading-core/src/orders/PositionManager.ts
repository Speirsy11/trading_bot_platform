import type { Order } from "@tb/types";

import type { Position, TradeRecord } from "../exchange/types.js";
import { roundTo } from "../utils/decimal.js";

/**
 * Tracks open positions and computes unrealised/realised PnL.
 */
export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private closedTrades: TradeRecord[] = [];
  private tradeCounter = 0;

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  getPositions(): Position[] {
    return [...this.positions.values()];
  }

  getClosedTrades(): TradeRecord[] {
    return [...this.closedTrades];
  }

  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  getPositionCount(): number {
    return this.positions.size;
  }

  /**
   * Process a filled order to update positions.
   */
  processFilledOrder(order: Order): TradeRecord | null {
    if (order.status !== "closed" || order.filled === 0) return null;

    const existing = this.positions.get(order.symbol);

    if (order.side === "buy") {
      if (!existing) {
        // Open new long position
        this.positions.set(order.symbol, {
          symbol: order.symbol,
          side: "long",
          amount: order.filled,
          entryPrice: order.price ?? order.cost / order.filled,
          currentPrice: order.price ?? order.cost / order.filled,
          unrealisedPnl: 0,
          realisedPnl: 0,
          timestamp: order.timestamp,
        });
        return null;
      }

      if (existing.side === "long") {
        // Add to long position (average up/down)
        const newPrice = order.price ?? order.cost / order.filled;
        const totalCost = existing.entryPrice * existing.amount + newPrice * order.filled;
        const totalAmount = existing.amount + order.filled;
        existing.entryPrice = totalCost / totalAmount;
        existing.amount = totalAmount;
        return null;
      }

      // Close short position (or partial)
      return this.closePosition(existing, order);
    }

    // Sell order
    if (!existing) {
      // Open new short position
      this.positions.set(order.symbol, {
        symbol: order.symbol,
        side: "short",
        amount: order.filled,
        entryPrice: order.price ?? order.cost / order.filled,
        currentPrice: order.price ?? order.cost / order.filled,
        unrealisedPnl: 0,
        realisedPnl: 0,
        timestamp: order.timestamp,
      });
      return null;
    }

    if (existing.side === "short") {
      // Add to short position
      const newPrice = order.price ?? order.cost / order.filled;
      const totalCost = existing.entryPrice * existing.amount + newPrice * order.filled;
      const totalAmount = existing.amount + order.filled;
      existing.entryPrice = totalCost / totalAmount;
      existing.amount = totalAmount;
      return null;
    }

    // Close long position
    return this.closePosition(existing, order);
  }

  private closePosition(position: Position, order: Order): TradeRecord {
    const exitPrice = order.price ?? order.cost / order.filled;
    const closedAmount = Math.min(position.amount, order.filled);

    let pnl: number;
    if (position.side === "long") {
      pnl = (exitPrice - position.entryPrice) * closedAmount;
    } else {
      pnl = (position.entryPrice - exitPrice) * closedAmount;
    }

    const fee = order.fee?.cost ?? 0;
    pnl -= fee;

    const trade: TradeRecord = {
      id: `trade-${++this.tradeCounter}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      amount: closedAmount,
      price: exitPrice,
      cost: closedAmount * exitPrice,
      fee,
      pnl: roundTo(pnl, 8),
      entryPrice: position.entryPrice,
      exitPrice,
      timestamp: order.timestamp,
      reason: order.fee?.currency,
    };
    this.closedTrades.push(trade);

    // Update or remove position
    position.amount -= closedAmount;
    position.realisedPnl += pnl;

    if (position.amount <= 1e-10) {
      this.positions.delete(position.symbol);
    }

    return trade;
  }

  /**
   * Update unrealised PnL based on current price.
   */
  updatePrice(symbol: string, currentPrice: number): void {
    const pos = this.positions.get(symbol);
    if (!pos) return;
    pos.currentPrice = currentPrice;
    if (pos.side === "long") {
      pos.unrealisedPnl = (currentPrice - pos.entryPrice) * pos.amount;
    } else {
      pos.unrealisedPnl = (pos.entryPrice - currentPrice) * pos.amount;
    }
  }

  reset(): void {
    this.positions.clear();
    this.closedTrades = [];
    this.tradeCounter = 0;
  }
}

import type { Candle, Order, OrderSide } from "@tb/types";

import type { FeeConfig, SlippageConfig } from "../exchange/types.js";

export interface FillResult {
  filled: boolean;
  fillPrice: number;
  fee: number;
  feeRate: number;
}

/**
 * Simulates order fills against candle data.
 * Used by BacktestExchange to process pending orders.
 */
export class OrderSimulator {
  private fees: FeeConfig;
  private slippage: SlippageConfig;

  constructor(
    fees: FeeConfig = { maker: 0.001, taker: 0.001 },
    slippage: SlippageConfig = { enabled: true, percentage: 0.0005 }
  ) {
    this.fees = fees;
    this.slippage = slippage;
  }

  /**
   * Check if an order would fill against a given candle.
   */
  simulate(order: Order, candle: Candle, stopPrice?: number): FillResult {
    let filled = false;
    let fillPrice = 0;
    let feeRate = this.fees.taker;

    if (order.type === "market") {
      fillPrice = candle.open;
      feeRate = this.fees.taker;
      filled = true;
    } else if (order.type === "limit") {
      feeRate = this.fees.maker;
      if (order.side === "buy" && candle.low <= (order.price ?? 0)) {
        fillPrice = order.price ?? candle.open;
        filled = true;
      } else if (order.side === "sell" && candle.high >= (order.price ?? 0)) {
        fillPrice = order.price ?? candle.open;
        filled = true;
      }
    } else if (order.type === "stop" || order.type === "stop_limit") {
      const triggerPrice = stopPrice ?? order.price ?? 0;
      if (order.side === "sell" && candle.low <= triggerPrice) {
        fillPrice = triggerPrice;
        feeRate = this.fees.taker;
        filled = true;
      } else if (order.side === "buy" && candle.high >= triggerPrice) {
        fillPrice = triggerPrice;
        feeRate = this.fees.taker;
        filled = true;
      }
    }

    if (filled) {
      fillPrice = this.applySlippage(fillPrice, order.side);
    }

    const cost = order.amount * fillPrice;
    const fee = cost * feeRate;

    return { filled, fillPrice, fee, feeRate };
  }

  private applySlippage(price: number, side: OrderSide): number {
    if (!this.slippage.enabled) return price;
    const slippageAmount = price * this.slippage.percentage;
    return side === "buy" ? price + slippageAmount : price - slippageAmount;
  }
}

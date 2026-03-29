import type { Order } from "@tb/types";

/**
 * Tracks order lifecycle: open, filled, cancelled, rejected.
 */
export class OrderManager {
  private openOrders: Map<string, Order> = new Map();
  private closedOrders: Order[] = [];

  addOrder(order: Order): void {
    if (order.status === "open") {
      this.openOrders.set(order.id, order);
    } else {
      this.closedOrders.push(order);
    }
  }

  updateOrder(order: Order): void {
    if (order.status === "open") {
      this.openOrders.set(order.id, order);
    } else {
      this.openOrders.delete(order.id);
      this.closedOrders.push(order);
    }
  }

  getOpenOrders(): Order[] {
    return [...this.openOrders.values()];
  }

  getClosedOrders(): Order[] {
    return [...this.closedOrders];
  }

  getOrder(orderId: string): Order | undefined {
    return this.openOrders.get(orderId) ?? this.closedOrders.find((o) => o.id === orderId);
  }

  cancelOrder(orderId: string): boolean {
    const order = this.openOrders.get(orderId);
    if (!order) return false;
    order.status = "canceled";
    this.openOrders.delete(orderId);
    this.closedOrders.push(order);
    return true;
  }

  getOpenOrderCount(): number {
    return this.openOrders.size;
  }

  reset(): void {
    this.openOrders.clear();
    this.closedOrders = [];
  }
}

export function getMaxNotionalUSD(): number {
  const val = Number(process.env.MAX_NOTIONAL_USD);
  return isNaN(val) || val <= 0 ? 10_000 : val; // default $10k
}

export function checkNotionalCap(amount: number, price: number | undefined, type: string): void {
  if (type === "limit" && price !== undefined) {
    const notional = amount * price;
    const cap = getMaxNotionalUSD();
    if (notional > cap) {
      throw new Error(
        `Order notional $${notional.toFixed(2)} exceeds MAX_NOTIONAL_USD cap $${cap}`
      );
    }
  }
  // For market orders, we can't check without a price — that's LT-5 territory.
}

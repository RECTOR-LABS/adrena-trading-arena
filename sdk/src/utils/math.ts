export function bpsToDecimal(bps: number): number {
  return bps / 10_000;
}

export function decimalToBps(decimal: number): number {
  return Math.round(decimal * 10_000);
}

export function applySlippage(price: number, slippageBps: number, side: 'buy' | 'sell'): number {
  const slippage = bpsToDecimal(slippageBps);
  return side === 'buy' ? price * (1 + slippage) : price * (1 - slippage);
}

export function calcPnlPct(entryPrice: number, currentPrice: number, side: 'long' | 'short'): number {
  if (side === 'long') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  }
  return ((entryPrice - currentPrice) / entryPrice) * 100;
}

export function calcLeverage(positionSize: number, collateral: number): number {
  if (collateral === 0) return 0;
  return positionSize / collateral;
}

import { PublicKey } from '@solana/web3.js';
import type { Signal, RiskParams, MarketState } from '../types';
import type { AdrenaTrader, PositionInfo } from '../client/adrena-wrapper';
import { calcPnlPct } from '../utils/math';

export interface TradeResult {
  action: 'opened_long' | 'opened_short' | 'closed_long' | 'closed_short' | 'hold' | 'blocked';
  txSig?: string;
  reason?: string;
}

export class PositionManager {
  constructor(
    private trader: AdrenaTrader,
    private riskParams: RiskParams,
    private capital: number,
  ) {}

  /**
   * Evaluate a signal against risk parameters and execute the appropriate trade.
   *
   * @param signal - The strategy's recommended action
   * @param market - Current market state
   * @param currentPosition - The agent's current open position (if any)
   * @param owner - The agent owner's public key (for trade params)
   * @param custody - The custody account public key
   */
  async executeSignal(
    signal: Signal,
    market: MarketState,
    currentPosition: PositionInfo | null,
    owner: PublicKey,
    custody: PublicKey,
  ): Promise<TradeResult> {
    // Risk checks always take priority — stop-loss / take-profit regardless of signal
    if (currentPosition) {
      if (this.shouldStopLoss(currentPosition, market.price)) {
        return this.closePosition(currentPosition, market.price);
      }
      if (this.shouldTakeProfit(currentPosition, market.price)) {
        return this.closePosition(currentPosition, market.price);
      }
    }

    if (signal === 'HOLD') {
      return { action: 'hold', reason: 'Strategy returned HOLD' };
    }

    if (signal === 'CLOSE') {
      if (!currentPosition) {
        return { action: 'hold', reason: 'CLOSE signal but no open position' };
      }
      return this.closePosition(currentPosition, market.price);
    }

    // LONG or SHORT signal — close existing position first if opposite side
    if (currentPosition) {
      if (
        (signal === 'LONG' && currentPosition.side === 'short') ||
        (signal === 'SHORT' && currentPosition.side === 'long')
      ) {
        await this.closePosition(currentPosition, market.price);
      } else {
        // Already in same direction — hold
        return { action: 'hold', reason: `Already in ${currentPosition.side} position` };
      }
    }

    // Open new position
    const positionSize = this.calcPositionSize(market.price);
    if (positionSize <= 0) {
      return { action: 'blocked', reason: 'Position size too small' };
    }

    const tradeOwner = owner;
    const tradeCustody = custody;
    const leverage = this.riskParams.maxLeverage;
    const slippageBps = 50; // 0.5% default slippage tolerance

    const params = {
      owner: tradeOwner,
      mint: tradeCustody,
      collateral: positionSize,
      leverage,
      price: market.price,
      slippageBps,
    };

    if (signal === 'LONG') {
      const txSig = await this.trader.openLong(params);
      return { action: 'opened_long', txSig };
    }

    const txSig = await this.trader.openShort(params);
    return { action: 'opened_short', txSig };
  }

  /**
   * Returns true if the position's unrealized loss exceeds the stop-loss threshold.
   */
  shouldStopLoss(position: PositionInfo, currentPrice: number): boolean {
    const pnlPct = calcPnlPct(position.entryPrice, currentPrice, position.side);
    return pnlPct <= -this.riskParams.stopLossPct;
  }

  /**
   * Returns true if the position's unrealized profit exceeds the take-profit threshold.
   */
  shouldTakeProfit(position: PositionInfo, currentPrice: number): boolean {
    const pnlPct = calcPnlPct(position.entryPrice, currentPrice, position.side);
    return pnlPct >= this.riskParams.takeProfitPct;
  }

  /**
   * Calculate position size in USD based on capital and risk params.
   * Respects maxPositionPct (max % of capital per position).
   */
  calcPositionSize(price: number): number {
    if (price <= 0 || this.capital <= 0) return 0;
    const maxAllocation = this.capital * (this.riskParams.maxPositionPct / 100);
    return maxAllocation;
  }

  /** Update the capital amount (e.g., after PnL realization). */
  setCapital(capital: number): void {
    if (capital < 0) throw new Error('Capital cannot be negative');
    this.capital = capital;
  }

  getCapital(): number {
    return this.capital;
  }

  private async closePosition(position: PositionInfo, currentPrice: number): Promise<TradeResult> {
    const params = {
      owner: position.owner,
      mint: position.custody,
      price: currentPrice,
      slippageBps: 50,
    };

    if (position.side === 'long') {
      const txSig = await this.trader.closeLong(params);
      return { action: 'closed_long', txSig };
    }

    const txSig = await this.trader.closeShort(params);
    return { action: 'closed_short', txSig };
  }
}

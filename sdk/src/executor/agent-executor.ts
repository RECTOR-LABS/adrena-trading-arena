import { PublicKey } from '@solana/web3.js';
import type { ArenaStrategy, Signal } from '../types';
import type { AdrenaTrader } from '../client/adrena-wrapper';
import type { PriceFeed } from '../market/price-feed';
import { PositionManager, type TradeResult } from './position-manager';

export interface TickResult {
  signal: Signal;
  trade: TradeResult;
  price: number;
  timestamp: number;
}

export interface ExecutorStats {
  totalTicks: number;
  totalTrades: number;
  longs: number;
  shorts: number;
  closes: number;
  holds: number;
  errors: number;
  lastError: string | null;
  lastTickAt: number | null;
  startedAt: number | null;
}

export interface AgentExecutorConfig {
  strategy: ArenaStrategy;
  trader: AdrenaTrader;
  priceFeed: PriceFeed;
  capital: number;
  tickIntervalMs: number;
  owner: PublicKey;
  mint: PublicKey;
  custody: PublicKey;
  /** Symbol for the price feed (e.g., 'SOL/USD'). */
  symbol?: string;
  /** Number of historical prices to fetch for strategy evaluation. */
  lookback?: number;
  /** Optional error callback for tick failures. */
  onError?: (error: unknown) => void;
}

export class AgentExecutor {
  private strategy: ArenaStrategy;
  private trader: AdrenaTrader;
  private priceFeed: PriceFeed;
  private positionManager: PositionManager;
  private tickIntervalMs: number;
  private owner: PublicKey;
  private mint: PublicKey;
  private custody: PublicKey;
  private symbol: string;
  private lookback: number;
  private onError?: (error: unknown) => void;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private stats: ExecutorStats = {
    totalTicks: 0,
    totalTrades: 0,
    longs: 0,
    shorts: 0,
    closes: 0,
    holds: 0,
    errors: 0,
    lastError: null,
    lastTickAt: null,
    startedAt: null,
  };

  constructor(config: AgentExecutorConfig) {
    this.strategy = config.strategy;
    this.trader = config.trader;
    this.priceFeed = config.priceFeed;
    this.tickIntervalMs = config.tickIntervalMs;
    this.owner = config.owner;
    this.mint = config.mint;
    this.custody = config.custody;
    this.symbol = config.symbol ?? 'SOL/USD';
    this.lookback = config.lookback ?? 50;
    this.onError = config.onError;

    this.positionManager = new PositionManager(
      config.trader,
      config.strategy.riskParams,
      config.capital,
    );
  }

  /**
   * Execute a single tick: fetch market data, evaluate strategy, execute trade.
   */
  async tick(): Promise<TickResult> {
    const market = await this.priceFeed.getMarketState(this.symbol, this.lookback);
    const signal = this.strategy.evaluate(market);

    const currentPosition = await this.trader.getPosition(this.owner, this.custody);

    const trade = await this.positionManager.executeSignal(
      signal,
      market,
      currentPosition,
      this.owner,
      this.custody,
    );

    // Update stats
    this.stats.totalTicks++;
    this.stats.lastTickAt = Date.now();
    this.updateTradeStats(trade);

    return {
      signal,
      trade,
      price: market.price,
      timestamp: Date.now(),
    };
  }

  /**
   * Start the interval-based tick loop.
   * Throws if already running.
   */
  start(): void {
    if (this.intervalId !== null) {
      throw new Error('AgentExecutor is already running');
    }

    this.stats.startedAt = Date.now();
    this.intervalId = setInterval(() => {
      this.tick().catch((err: unknown) => {
        this.stats.errors++;
        this.stats.lastError = err instanceof Error ? err.message : String(err);
        this.onError?.(err);
      });
    }, this.tickIntervalMs);
  }

  /**
   * Stop the tick loop.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Returns a snapshot of the executor's statistics.
   */
  getStats(): ExecutorStats {
    return { ...this.stats };
  }

  /**
   * Whether the executor is currently running.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private updateTradeStats(trade: TradeResult): void {
    switch (trade.action) {
      case 'opened_long':
        this.stats.totalTrades++;
        this.stats.longs++;
        break;
      case 'opened_short':
        this.stats.totalTrades++;
        this.stats.shorts++;
        break;
      case 'closed_long':
      case 'closed_short':
        this.stats.totalTrades++;
        this.stats.closes++;
        break;
      case 'hold':
      case 'blocked':
        this.stats.holds++;
        break;
    }
  }
}

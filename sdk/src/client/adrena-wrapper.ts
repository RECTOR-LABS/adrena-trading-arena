import { PublicKey } from '@solana/web3.js';

export interface TradeParams {
  owner: PublicKey;
  mint: PublicKey;
  collateral: number;
  leverage: number;
  price: number;
  slippageBps: number;
}

export interface CloseParams {
  owner: PublicKey;
  mint: PublicKey;
  price: number;
  slippageBps: number;
}

export interface PositionInfo {
  owner: PublicKey;
  custody: PublicKey;
  side: 'long' | 'short';
  sizeUsd: number;
  collateralUsd: number;
  entryPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  openedAt: number;
}

export interface AdrenaTrader {
  openLong(params: TradeParams): Promise<string>;
  openShort(params: TradeParams): Promise<string>;
  closeLong(params: CloseParams): Promise<string>;
  closeShort(params: CloseParams): Promise<string>;
  getPosition(owner: PublicKey, custody: PublicKey): Promise<PositionInfo | null>;
}

/**
 * In-memory mock implementation of AdrenaTrader for testing.
 * Tracks positions and generates deterministic tx signatures.
 */
export class MockAdrenaTrader implements AdrenaTrader {
  private positions: Map<string, PositionInfo> = new Map();
  private txCounter = 0;
  readonly executedTrades: Array<{ method: string; params: TradeParams | CloseParams }> = [];

  private positionKey(owner: PublicKey, custody: PublicKey): string {
    return `${owner.toBase58()}:${custody.toBase58()}`;
  }

  private nextTxSig(): string {
    this.txCounter++;
    return `mock-tx-${this.txCounter}`;
  }

  /** Inject a position directly for testing scenarios. */
  setPosition(owner: PublicKey, custody: PublicKey, position: PositionInfo | null): void {
    const key = this.positionKey(owner, custody);
    if (position === null) {
      this.positions.delete(key);
    } else {
      this.positions.set(key, position);
    }
  }

  async openLong(params: TradeParams): Promise<string> {
    const sig = this.nextTxSig();
    this.executedTrades.push({ method: 'openLong', params });

    const sizeUsd = params.collateral * params.leverage;
    const liqDistance = params.price / params.leverage;

    const custody = params.mint; // use mint as custody proxy in mock
    const key = this.positionKey(params.owner, custody);
    this.positions.set(key, {
      owner: params.owner,
      custody,
      side: 'long',
      sizeUsd,
      collateralUsd: params.collateral,
      entryPrice: params.price,
      liquidationPrice: params.price - liqDistance,
      unrealizedPnl: 0,
      openedAt: Date.now(),
    });

    return sig;
  }

  async openShort(params: TradeParams): Promise<string> {
    const sig = this.nextTxSig();
    this.executedTrades.push({ method: 'openShort', params });

    const sizeUsd = params.collateral * params.leverage;
    const liqDistance = params.price / params.leverage;

    const custody = params.mint;
    const key = this.positionKey(params.owner, custody);
    this.positions.set(key, {
      owner: params.owner,
      custody,
      side: 'short',
      sizeUsd,
      collateralUsd: params.collateral,
      entryPrice: params.price,
      liquidationPrice: params.price + liqDistance,
      unrealizedPnl: 0,
      openedAt: Date.now(),
    });

    return sig;
  }

  async closeLong(params: CloseParams): Promise<string> {
    const sig = this.nextTxSig();
    this.executedTrades.push({ method: 'closeLong', params });

    const custody = params.mint;
    const key = this.positionKey(params.owner, custody);
    this.positions.delete(key);

    return sig;
  }

  async closeShort(params: CloseParams): Promise<string> {
    const sig = this.nextTxSig();
    this.executedTrades.push({ method: 'closeShort', params });

    const custody = params.mint;
    const key = this.positionKey(params.owner, custody);
    this.positions.delete(key);

    return sig;
  }

  async getPosition(owner: PublicKey, custody: PublicKey): Promise<PositionInfo | null> {
    const key = this.positionKey(owner, custody);
    return this.positions.get(key) ?? null;
  }
}

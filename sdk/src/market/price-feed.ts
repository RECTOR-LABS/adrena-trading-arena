import type { MarketState } from '../types';

export interface PriceFeed {
  getPrice(symbol: string): Promise<number>;
  getMarketState(symbol: string, lookback: number): Promise<MarketState>;
}

// Well-known Pyth Hermes price feed IDs for common assets
const PYTH_FEED_IDS: Record<string, string> = {
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
};

interface HermesPrice {
  price: { price: string; expo: number };
}

interface HermesResponse {
  parsed: HermesPrice[];
}

/**
 * Fetches real-time prices from Pyth Hermes REST API.
 * See: https://hermes.pyth.network/docs
 */
export class HermesPriceFeed implements PriceFeed {
  private endpoint: string;
  private priceHistory: Map<string, Array<{ price: number; timestamp: number }>> = new Map();

  constructor(endpoint = 'https://hermes.pyth.network') {
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  private async fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
    }
    throw new Error(`Hermes API failed after ${maxRetries} retries`);
  }

  async getPrice(symbol: string): Promise<number> {
    const feedId = PYTH_FEED_IDS[symbol];
    if (!feedId) {
      throw new Error(`Unknown symbol: ${symbol}. Known symbols: ${Object.keys(PYTH_FEED_IDS).join(', ')}`);
    }

    const url = `${this.endpoint}/v2/updates/price/latest?ids[]=${feedId}`;
    const res = await this.fetchWithRetry(url);

    const data = (await res.json()) as HermesResponse;
    if (!data.parsed?.length) {
      throw new Error(`No price data returned for ${symbol}`);
    }

    const priceData = data.parsed[0].price;
    const price = Number(priceData.price) * Math.pow(10, priceData.expo);

    // Track history for getMarketState
    const history = this.priceHistory.get(symbol) ?? [];
    history.push({ price, timestamp: Date.now() });
    // Keep last 1000 data points
    if (history.length > 1000) history.splice(0, history.length - 1000);
    this.priceHistory.set(symbol, history);

    return price;
  }

  async getMarketState(symbol: string, lookback: number): Promise<MarketState> {
    // Fetch current price (also adds to history)
    const currentPrice = await this.getPrice(symbol);
    const history = this.priceHistory.get(symbol) ?? [{ price: currentPrice, timestamp: Date.now() }];

    const recentHistory = history.slice(-lookback);
    const prices = recentHistory.map((h) => h.price);

    const highRecent = Math.max(...prices);
    const lowRecent = Math.min(...prices);

    return {
      symbol,
      price: currentPrice,
      prices,
      volumes: prices.map(() => 0), // Hermes doesn't provide volume
      highRecent,
      lowRecent,
      volume24h: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * Mock price feed for testing. Returns configurable prices.
 */
export class MockPriceFeed implements PriceFeed {
  private prices: Map<string, number> = new Map();
  private priceSequences: Map<string, number[]> = new Map();
  private callCounts: Map<string, number> = new Map();

  /**
   * Set a fixed price for a symbol.
   */
  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price);
  }

  /**
   * Set a sequence of prices. Each call to getPrice returns the next value.
   * After exhausting the sequence, the last price is repeated.
   */
  setPriceSequence(symbol: string, sequence: number[]): void {
    if (sequence.length === 0) {
      throw new Error('Price sequence must not be empty');
    }
    this.priceSequences.set(symbol, sequence);
    this.callCounts.set(symbol, 0);
  }

  async getPrice(symbol: string): Promise<number> {
    // Sequence takes priority over fixed price
    const sequence = this.priceSequences.get(symbol);
    if (sequence) {
      const count = this.callCounts.get(symbol) ?? 0;
      const idx = Math.min(count, sequence.length - 1);
      this.callCounts.set(symbol, count + 1);
      return sequence[idx];
    }

    const fixed = this.prices.get(symbol);
    if (fixed === undefined) {
      throw new Error(`MockPriceFeed: no price configured for ${symbol}`);
    }
    return fixed;
  }

  async getMarketState(symbol: string, lookback: number): Promise<MarketState> {
    const currentPrice = await this.getPrice(symbol);

    // Generate synthetic history centered around current price
    const sequence = this.priceSequences.get(symbol);
    let prices: number[];

    if (sequence) {
      const count = this.callCounts.get(symbol) ?? 0;
      // Use the portion of the sequence we've already consumed
      const end = Math.min(count, sequence.length);
      const start = Math.max(0, end - lookback);
      prices = sequence.slice(start, end);
      if (prices.length === 0) prices = [currentPrice];
    } else {
      // For fixed price, generate flat history
      prices = Array(lookback).fill(currentPrice);
    }

    return {
      symbol,
      price: currentPrice,
      prices,
      volumes: prices.map(() => 1000),
      highRecent: Math.max(...prices),
      lowRecent: Math.min(...prices),
      volume24h: 100_000,
      timestamp: Date.now(),
    };
  }
}

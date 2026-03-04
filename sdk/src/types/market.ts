export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface MarketState {
  symbol: string;
  price: number;
  prices: number[];       // historical close prices (newest last)
  volumes: number[];      // historical volumes (newest last)
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

/** Calculate standard deviation */
function stdDev(data: number[], mean: number): number {
  const sqDiffs = data.map(v => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / data.length);
}

/** Bollinger Bands */
export function bollinger(data: number[], period: number = 20, multiplier: number = 2): BollingerBands | null {
  if (data.length === 0 || data.some(v => !Number.isFinite(v))) return null;
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;
  const sd = stdDev(slice, middle);
  const upper = middle + multiplier * sd;
  const lower = middle - multiplier * sd;
  return {
    upper,
    middle,
    lower,
    bandwidth: middle === 0 ? 0 : (upper - lower) / middle,
  };
}

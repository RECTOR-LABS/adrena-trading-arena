/** Exponential Moving Average -- latest value */
export function ema(data: number[], period: number): number | null {
  if (data.length === 0 || data.some(v => !Number.isFinite(v))) return null;
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let result = data.slice(0, period).reduce((s, v) => s + v, 0) / period; // SMA seed
  for (let i = period; i < data.length; i++) {
    result = data[i] * k + result * (1 - k);
  }
  return result;
}

/** EMA series */
export function emaSeries(data: number[], period: number): number[] {
  if (data.length === 0 || data.some(v => !Number.isFinite(v))) return [];
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const results: number[] = [];
  let current = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
  results.push(current);
  for (let i = period; i < data.length; i++) {
    current = data[i] * k + current * (1 - k);
    results.push(current);
  }
  return results;
}

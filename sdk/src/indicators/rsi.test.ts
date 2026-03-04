import { describe, it, expect } from 'vitest';
import { rsi } from './rsi';

describe('RSI', () => {
  it('returns null with insufficient data', () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });

  it('returns 100 for continuously rising prices', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(data, 14)).toBe(100);
  });

  it('returns 0 for continuously falling prices', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(data, 14)).toBe(0);
  });

  it('returns ~50 for oscillating prices', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const result = rsi(data, 14)!;
    expect(result).toBeGreaterThan(40);
    expect(result).toBeLessThan(60);
  });

  it('RSI is between 0 and 100', () => {
    const data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
    const result = rsi(data, 14)!;
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

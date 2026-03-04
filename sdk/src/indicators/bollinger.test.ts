import { describe, it, expect } from 'vitest';
import { bollinger } from './bollinger';

describe('Bollinger Bands', () => {
  it('returns null with insufficient data', () => {
    expect(bollinger([1, 2], 3)).toBeNull();
  });

  it('computes bands correctly for constant data', () => {
    const data = Array(20).fill(100);
    const result = bollinger(data, 20, 2)!;
    expect(result.middle).toBe(100);
    expect(result.upper).toBe(100); // no deviation
    expect(result.lower).toBe(100);
    expect(result.bandwidth).toBe(0);
  });

  it('bands widen with volatile data', () => {
    const stable = Array(20).fill(100);
    const volatile = [80, 120, 85, 115, 90, 110, 95, 105, 88, 112, 82, 118, 87, 113, 92, 108, 96, 104, 89, 111];
    const stableResult = bollinger(stable, 20, 2)!;
    const volatileResult = bollinger(volatile, 20, 2)!;
    expect(volatileResult.bandwidth).toBeGreaterThan(stableResult.bandwidth);
  });

  it('upper > middle > lower', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = bollinger(data, 10, 2)!;
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });
});

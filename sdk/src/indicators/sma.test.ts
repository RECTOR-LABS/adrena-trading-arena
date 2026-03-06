import { describe, it, expect } from 'vitest';
import { sma, smaSeries } from './sma';

describe('SMA', () => {
  it('computes simple moving average', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4); // (3+4+5)/3
    expect(sma([10, 20, 30], 3)).toBe(20);
  });

  it('returns null if not enough data', () => {
    expect(sma([1, 2], 3)).toBeNull();
  });

  it('computes SMA series', () => {
    const result = smaSeries([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([2, 3, 4]); // (1+2+3)/3, (2+3+4)/3, (3+4+5)/3
  });
});

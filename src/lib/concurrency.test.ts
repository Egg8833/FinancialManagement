import { describe, it, expect } from 'vitest';
import { forEachWithConcurrency } from './concurrency';

describe('forEachWithConcurrency', () => {
  it('同時執行數不超過上限,且每個項目都處理到', async () => {
    let running = 0, peak = 0;
    const done: number[] = [];
    await forEachWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++; peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 5));
      done.push(n);
      running--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('單一項目拋錯不影響其他項目(錯誤由呼叫端自行處理)', async () => {
    const done: number[] = [];
    await expect(forEachWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('x');
      done.push(n);
    })).rejects.toThrow('x');
    expect(done.sort()).toEqual([1, 3]);
  });
});

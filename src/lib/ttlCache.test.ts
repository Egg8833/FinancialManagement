import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTtlCache } from './ttlCache';

afterEach(() => { vi.useRealTimers(); });

describe('createTtlCache', () => {
  it('TTL 內為 fresh,過期後仍可讀(供 stale fallback)但 fresh=false', () => {
    vi.useFakeTimers();
    const c = createTtlCache<number>({ maxEntries: 10, ttlMs: 1000 });
    c.set('a', 1);
    expect(c.get('a')).toEqual({ value: 1, fresh: true });
    vi.advanceTimersByTime(1001);
    expect(c.get('a')).toEqual({ value: 1, fresh: false });
  });

  it('超過上限時淘汰最久未使用的項目', () => {
    const c = createTtlCache<number>({ maxEntries: 2, ttlMs: 1000 });
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');          // a 變成最近使用
    c.set('c', 3);       // 應淘汰 b
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')?.value).toBe(1);
    expect(c.get('c')?.value).toBe(3);
    expect(c.size()).toBe(2);
  });
});

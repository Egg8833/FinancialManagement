import { describe, it, expect } from 'vitest';
import { mergeSnapshot } from './snapshotMerge';
import type { AssetSnapshot } from '../types';

const snap = (id: string, date: string): AssetSnapshot =>
  ({ id, date, totalAssets: 1, totalLiabilities: 0, netWorth: 1 });

describe('mergeSnapshot', () => {
  it('附加新日期快照', () => {
    const out = mergeSnapshot([snap('1', '2026-07-17')], snap('2', '2026-07-18'));
    expect(out.map(s => s.id)).toEqual(['1', '2']);
  });

  it('同日期取代舊快照', () => {
    const out = mergeSnapshot([snap('1', '2026-07-18')], snap('2', '2026-07-18'));
    expect(out.map(s => s.id)).toEqual(['2']);
  });

  it('最多保留 365 筆(含新快照)', () => {
    const many = Array.from({ length: 400 }, (_, i) => snap(String(i), `d${i}`));
    const out = mergeSnapshot(many, snap('new', 'today'));
    expect(out).toHaveLength(365);
    expect(out[out.length - 1].id).toBe('new');
  });
});

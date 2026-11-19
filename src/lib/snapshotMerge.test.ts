import { describe, it, expect } from 'vitest';
import { mergeSnapshot, planSnapshotSave, persistSnapshotSave } from './snapshotMerge';
import type { EntityRepository } from '../repositories/types';
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

describe('planSnapshotSave', () => {
  it('新日期:只新增,不刪除任何舊快照', () => {
    const plan = planSnapshotSave([snap('1', '2026-07-17')], snap('2', '2026-07-18'));
    expect(plan.next.map(s => s.id)).toEqual(['1', '2']);
    expect(plan.removeIds).toEqual([]);
  });

  it('同日期:刪除同日舊快照', () => {
    const plan = planSnapshotSave([snap('1', '2026-07-17'), snap('2', '2026-07-18')], snap('3', '2026-07-18'));
    expect(plan.next.map(s => s.id)).toEqual(['1', '3']);
    expect(plan.removeIds).toEqual(['2']);
  });

  it('超過 365 筆:只刪除被裁掉的最舊快照', () => {
    const many = Array.from({ length: 366 }, (_, i) => snap(String(i), `d${i}`));
    const plan = planSnapshotSave(many, snap('new', 'today'));
    expect(plan.removeIds).toEqual(['0', '1']);
  });
});

function memoryRepo(initial: AssetSnapshot[], opts: { failRemove?: boolean; failCreate?: boolean } = {}) {
  let rows = [...initial];
  const calls: string[] = [];
  const repo: EntityRepository<AssetSnapshot> = {
    async getAll() { return rows; },
    async create(e) { calls.push(`create:${e.id}`); if (opts.failCreate) throw new Error('x'); rows = [...rows, e]; },
    async update() { throw new Error('unused'); },
    async remove(id) { calls.push(`remove:${id}`); if (opts.failRemove) throw new Error('404'); rows = rows.filter(r => r.id !== id); },
    async replaceAll(es) { calls.push('replaceAll'); rows = es; },
  };
  return { repo, calls, rows: () => rows };
}

describe('persistSnapshotSave', () => {
  it('前端狀態過期(空陣列)時,雲端既有快照不會被刪除', async () => {
    const cloud = [snap('a', '2026-01-01'), snap('b', '2026-01-02')];
    const m = memoryRepo(cloud);
    // 模擬 bug 情境:前端以為目前沒有任何快照
    const plan = planSnapshotSave([], snap('new', '2026-01-03'));
    await persistSnapshotSave(m.repo, plan.snap, plan.removeIds);
    expect(m.rows().map(s => s.id)).toEqual(['a', 'b', 'new']);
    expect(m.calls).not.toContain('replaceAll');
  });

  it('先新增再刪除同日舊快照', async () => {
    const m = memoryRepo([snap('old', '2026-01-03')]);
    await persistSnapshotSave(m.repo, snap('new', '2026-01-03'), ['old']);
    expect(m.calls).toEqual(['create:new', 'remove:old']);
    expect(m.rows().map(s => s.id)).toEqual(['new']);
  });

  it('刪除失敗(例如其他裝置已刪)不視為儲存失敗', async () => {
    const m = memoryRepo([snap('old', '2026-01-03')], { failRemove: true });
    await expect(persistSnapshotSave(m.repo, snap('new', '2026-01-03'), ['old'])).resolves.toBeUndefined();
  });

  it('新增失敗則拋錯,且不執行刪除', async () => {
    const m = memoryRepo([snap('old', '2026-01-03')], { failCreate: true });
    await expect(persistSnapshotSave(m.repo, snap('new', '2026-01-03'), ['old'])).rejects.toThrow();
    expect(m.calls).toEqual(['create:new']);
  });
});

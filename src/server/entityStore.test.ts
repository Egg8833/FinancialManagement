import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the auth function so tests can run
vi.mock('../auth', () => ({
  auth: vi.fn(),
}));

import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { assets } from '../db/schema';
import { createEntityStore } from './entityStore';

const store = createEntityStore(assets);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await createTestUser(db, 'userA');
  await createTestUser(db, 'userB');
});

describe('entityStore', () => {
  it('create + getAll 依 position 排序', async () => {
    await store.create(db, 'userA', 'a1', { title: '第一' });
    await store.create(db, 'userA', 'a2', { title: '第二' });
    const rows = await store.getAll(db, 'userA');
    expect(rows.map(r => r.id)).toEqual(['a1', 'a2']);
    expect(rows[0].version).toBe(1);
  });

  it('使用者資料互相隔離', async () => {
    await store.create(db, 'userA', 'a1', { title: 'A的' });
    const rowsB = await store.getAll(db, 'userB');
    expect(rowsB).toHaveLength(0);
  });

  it('id 重複 create 拋 409 duplicate_id', async () => {
    await store.create(db, 'userA', 'a1', {});
    await expect(store.create(db, 'userA', 'a1', {})).rejects.toMatchObject(
      { status: 409, code: 'duplicate_id' });
  });

  it('update 版本相符 → 成功且 version+1', async () => {
    await store.create(db, 'userA', 'a1', { title: '舊' });
    const newVersion = await store.update(db, 'userA', 'a1', { title: '新' }, 1);
    expect(newVersion).toBe(2);
    const rows = await store.getAll(db, 'userA');
    expect((rows[0].data as { title: string }).title).toBe('新');
  });

  it('update 版本不符 → 409 version_conflict,資料不變', async () => {
    await store.create(db, 'userA', 'a1', { title: '舊' });
    await expect(store.update(db, 'userA', 'a1', { title: '新' }, 99)).rejects.toMatchObject(
      { status: 409, code: 'version_conflict' });
    const rows = await store.getAll(db, 'userA');
    expect((rows[0].data as { title: string }).title).toBe('舊');
  });

  it('update / remove 不存在的 id → 404', async () => {
    await expect(store.update(db, 'userA', 'nope', {}, 1)).rejects.toMatchObject({ status: 404 });
    await expect(store.remove(db, 'userA', 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('replaceAll 全刪重建且 version 歸 1', async () => {
    await store.create(db, 'userA', 'old', {});
    await store.replaceAll(db, 'userA', [{ id: 'n1', data: { t: 1 } }, { id: 'n2', data: { t: 2 } }]);
    const rows = await store.getAll(db, 'userA');
    expect(rows.map(r => r.id)).toEqual(['n1', 'n2']);
    expect(rows.every(r => r.version === 1)).toBe(true);
  });

  it('replaceAll 對既有重疊 id 更新資料,並修剪不在新清單中的 id', async () => {
    await store.create(db, 'userA', 'keep', { title: '舊-keep' });
    await store.create(db, 'userA', 'drop', { title: '舊-drop' });
    await store.replaceAll(db, 'userA', [
      { id: 'keep', data: { title: '新-keep' } },
      { id: 'new', data: { title: '新增' } },
    ]);
    const rows = await store.getAll(db, 'userA');
    expect(rows.map(r => r.id)).toEqual(['keep', 'new']);
    expect((rows[0].data as { title: string }).title).toBe('新-keep');
    expect(rows.every(r => r.version === 1)).toBe(true);
  });

  it('hasAny 反映是否有資料', async () => {
    expect(await store.hasAny(db, 'userA')).toBe(false);
    await store.create(db, 'userA', 'a1', {});
    expect(await store.hasAny(db, 'userA')).toBe(true);
  });
});

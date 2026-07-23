import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../auth', () => ({
  auth: vi.fn(),
}));

import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { appStateEntrySchema } from './entitySchemas';

const store = createEntityStore(appState);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await createTestUser(db, 'userA');
});

describe('app_state 表：通用鍵值狀態', () => {
  it('可儲存並讀回陣列、物件、數字、字串、布林等各種形狀的 value', async () => {
    await store.create(db, 'userA', 'loans', { id: 'loans', value: [{ id: 'l1', principal: 800000 }] });
    await store.create(db, 'userA', 'usdToTwd', { id: 'usdToTwd', value: 32 });
    await store.create(db, 'userA', 'reportSchedule', { id: 'reportSchedule', value: 'monthly' });
    await store.create(db, 'userA', 'enablePledgeTracking', { id: 'enablePledgeTracking', value: true });
    await store.create(db, 'userA', 'cashflowTemplate', { id: 'cashflowTemplate', value: { income: [], expense: [] } });

    const rows = await store.getAll(db, 'userA');
    const byId = Object.fromEntries(rows.map(r => [r.id, r.data as { value: unknown }]));

    expect(byId.loans.value).toEqual([{ id: 'l1', principal: 800000 }]);
    expect(byId.usdToTwd.value).toBe(32);
    expect(byId.reportSchedule.value).toBe('monthly');
    expect(byId.enablePledgeTracking.value).toBe(true);
    expect(byId.cashflowTemplate.value).toEqual({ income: [], expense: [] });
  });

  it('沿用樂觀鎖：version 不符時更新失敗', async () => {
    await store.create(db, 'userA', 'goals', { id: 'goals', value: [] });
    await expect(
      store.update(db, 'userA', 'goals', { id: 'goals', value: [{ id: 'g1' }] }, 99)
    ).rejects.toMatchObject({ status: 409, code: 'version_conflict' });
  });

  it('appStateEntrySchema 接受任意 value 形狀，只驗證 id 為字串', () => {
    expect(appStateEntrySchema.safeParse({ id: 'loans', value: [1, 2, 3] }).success).toBe(true);
    expect(appStateEntrySchema.safeParse({ id: 'x', value: null }).success).toBe(true);
    expect(appStateEntrySchema.safeParse({ value: 1 }).success).toBe(false);
  });
});

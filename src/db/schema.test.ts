import { describe, it, expect } from 'vitest';
import { createTestDb, createTestUser } from './testDb';
import { assets } from './schema';
import { eq } from 'drizzle-orm';

describe('db schema', () => {
  it('可寫入並讀回 assets 資料列', async () => {
    const db = await createTestDb();
    await createTestUser(db, 'u1');
    await db.insert(assets).values({ userId: 'u1', id: 'a1', data: { title: '流動資金' }, position: 0 });
    const rows = await db.select().from(assets).where(eq(assets.userId, 'u1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
    expect((rows[0].data as { title: string }).title).toBe('流動資金');
  }, 15000);
});

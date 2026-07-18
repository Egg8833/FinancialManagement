import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { EntityTable } from '../db/schema';
import { ApiError } from './apiHelpers';

export type EntityRow = { id: string; data: unknown; version: number };

export function createEntityStore(table: EntityTable) {
  const byUser = (userId: string) => eq(table.userId, userId);
  const byKey = (userId: string, id: string) => and(byUser(userId), eq(table.id, id));

  return {
    async getAll(db: Db, userId: string): Promise<EntityRow[]> {
      const rows = await db.select().from(table).where(byUser(userId)).orderBy(asc(table.position));
      return rows.map(r => ({ id: r.id, data: r.data, version: r.version }));
    },

    async create(db: Db, userId: string, id: string, data: unknown): Promise<void> {
      const existing = await db.select({ id: table.id }).from(table).where(byKey(userId, id));
      if (existing.length > 0) throw new ApiError(409, 'duplicate_id', '此 id 已存在');
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${table.position}), -1)` })
        .from(table).where(byUser(userId));
      await db.insert(table).values({ userId, id, data, position: Number(max) + 1 });
    },

    async update(db: Db, userId: string, id: string, data: unknown, version: number): Promise<number> {
      const updated = await db.update(table)
        .set({ data, version: version + 1, updatedAt: new Date() })
        .where(and(byKey(userId, id), eq(table.version, version)))
        .returning({ version: table.version });
      if (updated.length > 0) return updated[0].version;
      const exists = await db.select({ id: table.id }).from(table).where(byKey(userId, id));
      if (exists.length === 0) throw new ApiError(404, 'not_found', '資料不存在');
      throw new ApiError(409, 'version_conflict', '資料已在其他裝置修改');
    },

    async remove(db: Db, userId: string, id: string): Promise<void> {
      const deleted = await db.delete(table).where(byKey(userId, id)).returning({ id: table.id });
      if (deleted.length === 0) throw new ApiError(404, 'not_found', '資料不存在');
    },

    async replaceAll(db: Db, userId: string, rows: { id: string; data: unknown }[]): Promise<void> {
      await db.delete(table).where(byUser(userId));
      if (rows.length > 0) {
        await db.insert(table).values(rows.map((r, i) => ({
          userId, id: r.id, data: r.data, position: i,
        })));
      }
    },

    async hasAny(db: Db, userId: string): Promise<boolean> {
      const rows = await db.select({ id: table.id }).from(table).where(byUser(userId)).limit(1);
      return rows.length > 0;
    },
  };
}

export type EntityStore = ReturnType<typeof createEntityStore>;

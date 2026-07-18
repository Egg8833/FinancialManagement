import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import type { Db } from './client';

export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return db as unknown as Db;
}

export async function createTestUser(db: Db, id: string): Promise<void> {
  await db.insert(schema.users).values({ id, email: `${id}@test.local` });
}

import {
  pgTable, text, integer, jsonb, timestamp, primaryKey,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

// ── Auth.js 標準表(Drizzle Adapter)─────────────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
});

export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccountType>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

// ── 使用者資料表(共同形狀)────────────────────────────────────
function entityColumns() {
  return {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    data: jsonb('data').notNull(),
    version: integer('version').notNull().default(1),
    position: integer('position').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  };
}

export const assets = pgTable('assets', entityColumns(),
  (t) => [primaryKey({ columns: [t.userId, t.id] })]);
export const liabilities = pgTable('liabilities', entityColumns(),
  (t) => [primaryKey({ columns: [t.userId, t.id] })]);
export const snapshots = pgTable('snapshots', entityColumns(),
  (t) => [primaryKey({ columns: [t.userId, t.id] })]);

// 通用鍵值狀態表：id 為設定鍵名（如 'loans'、'fireSettings'），data 為任意形狀的 jsonb 值。
// 涵蓋所有「整包替換」語意的本地網域（貸款、股票、現金流、目標、FIRE 設定等），
// 不再需要為每個網域各自建表，重用同一套 entityStore/entityHandlers。
export const appState = pgTable('app_state', entityColumns(),
  (t) => [primaryKey({ columns: [t.userId, t.id] })]);

export type EntityTable = typeof assets | typeof liabilities | typeof snapshots | typeof appState;

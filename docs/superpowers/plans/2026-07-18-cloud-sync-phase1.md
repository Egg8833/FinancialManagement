# 雲端同步 Phase 1 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google 登入 + Neon Postgres 後端,資產/負債/快照三領域雲端 CRUD 同步,訪客模式行為完全不變。

**Architecture:** Auth.js(JWT session)保護 `/api/user/*` Route Handlers;每領域一張 jsonb 表(樂觀鎖 version);前端以 `EntityRepository` 介面隔離 local(localStorage)與 remote(fetch)實作,`AssetContext` 改為領域操作 + 樂觀更新。

**Tech Stack:** Next.js 15 App Router、next-auth@beta(v5)、@auth/drizzle-adapter、drizzle-orm、@neondatabase/serverless、zod、Vitest、@electric-sql/pglite(測試用 in-memory Postgres)。

**Spec:** `docs/superpowers/specs/2026-07-18-cloud-sync-design.md`

## Global Constraints

- UI 文案一律繁體中文。
- import 使用相對路徑(專案慣例,無 path alias)。
- userId 一律取自 session,API 不接受 client 傳入 userId。
- 訪客(未登入)模式行為與現狀完全相同:同步讀 localStorage、無 loading 畫面。
- 錯誤回應格式統一 `{ error: { code, message } }`;狀態碼 401/404/409/422/500。
- 測試用 Vitest(`npm test`);既有測試不得破壞。
- 每張使用者資料表欄位:`user_id, id, data(jsonb), version, position, updated_at`,PK `(user_id, id)`。
- commit 訊息格式沿用現有慣例(`feat:`/`fix:`/`docs:` + 繁中描述)。

## 前置作業(使用者手動,不在任務內)

1. Vercel Marketplace 建立 Neon Postgres,取得 `DATABASE_URL`。
2. Google Cloud Console 建立 OAuth 2.0 Client(Web):
   - Authorized redirect URIs:`http://localhost:3000/api/auth/callback/google` 與 `https://<production-domain>/api/auth/callback/google`
3. 在 `.env.local` 填入四個變數(見 Task 1 的 `.env.example`)。`AUTH_SECRET` 用 `npx auth secret` 產生。

---

### Task 1: 依賴安裝與環境設定

**Files:**
- Modify: `package.json`(經 npm install)
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 後續任務可 import `drizzle-orm`、`next-auth` 等;`drizzle-kit` CLI 可用。

- [ ] **Step 1: 安裝依賴**

```bash
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm @neondatabase/serverless zod
npm install -D drizzle-kit @electric-sql/pglite
```

- [ ] **Step 2: 建立 drizzle.config.ts**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: 建立 .env.example**

```
# Neon Postgres(Vercel Marketplace 取得)
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
# npx auth secret 產生
AUTH_SECRET=
# Google Cloud Console OAuth 2.0 Client
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

- [ ] **Step 4: .gitignore 加入環境檔**

在 `.gitignore` 確認/加入(若已有 `.env*` 相關規則則跳過):

```
.env*.local
```

- [ ] **Step 5: 驗證與 commit**

Run: `npx tsc --noEmit` → 無錯誤;`npx drizzle-kit --version` → 輸出版本號。

```bash
git add package.json package-lock.json drizzle.config.ts .env.example .gitignore
git commit -m "chore: 安裝雲端同步依賴(Auth.js、Drizzle、Neon、zod)"
```

---

### Task 2: DB Schema、Client 與測試資料庫輔助

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/db/testDb.ts`(僅測試 import)
- Create: `src/db/schema.test.ts`
- Create: `drizzle/`(drizzle-kit generate 產出)

**Interfaces:**
- Produces:
  - `schema.ts`:`users`, `accounts`, `assets`, `liabilities`, `snapshots`(pgTable)、`type EntityTable = typeof assets`
  - `client.ts`:`getDb(): Db`(Neon 連線,lazy singleton)、`type Db`
  - `testDb.ts`:`createTestDb(): Promise<Db>`(PGlite in-memory,已套 migration)

- [ ] **Step 1: 撰寫 schema**

`src/db/schema.ts`:

```ts
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

export type EntityTable = typeof assets;
```

- [ ] **Step 2: 撰寫 Neon client**

`src/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

let db: ReturnType<typeof create> | null = null;

function create() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!db) db = create();
  return db;
}

export type Db = ReturnType<typeof getDb>;
```

> 注意:`EntityTable` 三張表結構相同,`Db` 型別對 PGlite 版本相容(見 testDb 的型別斷言)。

- [ ] **Step 3: 產生 migration**

Run: `npx drizzle-kit generate --name init`
Expected: `drizzle/0000_init.sql` 產生,內含 5 張表的 CREATE TABLE。

- [ ] **Step 4: 撰寫測試 DB 輔助**

`src/db/testDb.ts`:

```ts
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
```

- [ ] **Step 5: 撰寫失敗測試(schema smoke test)**

`src/db/schema.test.ts`:

```ts
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
  });
});
```

- [ ] **Step 6: 執行測試確認通過**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS(migration 套用成功、預設 version=1)。

- [ ] **Step 7: 對 Neon 套用 migration 並 commit**

Run: `npx drizzle-kit migrate`(需 `.env.local` 有 DATABASE_URL;drizzle-kit 會自動讀取)
Expected: 輸出 applied migrations。

```bash
git add src/db drizzle drizzle.config.ts
git commit -m "feat: 新增 Drizzle schema 與 Neon/PGlite 資料庫基礎建設"
```

---

### Task 3: Auth.js Google 登入設定

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/components/ClientLayout.tsx`(掛 SessionProvider)

**Interfaces:**
- Consumes: `getDb()`(Task 2)
- Produces:
  - `src/auth.ts`:`export const { handlers, auth, signIn, signOut }`;`auth()` 回傳的 `session.user.id: string`
  - client 端可用 `useSession()`, `signIn('google')`, `signOut()`(from `next-auth/react`)

- [ ] **Step 1: 撰寫 auth.ts**

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from './db/client';
import { users, accounts } from './db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), { usersTable: users, accountsTable: accounts }),
  session: { strategy: 'jwt' },
  providers: [Google],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: 撰寫 route handler**

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '../../../../auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 3: ClientLayout 掛 SessionProvider**

`src/components/ClientLayout.tsx` 修改 `ClientLayout` 匯出(import 加 `import { SessionProvider } from 'next-auth/react';`):

```tsx
export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StockProvider>
        <AppProvider>
          <ToastProvider>
            <ClientLayoutContent>{children}</ClientLayoutContent>
          </ToastProvider>
        </AppProvider>
      </StockProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 4: 手動驗證登入流程**

Run: `npm run dev`,瀏覽器開 `http://localhost:3000/api/auth/signin` → 出現 Google 登入 → 完成登入後 `http://localhost:3000/api/auth/session` 回傳含 `user.id` 的 JSON;Neon `users` 表出現一筆資料。

- [ ] **Step 5: 驗證 build 並 commit**

Run: `npx tsc --noEmit` → 無錯誤。

```bash
git add src/auth.ts src/app/api/auth src/components/ClientLayout.tsx
git commit -m "feat: Auth.js Google 登入(JWT session + Drizzle adapter)"
```

---

### Task 4: API 共用工具(錯誤格式 + zod schemas)

**Files:**
- Create: `src/server/apiHelpers.ts`
- Create: `src/server/apiHelpers.test.ts`
- Create: `src/server/entitySchemas.ts`
- Create: `src/server/entitySchemas.test.ts`

**Interfaces:**
- Consumes: `auth()`(Task 3)
- Produces:
  - `class ApiError extends Error { status: number; code: string }`
  - `requireUserId(): Promise<string>`(未登入 throw `ApiError(401,'unauthorized')`)
  - `handleApi(fn: () => Promise<Response>): Promise<Response>`(ApiError→對應狀態碼、ZodError→422、其他→500,格式 `{error:{code,message}}`)
  - `assetCategorySchema`, `liabilityItemSchema`, `assetSnapshotSchema`(zod,對應 `src/types.ts` 型別)

- [ ] **Step 1: 撰寫失敗測試(apiHelpers)**

`src/server/apiHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ApiError, handleApi } from './apiHelpers';

describe('handleApi', () => {
  it('ApiError 轉為對應狀態碼與統一格式', async () => {
    const res = await handleApi(async () => { throw new ApiError(409, 'version_conflict', '版本衝突'); });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('version_conflict');
  });

  it('ZodError 轉為 422', async () => {
    const res = await handleApi(async () => {
      z.object({ id: z.string() }).parse({});
      return Response.json({});
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
  });

  it('未知錯誤轉為 500', async () => {
    const res = await handleApi(async () => { throw new Error('boom'); });
    expect(res.status).toBe(500);
  });

  it('正常回應原樣通過', async () => {
    const res = await handleApi(async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/server/apiHelpers.test.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作 apiHelpers**

`src/server/apiHelpers.ts`:

```ts
import { ZodError } from 'zod';
import { auth } from '../auth';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, 'unauthorized', '請先登入');
  return id;
}

export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return Response.json(
        { error: { code: 'validation_failed', message: e.issues.map(i => i.message).join('; ') } },
        { status: 422 },
      );
    }
    console.error('[api] unhandled error', e);
    return Response.json({ error: { code: 'internal_error', message: '伺服器錯誤' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: 撰寫失敗測試(entitySchemas)**

`src/server/entitySchemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assetCategorySchema, liabilityItemSchema, assetSnapshotSchema } from './entitySchemas';

describe('entitySchemas', () => {
  it('接受合法 AssetCategory', () => {
    const ok = assetCategorySchema.safeParse({
      id: 'liquid', title: '流動資金', description: '現金', colorClass: 'bg-emerald-400',
      bgClass: 'bg-emerald-50', updatedAt: '剛剛',
      items: [{ id: 'l1', name: '活存', amount: 1000 }],
    });
    expect(ok.success).toBe(true);
  });

  it('拒絕 items 缺 amount 的 AssetCategory', () => {
    const bad = assetCategorySchema.safeParse({
      id: 'x', title: 't', description: '', colorClass: '', bgClass: '', updatedAt: '',
      items: [{ id: 'l1', name: '活存' }],
    });
    expect(bad.success).toBe(false);
  });

  it('接受合法 LiabilityItem 並拒絕非法 icon', () => {
    expect(liabilityItemSchema.safeParse({
      id: 'li1', name: '房貸', description: '', amount: 100, updatedAt: '', icon: 'building',
    }).success).toBe(true);
    expect(liabilityItemSchema.safeParse({
      id: 'li1', name: '房貸', description: '', amount: 100, updatedAt: '', icon: 'car',
    }).success).toBe(false);
  });

  it('接受含選填欄位的 AssetSnapshot', () => {
    expect(assetSnapshotSchema.safeParse({
      id: 's1', date: '2026-07-18', totalAssets: 1, totalLiabilities: 0, netWorth: 1,
      healthScore: 80, liquid: 1,
    }).success).toBe(true);
  });
});
```

- [ ] **Step 5: 執行測試確認失敗**

Run: `npx vitest run src/server/entitySchemas.test.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 6: 實作 entitySchemas**

`src/server/entitySchemas.ts`:

```ts
import { z } from 'zod';

export const assetItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
});

export const assetCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  colorClass: z.string(),
  bgClass: z.string(),
  updatedAt: z.string(),
  items: z.array(assetItemSchema),
});

export const liabilityItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  amount: z.number(),
  updatedAt: z.string(),
  icon: z.enum(['building', 'creditCard']),
});

export const assetSnapshotSchema = z.object({
  id: z.string(),
  date: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  healthScore: z.number().optional(),
  liquid: z.number().optional(),
  investment: z.number().optional(),
  fixed: z.number().optional(),
  receivable: z.number().optional(),
});
```

- [ ] **Step 7: 執行全部測試並 commit**

Run: `npm test`
Expected: 全部 PASS(含既有測試)。

```bash
git add src/server
git commit -m "feat: API 共用工具(統一錯誤格式、zod 實體 schema)"
```

---

### Task 5: 泛型 EntityStore(伺服器端資料存取層)

**Files:**
- Create: `src/server/entityStore.ts`
- Create: `src/server/entityStore.test.ts`

**Interfaces:**
- Consumes: `EntityTable`、`Db`(Task 2)、`ApiError`(Task 4)
- Produces:

```ts
type EntityRow = { id: string; data: unknown; version: number };
interface EntityStore {
  getAll(db: Db, userId: string): Promise<EntityRow[]>;          // 依 position 排序
  create(db: Db, userId: string, id: string, data: unknown): Promise<void>;   // id 重複 → ApiError 409 'duplicate_id'
  update(db: Db, userId: string, id: string, data: unknown, version: number): Promise<number>; // 回傳新 version;不存在 → 404 'not_found';version 不符 → 409 'version_conflict'
  remove(db: Db, userId: string, id: string): Promise<void>;     // 不存在 → 404
  replaceAll(db: Db, userId: string, rows: { id: string; data: unknown }[]): Promise<void>; // 全刪重建,version 一律 1
  hasAny(db: Db, userId: string): Promise<boolean>;
}
createEntityStore(table: EntityTable): EntityStore
```

- [ ] **Step 1: 撰寫失敗測試**

`src/server/entityStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { assets } from '../db/schema';
import { createEntityStore } from './entityStore';
import { ApiError } from './apiHelpers';

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

  it('hasAny 反映是否有資料', async () => {
    expect(await store.hasAny(db, 'userA')).toBe(false);
    await store.create(db, 'userA', 'a1', {});
    expect(await store.hasAny(db, 'userA')).toBe(true);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/server/entityStore.test.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作 entityStore**

`src/server/entityStore.ts`:

```ts
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
```

> 注意:Neon HTTP driver 不支援 transaction;`replaceAll` 的 delete+insert 為兩個請求。單人匯入情境可接受(spec §10 不做離線佇列);若 insert 失敗,重新執行匯入即可恢復。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/server/entityStore.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/server/entityStore.ts src/server/entityStore.test.ts
git commit -m "feat: 泛型 EntityStore(隔離、樂觀鎖、整批取代)"
```

---

### Task 6: Route Handlers(assets / liabilities / snapshots / summary)

**Files:**
- Create: `src/server/entityHandlers.ts`
- Create: `src/server/entityHandlers.test.ts`
- Create: `src/app/api/user/assets/route.ts`
- Create: `src/app/api/user/assets/[id]/route.ts`
- Create: `src/app/api/user/liabilities/route.ts`
- Create: `src/app/api/user/liabilities/[id]/route.ts`
- Create: `src/app/api/user/snapshots/route.ts`
- Create: `src/app/api/user/snapshots/[id]/route.ts`
- Create: `src/app/api/user/summary/route.ts`

**Interfaces:**
- Consumes: `createEntityStore`(Task 5)、`handleApi`/`requireUserId`/`ApiError`(Task 4)、entity schemas(Task 4)
- Produces(HTTP 契約,remote repository 依賴):
  - `GET  /api/user/<domain>` → `{ items: [{ id, data, version }] }`
  - `POST /api/user/<domain>` body `{ data }` → 201 `{ version: 1 }`
  - `PUT  /api/user/<domain>` body `{ data: T[] }` → `{ ok: true }`(整批取代)
  - `PATCH  /api/user/<domain>/:id` body `{ data, version }` → `{ version }`
  - `DELETE /api/user/<domain>/:id` → `{ ok: true }`
  - `GET /api/user/summary` → `{ assets: boolean, liabilities: boolean, snapshots: boolean }`
- 內部工廠(handlers 測試直接注入依賴,不需 vi.mock):

```ts
type HandlerDeps = { store: EntityStore; schema: ZodType; getDb(): Db; getUserId(): Promise<string> };
createCollectionHandlers(deps): { GET(req): Promise<Response>; POST(req): Promise<Response>; PUT(req): Promise<Response> }
createItemHandlers(deps): {
  PATCH(req, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
  DELETE(req, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
}
```

- [ ] **Step 1: 撰寫失敗測試**

`src/server/entityHandlers.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { assets } from '../db/schema';
import { createEntityStore } from './entityStore';
import { createCollectionHandlers, createItemHandlers } from './entityHandlers';
import { ApiError } from './apiHelpers';
import { z } from 'zod';

const schema = z.object({ id: z.string(), title: z.string() });
const store = createEntityStore(assets);
let db: Db;

function makeDeps(userId: string | null) {
  return {
    store, schema, getDb: () => db,
    getUserId: async () => {
      if (!userId) throw new ApiError(401, 'unauthorized', '請先登入');
      return userId;
    },
  };
}

const req = (body?: unknown) => new Request('http://test/api', {
  method: 'POST',
  body: body === undefined ? undefined : JSON.stringify(body),
});
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  db = await createTestDb();
  await createTestUser(db, 'u1');
});

describe('entityHandlers', () => {
  it('未登入 → 401', async () => {
    const h = createCollectionHandlers(makeDeps(null));
    const res = await h.GET(req());
    expect(res.status).toBe(401);
  });

  it('POST 非法 body → 422', async () => {
    const h = createCollectionHandlers(makeDeps('u1'));
    const res = await h.POST(req({ data: { id: 'a1' } })); // 缺 title
    expect(res.status).toBe(422);
  });

  it('POST → 201,GET 讀回', async () => {
    const h = createCollectionHandlers(makeDeps('u1'));
    const post = await h.POST(req({ data: { id: 'a1', title: '流動' } }));
    expect(post.status).toBe(201);
    const get = await h.GET(req());
    const body = await get.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: 'a1', version: 1 });
  });

  it('PATCH version 不符 → 409;相符 → 回新 version', async () => {
    const col = createCollectionHandlers(makeDeps('u1'));
    const item = createItemHandlers(makeDeps('u1'));
    await col.POST(req({ data: { id: 'a1', title: '舊' } }));
    const conflict = await item.PATCH(req({ data: { id: 'a1', title: '新' }, version: 9 }), idCtx('a1'));
    expect(conflict.status).toBe(409);
    const ok = await item.PATCH(req({ data: { id: 'a1', title: '新' }, version: 1 }), idCtx('a1'));
    expect((await ok.json()).version).toBe(2);
  });

  it('DELETE 不存在 → 404', async () => {
    const item = createItemHandlers(makeDeps('u1'));
    const res = await item.DELETE(req(), idCtx('nope'));
    expect(res.status).toBe(404);
  });

  it('PUT 整批取代', async () => {
    const h = createCollectionHandlers(makeDeps('u1'));
    await h.POST(req({ data: { id: 'old', title: 'x' } }));
    const put = await h.PUT(req({ data: [{ id: 'n1', title: 'a' }, { id: 'n2', title: 'b' }] }));
    expect(put.status).toBe(200);
    const body = await (await h.GET(req())).json();
    expect(body.items.map((r: { id: string }) => r.id)).toEqual(['n1', 'n2']);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/server/entityHandlers.test.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作 entityHandlers**

`src/server/entityHandlers.ts`:

```ts
import { z, type ZodType } from 'zod';
import type { Db } from '../db/client';
import type { EntityStore } from './entityStore';
import { handleApi } from './apiHelpers';

type HandlerDeps = {
  store: EntityStore;
  schema: ZodType;
  getDb: () => Db;
  getUserId: () => Promise<string>;
};

const idSchema = z.object({ id: z.string() });

export function createCollectionHandlers({ store, schema, getDb, getUserId }: HandlerDeps) {
  return {
    GET: (_req: Request) => handleApi(async () => {
      const userId = await getUserId();
      const items = await store.getAll(getDb(), userId);
      return Response.json({ items });
    }),

    POST: (req: Request) => handleApi(async () => {
      const userId = await getUserId();
      const { data } = z.object({ data: schema }).parse(await req.json());
      const { id } = idSchema.parse(data);
      await store.create(getDb(), userId, id, data);
      return Response.json({ version: 1 }, { status: 201 });
    }),

    PUT: (req: Request) => handleApi(async () => {
      const userId = await getUserId();
      const { data } = z.object({ data: z.array(schema) }).parse(await req.json());
      const rows = data.map(d => ({ id: idSchema.parse(d).id, data: d }));
      await store.replaceAll(getDb(), userId, rows);
      return Response.json({ ok: true });
    }),
  };
}

export function createItemHandlers({ store, schema, getDb, getUserId }: HandlerDeps) {
  return {
    PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => handleApi(async () => {
      const userId = await getUserId();
      const { id } = await ctx.params;
      const { data, version } = z.object({ data: schema, version: z.number().int() }).parse(await req.json());
      const newVersion = await store.update(getDb(), userId, id, data, version);
      return Response.json({ version: newVersion });
    }),

    DELETE: (_req: Request, ctx: { params: Promise<{ id: string }> }) => handleApi(async () => {
      const userId = await getUserId();
      const { id } = await ctx.params;
      await store.remove(getDb(), userId, id);
      return Response.json({ ok: true });
    }),
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/server/entityHandlers.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 建立各領域 route 檔**

`src/app/api/user/assets/route.ts`:

```ts
import { assets } from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { createEntityStore } from '../../../../server/entityStore';
import { createCollectionHandlers } from '../../../../server/entityHandlers';
import { requireUserId } from '../../../../server/apiHelpers';
import { assetCategorySchema } from '../../../../server/entitySchemas';

const handlers = createCollectionHandlers({
  store: createEntityStore(assets), schema: assetCategorySchema, getDb, getUserId: requireUserId,
});
export const { GET, POST, PUT } = handlers;
```

`src/app/api/user/assets/[id]/route.ts`:

```ts
import { assets } from '../../../../../db/schema';
import { getDb } from '../../../../../db/client';
import { createEntityStore } from '../../../../../server/entityStore';
import { createItemHandlers } from '../../../../../server/entityHandlers';
import { requireUserId } from '../../../../../server/apiHelpers';
import { assetCategorySchema } from '../../../../../server/entitySchemas';

const handlers = createItemHandlers({
  store: createEntityStore(assets), schema: assetCategorySchema, getDb, getUserId: requireUserId,
});
export const { PATCH, DELETE } = handlers;
```

`liabilities` 與 `snapshots` 各兩檔,內容同上,僅替換:table(`liabilities`/`snapshots`)與 schema(`liabilityItemSchema`/`assetSnapshotSchema`)。共 6 檔。

`src/app/api/user/summary/route.ts`:

```ts
import { assets, liabilities, snapshots } from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { createEntityStore } from '../../../../server/entityStore';
import { handleApi, requireUserId } from '../../../../server/apiHelpers';

export const GET = () => handleApi(async () => {
  const userId = await requireUserId();
  const db = getDb();
  const [a, l, s] = await Promise.all([
    createEntityStore(assets).hasAny(db, userId),
    createEntityStore(liabilities).hasAny(db, userId),
    createEntityStore(snapshots).hasAny(db, userId),
  ]);
  return Response.json({ assets: a, liabilities: l, snapshots: s });
});
```

- [ ] **Step 6: 驗證 build 與手動煙霧測試**

Run: `npx tsc --noEmit` → 無錯誤。
Run: `npm run dev`,登入後瀏覽器開 `/api/user/summary` → `{"assets":false,...}`;無痕視窗(未登入)開同網址 → 401。

- [ ] **Step 7: Commit**

```bash
git add src/server/entityHandlers.ts src/server/entityHandlers.test.ts src/app/api/user
git commit -m "feat: /api/user 資產/負債/快照 CRUD 與 summary 端點"
```

---

### Task 7: Repository 介面與 local 實作

**Files:**
- Create: `src/repositories/types.ts`
- Create: `src/repositories/localRepository.ts`
- Create: `src/repositories/repositoryContract.ts`(共用契約測試)
- Create: `src/repositories/localRepository.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export class ConflictError extends Error {}
export interface EntityRepository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  create(entity: T): Promise<void>;
  update(entity: T): Promise<void>;      // 以 id 定位,整筆取代;remote 版本不符時 throw ConflictError
  remove(id: string): Promise<void>;
  replaceAll(entities: T[]): Promise<void>;
}
// localRepository.ts
createLocalRepository<T extends { id: string }>(storageKey: string, defaultValue: T[]): EntityRepository<T>
// repositoryContract.ts
runRepositoryContract(name: string, makeRepo: () => Promise<EntityRepository<{ id: string; name: string }>>): void
```

- [ ] **Step 1: 撰寫契約測試(供 local 與 remote 共用)**

`src/repositories/repositoryContract.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { EntityRepository } from './types';

type Item = { id: string; name: string };

export function runRepositoryContract(
  name: string,
  makeRepo: () => Promise<EntityRepository<Item>>,
) {
  describe(`${name}(repository 契約)`, () => {
    it('初始 getAll 後 create 可讀回', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'a', name: '甲' });
      expect(await repo.getAll()).toEqual([{ id: 'a', name: '甲' }]);
    });

    it('update 以 id 整筆取代', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'a', name: '甲' });
      await repo.update({ id: 'a', name: '乙' });
      expect(await repo.getAll()).toEqual([{ id: 'a', name: '乙' }]);
    });

    it('remove 刪除指定 id', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'a', name: '甲' });
      await repo.create({ id: 'b', name: '乙' });
      await repo.remove('a');
      expect(await repo.getAll()).toEqual([{ id: 'b', name: '乙' }]);
    });

    it('replaceAll 整批取代並保持順序', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'old', name: '舊' });
      await repo.replaceAll([{ id: 'n2', name: '2' }, { id: 'n1', name: '1' }]);
      expect((await repo.getAll()).map(i => i.id)).toEqual(['n2', 'n1']);
    });
  });
}
```

`src/repositories/localRepository.test.ts`:

```ts
import { beforeEach, describe, it, expect } from 'vitest';
import { runRepositoryContract } from './repositoryContract';
import { createLocalRepository } from './localRepository';

const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

runRepositoryContract('localRepository', async () =>
  createLocalRepository<{ id: string; name: string }>('test-key', []));

describe('localRepository 預設值', () => {
  it('localStorage 無資料時 getAll 回傳 defaultValue', async () => {
    const repo = createLocalRepository('empty-key', [{ id: 'd', name: '預設' }]);
    expect(await repo.getAll()).toEqual([{ id: 'd', name: '預設' }]);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/repositories`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作 types 與 localRepository**

`src/repositories/types.ts`:

```ts
export class ConflictError extends Error {
  constructor(message = '資料已在其他裝置修改') { super(message); }
}

export interface EntityRepository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  create(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(entities: T[]): Promise<void>;
}
```

`src/repositories/localRepository.ts`:

```ts
import type { EntityRepository } from './types';

export function createLocalRepository<T extends { id: string }>(
  storageKey: string,
  defaultValue: T[],
): EntityRepository<T> {
  const read = (): T[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T[]) : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  const write = (items: T[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* storage full */ }
  };

  return {
    async getAll() { return read(); },
    async create(entity) { write([...read(), entity]); },
    async update(entity) { write(read().map(i => (i.id === entity.id ? entity : i))); },
    async remove(id) { write(read().filter(i => i.id !== id)); },
    async replaceAll(entities) { write(entities); },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/repositories`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/repositories
git commit -m "feat: EntityRepository 介面、契約測試與 localStorage 實作"
```

---

### Task 8: remote Repository 實作

**Files:**
- Create: `src/repositories/remoteRepository.ts`
- Create: `src/repositories/remoteRepository.test.ts`

**Interfaces:**
- Consumes: `EntityRepository`、`ConflictError`(Task 7)、Task 6 的 HTTP 契約
- Produces: `createRemoteRepository<T extends { id: string }>(endpoint: string): EntityRepository<T>`(endpoint 如 `/api/user/assets`;內部維護 id→version 快取)

- [ ] **Step 1: 撰寫失敗測試**

`src/repositories/remoteRepository.test.ts`(以 fake fetch 模擬伺服器,重用契約測試):

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { runRepositoryContract } from './repositoryContract';
import { createRemoteRepository } from './remoteRepository';
import { ConflictError } from './types';

type Row = { id: string; data: unknown; version: number };

/** 極簡 in-memory 伺服器,實作 Task 6 的 HTTP 契約 */
function installFakeServer() {
  const rows: Row[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const m = /\/api\/user\/items(?:\/([^/]+))?$/.exec(url);
    const id = m?.[1];
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status });

    if (method === 'GET') return json({ items: rows });
    if (method === 'POST') {
      rows.push({ id: body.data.id, data: body.data, version: 1 });
      return json({ version: 1 }, 201);
    }
    if (method === 'PUT') {
      rows.length = 0;
      for (const d of body.data) rows.push({ id: d.id, data: d, version: 1 });
      return json({ ok: true });
    }
    if (method === 'PATCH' && id) {
      const row = rows.find(r => r.id === id);
      if (!row) return json({ error: { code: 'not_found', message: '' } }, 404);
      if (row.version !== body.version) return json({ error: { code: 'version_conflict', message: '' } }, 409);
      row.data = body.data; row.version += 1;
      return json({ version: row.version });
    }
    if (method === 'DELETE' && id) {
      const idx = rows.findIndex(r => r.id === id);
      if (idx < 0) return json({ error: { code: 'not_found', message: '' } }, 404);
      rows.splice(idx, 1);
      return json({ ok: true });
    }
    return json({ error: { code: 'not_found', message: '' } }, 404);
  }));
  return rows;
}

let serverRows: Row[];
beforeEach(() => { serverRows = installFakeServer(); });

runRepositoryContract('remoteRepository', async () =>
  createRemoteRepository<{ id: string; name: string }>('/api/user/items'));

describe('remoteRepository 版本管理', () => {
  it('update 送出 getAll 取得的 version,成功後遞增', async () => {
    const repo = createRemoteRepository<{ id: string; name: string }>('/api/user/items');
    await repo.getAll();
    await repo.create({ id: 'a', name: '甲' });
    await repo.update({ id: 'a', name: '乙' });   // version 1 → 2
    await repo.update({ id: 'a', name: '丙' });   // version 2 → 3
    expect(serverRows[0].version).toBe(3);
  });

  it('409 時拋 ConflictError', async () => {
    const repo = createRemoteRepository<{ id: string; name: string }>('/api/user/items');
    await repo.getAll();
    await repo.create({ id: 'a', name: '甲' });
    serverRows[0].version = 99; // 模擬其他裝置改過
    await expect(repo.update({ id: 'a', name: '乙' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('非 2xx 回應拋一般 Error', async () => {
    const repo = createRemoteRepository<{ id: string; name: string }>('/api/user/items');
    await expect(repo.remove('nope')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/repositories/remoteRepository.test.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作 remoteRepository**

`src/repositories/remoteRepository.ts`:

```ts
import { ConflictError, type EntityRepository } from './types';

async function request(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `API 錯誤(${res.status})`);
  }
  return res.json();
}

export function createRemoteRepository<T extends { id: string }>(
  endpoint: string,
): EntityRepository<T> {
  const versions = new Map<string, number>();

  return {
    async getAll() {
      const body = await request(endpoint) as { items: { id: string; data: T; version: number }[] };
      versions.clear();
      for (const row of body.items) versions.set(row.id, row.version);
      return body.items.map(r => r.data);
    },

    async create(entity) {
      await request(endpoint, { method: 'POST', body: JSON.stringify({ data: entity }) });
      versions.set(entity.id, 1);
    },

    async update(entity) {
      const version = versions.get(entity.id) ?? 1;
      const body = await request(`${endpoint}/${encodeURIComponent(entity.id)}`, {
        method: 'PATCH', body: JSON.stringify({ data: entity, version }),
      }) as { version: number };
      versions.set(entity.id, body.version);
    },

    async remove(id) {
      await request(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      versions.delete(id);
    },

    async replaceAll(entities) {
      await request(endpoint, { method: 'PUT', body: JSON.stringify({ data: entities }) });
      versions.clear();
      for (const e of entities) versions.set(e.id, 1);
    },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/repositories`
Expected: 全部 PASS(local + remote 跑同一套契約)。

- [ ] **Step 5: Commit**

```bash
git add src/repositories/remoteRepository.ts src/repositories/remoteRepository.test.ts
git commit -m "feat: remote repository(fetch + 版本快取 + ConflictError)"
```

---

### Task 9: RepositoryProvider 與 Toast 順序調整

**Files:**
- Create: `src/context/RepositoryContext.tsx`
- Modify: `src/components/ClientLayout.tsx`

**Interfaces:**
- Consumes: `createLocalRepository`、`createRemoteRepository`(Task 7/8)、`useSession`(Task 3)、`initialAssets`/`initialLiabilities`(自 AssetContext 移入此檔,見 Task 10)
- Produces:

```ts
type Repos = {
  assets: EntityRepository<AssetCategory>;
  liabilities: EntityRepository<LiabilityItem>;
  snapshots: EntityRepository<AssetSnapshot>;
};
useRepositories(): { repos: Repos; mode: 'guest' | 'cloud'; sessionStatus: 'loading' | 'authenticated' | 'unauthenticated' }
RepositoryProvider({ children })
// 另 export 預設資料(供 local repo 與匯入判斷共用):
export const initialAssets: AssetCategory[];
export const initialLiabilities: LiabilityItem[];
export const LOCAL_KEYS = { assets: 'app-assets-v1', liabilities: 'app-liabilities-v1', snapshots: 'app-snapshots-v1' } as const;
```

- [ ] **Step 1: 實作 RepositoryContext**

`src/context/RepositoryContext.tsx`(`initialAssets`/`initialLiabilities` 內容自 `src/context/AssetContext.tsx:7-44` 原樣搬入):

```tsx
"use client";

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';
import type { EntityRepository } from '../repositories/types';
import { createLocalRepository } from '../repositories/localRepository';
import { createRemoteRepository } from '../repositories/remoteRepository';

export const LOCAL_KEYS = {
  assets: 'app-assets-v1',
  liabilities: 'app-liabilities-v1',
  snapshots: 'app-snapshots-v1',
} as const;

export const initialAssets: AssetCategory[] = [ /* 自 AssetContext.tsx:7-39 原樣搬入 */ ];
export const initialLiabilities: LiabilityItem[] = [ /* 自 AssetContext.tsx:41-44 原樣搬入 */ ];

export type Repos = {
  assets: EntityRepository<AssetCategory>;
  liabilities: EntityRepository<LiabilityItem>;
  snapshots: EntityRepository<AssetSnapshot>;
};

interface RepositoryContextType {
  repos: Repos;
  mode: 'guest' | 'cloud';
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

export function useRepositories() {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepositories must be used within RepositoryProvider');
  return ctx;
}

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const mode: 'guest' | 'cloud' = status === 'authenticated' ? 'cloud' : 'guest';

  const repos = useMemo<Repos>(() => (
    mode === 'cloud'
      ? {
          assets: createRemoteRepository<AssetCategory>('/api/user/assets'),
          liabilities: createRemoteRepository<LiabilityItem>('/api/user/liabilities'),
          snapshots: createRemoteRepository<AssetSnapshot>('/api/user/snapshots'),
        }
      : {
          assets: createLocalRepository<AssetCategory>(LOCAL_KEYS.assets, initialAssets),
          liabilities: createLocalRepository<LiabilityItem>(LOCAL_KEYS.liabilities, initialLiabilities),
          snapshots: createLocalRepository<AssetSnapshot>(LOCAL_KEYS.snapshots, []),
        }
  ), [mode]);

  return (
    <RepositoryContext.Provider value={{ repos, mode, sessionStatus: status }}>
      {children}
    </RepositoryContext.Provider>
  );
}
```

- [ ] **Step 2: 調整 ClientLayout Provider 順序**

`src/components/ClientLayout.tsx` 的 `ClientLayout`(ToastProvider 移到最外層之一,讓 Context 可用 toast;插入 RepositoryProvider):

```tsx
export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <RepositoryProvider>
          <StockProvider>
            <AppProvider>
              <ClientLayoutContent>{children}</ClientLayoutContent>
            </AppProvider>
          </StockProvider>
        </RepositoryProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
```

import 加:`import { RepositoryProvider } from '../context/RepositoryContext';`。

- [ ] **Step 3: 驗證與 commit**

Run: `npx tsc --noEmit && npm test` → 通過;`npm run dev` 首頁正常顯示(此時尚無 consumer,純結構調整)。

```bash
git add src/context/RepositoryContext.tsx src/components/ClientLayout.tsx
git commit -m "feat: RepositoryProvider(依登入狀態切換 local/remote repo)"
```

---

### Task 10: AssetContext 重構為領域操作(核心)

**Files:**
- Create: `src/hooks/useSyncedCollection.ts`
- Create: `src/hooks/useSyncedCollection.test.ts`
- Create: `src/lib/snapshotMerge.ts`
- Create: `src/lib/snapshotMerge.test.ts`
- Modify: `src/context/AssetContext.tsx`(全面改寫)

**Interfaces:**
- Consumes: `useRepositories()`(Task 9)、`ConflictError`(Task 7)、`useToast`(既有)
- Produces(`useAssetContext()` 新形狀,Task 11 呼叫端依賴):

```ts
interface AssetContextType {
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  snapshots: AssetSnapshot[];
  assetsLoading: boolean;               // cloud 模式初載;guest 模式恆 false(首次 render 後)
  combinedAssets: AssetCategory[];
  combinedLiabilities: LiabilityItem[];
  totalAssets: number;
  totalLiabilities: number;
  addCategory(input: { title: string; description: string; colorClass: string; bgClass: string }): void;
  updateCategory(id: string, patch: Partial<Omit<AssetCategory, 'id'>>): void;
  removeCategory(id: string): void;
  addAssetItem(categoryId: string, name: string, amount: number): void;
  updateAssetItem(categoryId: string, itemId: string, patch: Partial<Omit<AssetItem, 'id'>>): void;
  removeAssetItem(categoryId: string, itemId: string): void;
  addLiability(input: { name: string; amount: number; description?: string; icon?: 'building' | 'creditCard' }): void;
  updateLiability(id: string, patch: Partial<Omit<LiabilityItem, 'id'>>): void;
  removeLiability(id: string): void;
  saveSnapshot(snap: AssetSnapshot): void;        // 同日去重 + 保留最近 365 筆
  removeSnapshot(id: string): void;
  replaceAssets(data: AssetCategory[]): Promise<void>;
  replaceLiabilities(data: LiabilityItem[]): Promise<void>;
  replaceSnapshots(data: AssetSnapshot[]): Promise<void>;
  clearAssetData(): void;
}
```

- `useSyncedCollection.ts`:

```ts
function useSyncedCollection<T extends { id: string }>(
  repo: EntityRepository<T>,
  onError: (e: unknown, reload: () => void) => void,
): {
  items: T[];
  loading: boolean;
  apply(next: T[], persist: (repo: EntityRepository<T>) => Promise<void>): void; // 樂觀更新+失敗回滾
  replace(data: T[]): Promise<void>;
}
```

- `snapshotMerge.ts`:`mergeSnapshot(prev: AssetSnapshot[], snap: AssetSnapshot): AssetSnapshot[]`(同 date 去重、保留最近 365 筆)

- [ ] **Step 1: 撰寫失敗測試(snapshotMerge)**

`src/lib/snapshotMerge.test.ts`:

```ts
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
```

- [ ] **Step 2: 實作 snapshotMerge 並確認測試通過**

`src/lib/snapshotMerge.ts`:

```ts
import type { AssetSnapshot } from '../types';

export function mergeSnapshot(prev: AssetSnapshot[], snap: AssetSnapshot): AssetSnapshot[] {
  const withoutSameDate = prev.filter(s => s.date !== snap.date);
  return [...withoutSameDate.slice(-364), snap];
}
```

Run: `npx vitest run src/lib/snapshotMerge.test.ts` → PASS。

- [ ] **Step 3: 撰寫失敗測試(useSyncedCollection)**

`src/hooks/useSyncedCollection.test.ts`(不依賴 React 渲染,測核心邏輯用 fake repo + `renderHook` 不可用 → 專案無 @testing-library,改以「可注入的純邏輯」測:把樂觀更新核心抽成 `applyOptimistic` 純函式一併 export):

```ts
import { describe, it, expect, vi } from 'vitest';
import { applyOptimistic } from './useSyncedCollection';
import { ConflictError } from '../repositories/types';

type Item = { id: string; name: string };

describe('applyOptimistic', () => {
  it('persist 成功:維持 next 狀態', async () => {
    let state: Item[] = [{ id: 'a', name: '舊' }];
    const setState = (v: Item[]) => { state = v; };
    await applyOptimistic({
      prev: state, next: [{ id: 'a', name: '新' }], setState,
      persist: async () => {},
      onError: vi.fn(),
    });
    expect(state).toEqual([{ id: 'a', name: '新' }]);
  });

  it('persist 失敗:回滾至 prev 並呼叫 onError', async () => {
    let state: Item[] = [{ id: 'a', name: '舊' }];
    const onError = vi.fn();
    await applyOptimistic({
      prev: state, next: [{ id: 'a', name: '新' }],
      setState: (v: Item[]) => { state = v; },
      persist: async () => { throw new Error('網路錯誤'); },
      onError,
    });
    expect(state).toEqual([{ id: 'a', name: '舊' }]);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('ConflictError 也走 onError(由呼叫端決定 reload)', async () => {
    const onError = vi.fn();
    await applyOptimistic({
      prev: [], next: [{ id: 'a', name: 'x' }],
      setState: () => {},
      persist: async () => { throw new ConflictError(); },
      onError,
    });
    expect(onError.mock.calls[0][0]).toBeInstanceOf(ConflictError);
  });
});
```

- [ ] **Step 4: 實作 useSyncedCollection 並確認測試通過**

`src/hooks/useSyncedCollection.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntityRepository } from '../repositories/types';

export async function applyOptimistic<T>(args: {
  prev: T[];
  next: T[];
  setState: (v: T[]) => void;
  persist: () => Promise<void>;
  onError: (e: unknown) => void;
}): Promise<void> {
  const { prev, next, setState, persist, onError } = args;
  setState(next);
  try {
    await persist();
  } catch (e) {
    setState(prev);
    onError(e);
  }
}

export function useSyncedCollection<T extends { id: string }>(
  repo: EntityRepository<T>,
  onError: (e: unknown, reload: () => void) => void,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const reload = useCallback(() => {
    repo.getAll().then(setItems).catch(() => {});
  }, [repo]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    repo.getAll()
      .then(data => { if (alive) { setItems(data); setLoading(false); } })
      .catch(e => { if (alive) { setLoading(false); onError(e, () => {}); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const apply = useCallback((next: T[], persist: (repo: EntityRepository<T>) => Promise<void>) => {
    void applyOptimistic({
      prev: itemsRef.current, next, setState: setItems,
      persist: () => persist(repo),
      onError: (e) => onError(e, reload),
    });
  }, [repo, onError, reload]);

  const replace = useCallback(async (data: T[]) => {
    await repo.replaceAll(data);
    setItems(data);
  }, [repo]);

  return { items, loading, apply, replace };
}
```

Run: `npx vitest run src/hooks/useSyncedCollection.test.ts` → PASS。

- [ ] **Step 5: 改寫 AssetContext**

`src/context/AssetContext.tsx` 全檔改寫(initialAssets/initialLiabilities 已移至 RepositoryContext,此處 import;`combinedAssets`/`combinedLiabilities`/`totalAssets`/`totalLiabilities` 的 useMemo 邏輯與 Provider props 原樣保留):

```tsx
"use client";

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import type { AssetCategory, AssetItem, LiabilityItem, AssetSnapshot, StakingItem, LoanItem } from '../types';
import { useRepositories } from './RepositoryContext';
import { useSyncedCollection } from '../hooks/useSyncedCollection';
import { mergeSnapshot } from '../lib/snapshotMerge';
import { ConflictError } from '../repositories/types';
import { useToast } from './ToastContext';

const nowTs = () => '剛剛';

interface AssetContextType { /* 見本任務 Interfaces 區塊,原樣照抄 */ }

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function useAssetContext() {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error('useAssetContext must be used within an AssetProvider');
  return ctx;
}

interface AssetProviderProps {
  children: ReactNode;
  stakingEarnTotal: number;
  totalStockValueTWD: number;
  borrowItems: Pick<StakingItem, 'id' | 'name' | 'protocol' | 'value' | 'apy'>[];
  loans: Pick<LoanItem, 'id' | 'name' | 'bank' | 'principal' | 'interestRate' | 'remainingPeriods' | 'loanType'>[];
}

export function AssetProvider({
  children, stakingEarnTotal, totalStockValueTWD, borrowItems, loans,
}: AssetProviderProps) {
  const { repos } = useRepositories();
  const { toast } = useToast();

  const onError = useCallback((e: unknown, reload: () => void) => {
    if (e instanceof ConflictError) {
      toast('資料已在其他裝置修改，已重新載入', 'error');
      reload();
    } else {
      toast('儲存失敗，變更已還原', 'error');
    }
  }, [toast]);

  const assetsCol = useSyncedCollection<AssetCategory>(repos.assets, onError);
  const liabCol = useSyncedCollection<LiabilityItem>(repos.liabilities, onError);
  const snapCol = useSyncedCollection<AssetSnapshot>(repos.snapshots, onError);

  const assets = assetsCol.items;
  const liabilities = liabCol.items;
  const snapshots = snapCol.items;
  const assetsLoading = assetsCol.loading || liabCol.loading || snapCol.loading;

  // ── 資產分類操作 ──────────────────────────────────────────────
  const addCategory = useCallback((input: { title: string; description: string; colorClass: string; bgClass: string }) => {
    const cat: AssetCategory = { id: `cat-${Date.now()}`, ...input, updatedAt: nowTs(), items: [] };
    assetsCol.apply([...assets, cat], r => r.create(cat));
  }, [assets, assetsCol]);

  const updateCategory = useCallback((id: string, patch: Partial<Omit<AssetCategory, 'id'>>) => {
    const target = assets.find(c => c.id === id);
    if (!target) return;
    const updated = { ...target, ...patch, updatedAt: nowTs() };
    assetsCol.apply(assets.map(c => (c.id === id ? updated : c)), r => r.update(updated));
  }, [assets, assetsCol]);

  const removeCategory = useCallback((id: string) => {
    assetsCol.apply(assets.filter(c => c.id !== id), r => r.remove(id));
  }, [assets, assetsCol]);

  const mutateCategoryItems = useCallback((categoryId: string, fn: (items: AssetItem[]) => AssetItem[]) => {
    const target = assets.find(c => c.id === categoryId);
    if (!target) return;
    const updated = { ...target, items: fn(target.items), updatedAt: nowTs() };
    assetsCol.apply(assets.map(c => (c.id === categoryId ? updated : c)), r => r.update(updated));
  }, [assets, assetsCol]);

  const addAssetItem = useCallback((categoryId: string, name: string, amount: number) => {
    if (!name.trim()) return;
    mutateCategoryItems(categoryId, items => [...items, { id: Date.now().toString(), name, amount }]);
  }, [mutateCategoryItems]);

  const updateAssetItem = useCallback((categoryId: string, itemId: string, patch: Partial<Omit<AssetItem, 'id'>>) => {
    mutateCategoryItems(categoryId, items => items.map(i => (i.id === itemId ? { ...i, ...patch } : i)));
  }, [mutateCategoryItems]);

  const removeAssetItem = useCallback((categoryId: string, itemId: string) => {
    mutateCategoryItems(categoryId, items => items.filter(i => i.id !== itemId));
  }, [mutateCategoryItems]);

  // ── 負債操作 ─────────────────────────────────────────────────
  const addLiability = useCallback((input: { name: string; amount: number; description?: string; icon?: 'building' | 'creditCard' }) => {
    if (!input.name.trim()) return;
    const item: LiabilityItem = {
      id: Date.now().toString(), name: input.name, amount: input.amount,
      description: input.description ?? '自訂負債', updatedAt: nowTs(), icon: input.icon ?? 'creditCard',
    };
    liabCol.apply([...liabilities, item], r => r.create(item));
  }, [liabilities, liabCol]);

  const updateLiability = useCallback((id: string, patch: Partial<Omit<LiabilityItem, 'id'>>) => {
    const target = liabilities.find(i => i.id === id);
    if (!target) return;
    const updated = { ...target, ...patch, updatedAt: nowTs() };
    liabCol.apply(liabilities.map(i => (i.id === id ? updated : i)), r => r.update(updated));
  }, [liabilities, liabCol]);

  const removeLiability = useCallback((id: string) => {
    liabCol.apply(liabilities.filter(i => i.id !== id), r => r.remove(id));
  }, [liabilities, liabCol]);

  // ── 快照操作 ─────────────────────────────────────────────────
  const saveSnapshot = useCallback((snap: AssetSnapshot) => {
    const next = mergeSnapshot(snapshots, snap);
    // 同日去重/裁切會刪舊列;為簡化與穩健,快照一律整批同步
    snapCol.apply(next, r => r.replaceAll(next));
  }, [snapshots, snapCol]);

  const removeSnapshot = useCallback((id: string) => {
    snapCol.apply(snapshots.filter(s => s.id !== id), r => r.remove(id));
  }, [snapshots, snapCol]);

  // ── 匯入/清除 ────────────────────────────────────────────────
  const replaceAssets = assetsCol.replace;
  const replaceLiabilities = liabCol.replace;
  const replaceSnapshots = snapCol.replace;

  const clearAssetData = useCallback(() => {
    void assetsCol.replace([]);
    void liabCol.replace([]);
    void snapCol.replace([]);
  }, [assetsCol, liabCol, snapCol]);

  // ── 衍生值(原樣保留自現版 AssetContext.tsx:83-131)────────────
  const combinedAssets = useMemo(() => { /* 原樣 */ }, [assets, totalStockValueTWD, stakingEarnTotal]);
  const combinedLiabilities = useMemo(() => { /* 原樣 */ }, [liabilities, borrowItems, loans]);
  const totalAssets = useMemo(() => { /* 原樣 */ }, [combinedAssets]);
  const totalLiabilities = useMemo(() => { /* 原樣 */ }, [combinedLiabilities]);

  return (
    <AssetContext.Provider value={{
      assets, liabilities, snapshots, assetsLoading,
      combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
      addCategory, updateCategory, removeCategory,
      addAssetItem, updateAssetItem, removeAssetItem,
      addLiability, updateLiability, removeLiability,
      saveSnapshot, removeSnapshot,
      replaceAssets, replaceLiabilities, replaceSnapshots,
      clearAssetData,
    }}>
      {children}
    </AssetContext.Provider>
  );
}
```

> 注意:此步完成後 `AppContext.tsx` 等呼叫端會編譯失敗 — Task 11 立即接手修正,兩個任務**同一個 PR/批次**內完成。

- [ ] **Step 6: 驗證單元測試**

Run: `npx vitest run src/hooks src/lib/snapshotMerge.test.ts`
Expected: PASS(AssetContext 本身無獨立測試;其邏輯由 snapshotMerge、applyOptimistic、repository 契約覆蓋)。

- [ ] **Step 7: Commit(與 Task 11 合併亦可)**

```bash
git add src/hooks/useSyncedCollection.ts src/hooks/useSyncedCollection.test.ts src/lib/snapshotMerge.ts src/lib/snapshotMerge.test.ts src/context/AssetContext.tsx
git commit -m "refactor: AssetContext 改為領域操作 + 樂觀更新(暫破壞呼叫端,下個 commit 修復)"
```

---

### Task 11: 呼叫端改接(AppContext、page、settings、DataManager、ImportModal)

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/DataManager.tsx`
- Modify: `src/components/ImportModal.tsx`

**Interfaces:**
- Consumes: Task 10 的 `AssetContextType` 新形狀
- Produces: `useAppContext()` 移除 `setAssets`/`setLiabilities`/`setSnapshots`,新增轉發的領域操作與 `assetsLoading`、`replaceAssets`/`replaceLiabilities`/`replaceSnapshots`。

- [ ] **Step 1: 改 AppContext**

`src/context/AppContext.tsx`:

1. `AppContextType` 移除三個 setter(`AppContext.tsx:25,27,47`),加入(與 Task 10 同名同型別):`assetsLoading`、`addCategory`、`updateCategory`、`removeCategory`、`addAssetItem`、`updateAssetItem`、`removeAssetItem`、`addLiability`、`updateLiability`、`removeLiability`、`saveSnapshot`、`removeSnapshot`、`replaceAssets`、`replaceLiabilities`、`replaceSnapshots`。
2. `AppContextBridge` 內解構改為:

```ts
const {
  assets, liabilities, snapshots, assetsLoading,
  combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
  addCategory, updateCategory, removeCategory,
  addAssetItem, updateAssetItem, removeAssetItem,
  addLiability, updateLiability, removeLiability,
  saveSnapshot, removeSnapshot,
  replaceAssets, replaceLiabilities, replaceSnapshots,
  clearAssetData,
} = useAssetContext();
```

3. `takeSnapshot`(`AppContext.tsx:192-203`)改為:

```ts
const takeSnapshot = useCallback(() => {
  if (totalAssets === 0 && netWorth === 0) return;
  const snap = buildSnapshot({
    assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots,
  });
  saveSnapshot(snap);
}, [assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots, saveSnapshot]);
```

4. 自動快照 effect(`AppContext.tsx:206-219`)改為:

```ts
useEffect(() => {
  if (assetsLoading) return;
  if (stockItems.length > 0 && !lastUpdated) return;
  const today = new Date().toISOString().split('T')[0];
  const last = snapshots[snapshots.length - 1];
  if (last?.date === today) return;
  if (totalAssets === 0 && netWorth === 0) return;
  const snap = buildSnapshot({
    assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots,
  });
  saveSnapshot(snap);
}, [lastUpdated, totalAssets, totalLiabilities, netWorth, assetsLoading]); // eslint-disable-line react-hooks/exhaustive-deps
```

5. `ctxValue`(`AppContext.tsx:293-313`)以新操作取代 `setAssets, setLiabilities, setSnapshots`,並加入 `assetsLoading` 與三個 `replace*`;依賴陣列同步更新。

- [ ] **Step 2: 改 page.tsx**

`src/app/page.tsx`:

1. 解構(`page.tsx:33-54`)移除 `setAssets`/`setLiabilities`/`setSnapshots`,改取 `addCategory, updateCategory, removeCategory, addAssetItem, updateAssetItem, removeAssetItem, addLiability, updateLiability, removeLiability, removeSnapshot`。
2. handlers(`page.tsx:99-177`)改寫為薄轉發:

```ts
const handleAddCategory = () => {
  if (!newCategoryName.trim()) return;
  const color = colorOptions[assets.length % colorOptions.length];
  addCategory({
    title: newCategoryName.trim(),
    description: newCategoryDesc.trim() || '自訂資產類別',
    colorClass: color.colorClass, bgClass: color.bgClass,
  });
  setNewCategoryName(''); setNewCategoryDesc(''); setIsAddingCategory(false);
};
const handleUpdateAsset = (categoryId: string, itemId: string, newName: string, newAmount: number) =>
  updateAssetItem(categoryId, itemId, { name: newName, amount: newAmount });
const handleDeleteAsset = removeAssetItem;
const handleUpdateCategory = (id: string, title: string, description: string, colorClass: string, bgClass: string) =>
  updateCategory(id, { title, description, colorClass, bgClass });
const handleDeleteCategory = removeCategory;
const handleAddAsset = addAssetItem;
const handleUpdateLiability = (itemId: string, newName: string, newAmount: number) =>
  updateLiability(itemId, { name: newName, amount: newAmount });
const handleDeleteLiability = removeLiability;
const handleAddLiability = (name: string, amount: number) => addLiability({ name, amount });
```

3. 快照刪除(`page.tsx:372`)改:`onDelete={removeSnapshot}`。

- [ ] **Step 3: 改 settings/page.tsx 與 DataManager.tsx**

兩處 JSON 匯入邏輯中(`settings/page.tsx:101-112`、`DataManager.tsx:53-65`):

```ts
if (data.assets)      void ctx.replaceAssets(data.assets);
if (data.liabilities) void ctx.replaceLiabilities(data.liabilities);
if (data.snapshots)   void ctx.replaceSnapshots(data.snapshots);
```

其餘領域(`setStakingItems`、`setLoans`…)照舊。settings 頁解構同步改名。

- [ ] **Step 4: 改 ImportModal.tsx**

`ImportModal.tsx:406` 解構改為 `const { assets, updateCategory, setStockItems, setCashflowTemplate } = useAppContext();`;`ImportModal.tsx:441` 一帶的 `setAssets(prev => prev.map(cat => ...))`(更新特定分類的 items)改為:先從 `assets` 找到目標分類,組出新 `items` 陣列後呼叫 `updateCategory` — 因 `updateCategory` 的 patch 不含 items,此處需擴充:**將 Task 10 的 `updateCategory` patch 型別放寬為 `Partial<Omit<AssetCategory, 'id'>>`(含 items)**,直接 `updateCategory(catId, { items: newItems })`。

- [ ] **Step 5: 全面驗證**

Run: `npx tsc --noEmit` → 無錯誤(全專案不再引用被移除的 setter)。
Run: `npm test` → 全部 PASS。
Run: `npm run dev` → 訪客模式手動驗證:新增/編輯/刪除資產與負債、快照刪除、設定頁匯入 JSON、重新整理資料仍在(localStorage)。

- [ ] **Step 6: Commit**

```bash
git add src/context/AppContext.tsx src/app/page.tsx src/app/settings/page.tsx src/components/DataManager.tsx src/components/ImportModal.tsx
git commit -m "refactor: 呼叫端改接領域操作,移除資產/負債/快照 setter"
```

---

### Task 12: Navbar 登入 UI

**Files:**
- Modify: `src/components/Navbar.tsx`
- Create: `src/components/AuthButton.tsx`

**Interfaces:**
- Consumes: `useSession`, `signIn`, `signOut`(next-auth/react)
- Produces: `<AuthButton />`(自包含元件,Navbar 右側掛載)

- [ ] **Step 1: 建立 AuthButton**

`src/components/AuthButton.tsx`:

```tsx
"use client";

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, Cloud } from 'lucide-react';

export function AuthButton() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === 'loading') return null;

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <LogIn size={16} />
        <span className="hidden sm:inline">登入</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2">
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="頭像" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <Cloud size={18} className="text-indigo-500" />
        )}
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
            <div className="font-medium text-gray-800 truncate">{session.user?.name}</div>
            <div className="truncate">{session.user?.email}</div>
            <div className="mt-1 text-emerald-600 flex items-center gap-1"><Cloud size={12} />雲端同步中</div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut size={14} />登出
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 掛進 Navbar**

`src/components/Navbar.tsx`:在右側按鈕群(隱私切換按鈕旁)加入 `<AuthButton />`(import 後放置於既有按鈕容器內,樣式跟隨相鄰按鈕)。

- [ ] **Step 3: 手動驗證與 commit**

Run: `npm run dev` → 未登入顯示「登入」;點擊 → Google OAuth → 返回後顯示頭像;選單顯示姓名/Email/「雲端同步中」;登出後回訪客模式且本地資料仍在。

```bash
git add src/components/AuthButton.tsx src/components/Navbar.tsx
git commit -m "feat: Navbar Google 登入按鈕與帳號選單"
```

---

### Task 13: 首次登入匯入流程

**Files:**
- Create: `src/components/ImportPromptModal.tsx`
- Modify: `src/components/ClientLayout.tsx`(掛載)

**Interfaces:**
- Consumes: `useRepositories()`(mode)、`useAppContext()`(`replaceAssets` 等)、`GET /api/user/summary`(Task 6)、`LOCAL_KEYS`/`initialAssets`(Task 9)
- Produces: `<ImportPromptModal />`(自包含;登入後自動判斷是否彈出)

- [ ] **Step 1: 實作 ImportPromptModal**

`src/components/ImportPromptModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { useRepositories, LOCAL_KEYS, initialAssets } from '../context/RepositoryContext';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

/** 本地是否有「非示範預設」的實際資料 */
function hasMeaningfulLocalData(): boolean {
  const assets = readLocal<AssetCategory>(LOCAL_KEYS.assets);
  const liabilities = readLocal<LiabilityItem>(LOCAL_KEYS.liabilities);
  const snapshots = readLocal<AssetSnapshot>(LOCAL_KEYS.snapshots);
  const isDefaultAssets = JSON.stringify(assets) === JSON.stringify(initialAssets);
  return (!isDefaultAssets && assets.length > 0) || liabilities.length > 0 || snapshots.length > 0;
}

export function ImportPromptModal() {
  const { mode } = useRepositories();
  const { replaceAssets, replaceLiabilities, replaceSnapshots } = useAppContext();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [importing, setImporting] = useState(false);
  const [checkedFor, setCheckedFor] = useState<'guest' | 'cloud'>('guest');

  useEffect(() => {
    if (mode !== 'cloud' || checkedFor === 'cloud') return;
    setCheckedFor('cloud');
    (async () => {
      try {
        const res = await fetch('/api/user/summary');
        if (!res.ok) return;
        const summary = await res.json() as { assets: boolean; liabilities: boolean; snapshots: boolean };
        const cloudEmpty = !summary.assets && !summary.liabilities && !summary.snapshots;
        if (cloudEmpty && hasMeaningfulLocalData()) setShow(true);
      } catch { /* 靜默:下次登入再問 */ }
    })();
  }, [mode, checkedFor]);

  if (!show) return null;

  const handleImport = async () => {
    setImporting(true);
    try {
      await replaceAssets(readLocal<AssetCategory>(LOCAL_KEYS.assets));
      await replaceLiabilities(readLocal<LiabilityItem>(LOCAL_KEYS.liabilities));
      await replaceSnapshots(readLocal<AssetSnapshot>(LOCAL_KEYS.snapshots));
      toast('本地資料已匯入帳號');
      setShow(false);
    } catch {
      toast('匯入失敗，請稍後再試', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <CloudUpload className="text-indigo-500" size={20} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">匯入本地資料?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          偵測到這台電腦有既有的資產/負債資料,而你的帳號目前是空的。要把本地資料匯入帳號、開始雲端同步嗎?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            disabled={importing}
          >
            從空帳號開始
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          >
            {importing ? '匯入中…' : '匯入資料'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 掛進 ClientLayout**

`src/components/ClientLayout.tsx` 的 `ClientLayoutContent` return 區塊,`<OnboardingWizard />` 旁加 `<ImportPromptModal />`(import 對應)。

- [ ] **Step 3: 手動驗證與 commit**

驗證劇本:
1. 訪客模式新增一筆自訂資產 → 登入(帳號需為空)→ 出現匯入彈窗 → 確認 → 資產頁顯示本地資料;Neon 資料表出現對應列。
2. 登出 → 訪客資料仍在。
3. 再登入 → 不再彈窗(雲端已有資料),顯示雲端資料。
4. 無痕視窗登入同帳號 → 看到同一份資料(跨裝置同步)。

```bash
git add src/components/ImportPromptModal.tsx src/components/ClientLayout.tsx
git commit -m "feat: 首次登入偵測本地資料並詢問匯入"
```

---

### Task 14: 總驗證與收尾

**Files:**
- Modify: `CLAUDE.md`(若有架構說明章節,補 repository/auth 一段;無則跳過)

- [ ] **Step 1: 全套自動驗證**

```bash
npm test          # 全部 PASS
npx tsc --noEmit  # 無型別錯誤
npm run build     # build 成功
npm run lint      # 無新增 error
```

- [ ] **Step 2: 手動驗收清單(逐項執行)**

1. 訪客模式:資產/負債 CRUD、快照、匯出/匯入 JSON — 行為與改版前一致,無 loading 閃爍。
2. 登入模式:資產 CRUD 後重新整理 → 資料來自雲端;Network 面板可見 `/api/user/assets` 請求。
3. 兩個分頁同時登入,A 分頁改同一筆分類後,B 分頁再改 → B 出現「資料已在其他裝置修改」toast 並重新載入。
4. 未登入直接 `fetch('/api/user/assets')` → 401。
5. 首登匯入流程(Task 13 劇本)。
6. 既有功能迴歸:現金流頁、股票頁、貸款頁、FIRE 頁正常(這些領域仍走 localStorage)。

- [ ] **Step 3: 最終 commit**

```bash
git add -A
git commit -m "chore: Phase 1 雲端同步收尾(文件與驗證)"
```

---

## Self-Review 紀錄

- **Spec 覆蓋**:登入(T3/T12)、DB(T2)、API 細粒度+樂觀鎖(T5/T6)、Repository 兩實作+契約測試(T7/T8)、領域操作+樂觀更新(T10/T11)、首登匯入(T13)、權限隔離測試(T5)、錯誤格式(T4)。Phase 2/3 領域(貸款、股票、現金流)依 spec 續留 localStorage。
- **已知取捨**:(1) Neon HTTP driver 無 transaction,`replaceAll` 非原子 — 已在 T5 註記可接受理由;(2) 快照 `saveSnapshot` 因去重/裁切語意用 replaceAll 同步,單筆刪除仍走細粒度;(3) `updateCategory` patch 型別為 `Partial<Omit<AssetCategory, 'id'>>`(含 `items`,T11 Step 4 的 ImportModal 需要)。
- **型別一致性**:`EntityRepository`(T7)↔ remote(T8)↔ useSyncedCollection(T10);HTTP 契約(T6 Produces)↔ remote repo(T8 fake server);`AssetContextType`(T10)↔ AppContext 轉發(T11)。

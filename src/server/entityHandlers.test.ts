import { vi } from 'vitest';
vi.mock('../auth', () => ({ auth: vi.fn() }));

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

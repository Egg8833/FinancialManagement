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

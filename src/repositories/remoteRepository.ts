import { ConflictError, type EntityRepository } from './types';

async function request(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `API 錯誤(${res.status})`);
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

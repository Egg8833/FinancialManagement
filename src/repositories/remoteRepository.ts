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

  // 同一 id 的寫入依序執行:樂觀鎖需要上一次 PATCH 回傳的新 version,
  // 若並行送出,第二個請求必定帶舊 version 而被誤判為「其他裝置修改」(409)。
  const queues = new Map<string, Promise<unknown>>();
  // 排隊中的 update 只需送出最新一筆(例如拖動滑桿),中間值直接略過。
  const latestUpdateSeq = new Map<string, number>();
  let seq = 0;

  function enqueue<R>(id: string, task: () => Promise<R>): Promise<R> {
    const prev = queues.get(id) ?? Promise.resolve();
    const run = prev.then(task, task);
    const tail = run.catch(() => {});
    queues.set(id, tail);
    void tail.then(() => { if (queues.get(id) === tail) queues.delete(id); });
    return run;
  }

  const itemUrl = (id: string) => `${endpoint}/${encodeURIComponent(id)}`;

  return {
    async getAll() {
      const body = await request(endpoint) as { items: { id: string; data: T; version: number }[] };
      versions.clear();
      for (const row of body.items) versions.set(row.id, row.version);
      return body.items.map(r => r.data);
    },

    create(entity) {
      return enqueue(entity.id, async () => {
        await request(endpoint, { method: 'POST', body: JSON.stringify({ data: entity }) });
        versions.set(entity.id, 1);
      });
    },

    update(entity) {
      const mySeq = ++seq;
      latestUpdateSeq.set(entity.id, mySeq);
      return enqueue(entity.id, async () => {
        if (latestUpdateSeq.get(entity.id) !== mySeq) return; // 已有更新的值排在後面
        const version = versions.get(entity.id) ?? 1;
        const body = await request(itemUrl(entity.id), {
          method: 'PATCH', body: JSON.stringify({ data: entity, version }),
        }) as { version: number };
        versions.set(entity.id, body.version);
      });
    },

    remove(id) {
      latestUpdateSeq.delete(id);
      return enqueue(id, async () => {
        await request(itemUrl(id), { method: 'DELETE' });
        versions.delete(id);
      });
    },

    async replaceAll(entities) {
      // 等所有進行中的單筆寫入結束,避免整批取代後又被舊請求覆寫
      await Promise.all([...queues.values()]);
      latestUpdateSeq.clear();
      await request(endpoint, { method: 'PUT', body: JSON.stringify({ data: entities }) });
      versions.clear();
      for (const e of entities) versions.set(e.id, 1);
    },
  };
}

import { describe, it, expect, vi } from 'vitest';
import { createAppStateStore, type StateEntry } from './appStateStore';
import { ConflictError, type EntityRepository } from '../repositories/types';

function fakeRepo(initial: StateEntry[] = [], opts: { failLoad?: boolean } = {}) {
  const rows = new Map(initial.map(e => [e.id, e]));
  const repo = {
    getAll: vi.fn(async () => { if (opts.failLoad) throw new Error('down'); return [...rows.values()]; }),
    create: vi.fn(async (e: StateEntry) => { rows.set(e.id, e); }),
    update: vi.fn(async (e: StateEntry) => { rows.set(e.id, e); }),
    remove: vi.fn(async () => {}),
    replaceAll: vi.fn(async () => {}),
  } satisfies EntityRepository<StateEntry>;
  return { repo, rows };
}

describe('createAppStateStore', () => {
  it('尚未載入完成:not ready,且拒絕寫入(不會用預設值覆蓋雲端)', async () => {
    const { repo } = fakeRepo([{ id: 'fire', value: { age: 40 } }]);
    const store = createAppStateStore(repo);
    expect(store.getSnapshot().status).toBe('loading');
    expect(await store.setValue('fire', { age: 30 })).toBe(false);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('載入失敗:status=error,仍拒絕寫入', async () => {
    const { repo } = fakeRepo([], { failLoad: true });
    const store = createAppStateStore(repo);
    await store.load();
    expect(store.getSnapshot().status).toBe('error');
    expect(await store.setValue('k', 1)).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('載入後:既有鍵走 update,新鍵走 create', async () => {
    const { repo } = fakeRepo([{ id: 'a', value: 1 }]);
    const store = createAppStateStore(repo);
    await store.load();
    await store.setValue('a', 2);
    await store.setValue('b', 3);
    expect(repo.update).toHaveBeenCalledWith({ id: 'a', value: 2 });
    expect(repo.create).toHaveBeenCalledWith({ id: 'b', value: 3 });
    expect(store.getSnapshot().map).toEqual({ a: 2, b: 3 });
  });

  it('同一新鍵快速寫兩次:只 create 一次,第二次走 update', async () => {
    const { repo } = fakeRepo();
    const store = createAppStateStore(repo);
    await store.load();
    await Promise.all([store.setValue('k', 1), store.setValue('k', 2)]);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith({ id: 'k', value: 2 });
  });

  it('函式型更新連續呼叫:以最新值累加,不會吃掉更新', async () => {
    const { repo } = fakeRepo([{ id: 'n', value: 0 }]);
    const store = createAppStateStore(repo);
    await store.load();
    const inc = (v: unknown) => (v as number) + 1;
    await Promise.all([store.updateValue('n', inc, 0), store.updateValue('n', inc, 0)]);
    expect(store.getSnapshot().map.n).toBe(2);
    expect(repo.update).toHaveBeenLastCalledWith({ id: 'n', value: 2 });
  });

  it('寫入失敗:還原為伺服器最後確認的值', async () => {
    const { repo } = fakeRepo([{ id: 'a', value: 1 }]);
    repo.update.mockRejectedValueOnce(new Error('500'));
    const onError = vi.fn();
    const store = createAppStateStore(repo, { onError });
    await store.load();
    expect(await store.setValue('a', 2)).toBe(false);
    expect(store.getSnapshot().map.a).toBe(1);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('較舊的寫入失敗時,不覆蓋之後較新的值', async () => {
    const { repo } = fakeRepo([{ id: 'a', value: 1 }]);
    let rejectFirst!: (e: unknown) => void;
    repo.update.mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej; }));
    const store = createAppStateStore(repo, { onError: vi.fn() });
    await store.load();
    const p1 = store.setValue('a', 2);
    const p2 = store.setValue('a', 3);
    rejectFirst(new Error('500'));
    await Promise.all([p1, p2]);
    expect(store.getSnapshot().map.a).toBe(3);
  });

  it('ConflictError:呼叫 onConflict 並重新載入', async () => {
    const { repo } = fakeRepo([{ id: 'a', value: 1 }]);
    repo.update.mockRejectedValueOnce(new ConflictError());
    const onConflict = vi.fn();
    const store = createAppStateStore(repo, { onConflict });
    await store.load();
    await store.setValue('a', 2);
    expect(onConflict).toHaveBeenCalledOnce();
    expect(repo.getAll).toHaveBeenCalledTimes(2);
  });

  it('subscribe:狀態變更時通知,且 snapshot 參考會變', async () => {
    const { repo } = fakeRepo();
    const store = createAppStateStore(repo);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    await store.load();
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).not.toBe(before);
  });
});

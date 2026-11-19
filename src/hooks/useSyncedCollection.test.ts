import { describe, it, expect, vi } from 'vitest';
import { applyOptimistic, resolveCollectionView } from './useSyncedCollection';
import { ConflictError, type EntityRepository } from '../repositories/types';

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

describe('resolveCollectionView', () => {
  type R = EntityRepository<Item>;
  const remote = (): R => ({
    getAll: async () => [], create: async () => {}, update: async () => {},
    remove: async () => {}, replaceAll: async () => {},
  });
  const local = (items: Item[]): R => ({ ...remote(), getAllSync: () => items });

  it('資料來源剛從 local 切到 remote(尚未載入):回傳 loading 且不外洩舊 local 資料', () => {
    const localRepo = local([{ id: 'g', name: '訪客資料' }]);
    const remoteRepo = remote();
    const view = resolveCollectionView({ source: localRepo, items: [{ id: 'g', name: '訪客資料' }], status: 'ready' }, remoteRepo);
    expect(view).toEqual({ items: [], loading: true, ready: false });
  });

  it('資料來源與目前 repo 一致且載入完成:ready', () => {
    const remoteRepo = remote();
    const items = [{ id: 'c', name: '雲端' }];
    expect(resolveCollectionView({ source: remoteRepo, items, status: 'ready' }, remoteRepo))
      .toEqual({ items, loading: false, ready: true });
  });

  it('切換到 local repo:同步讀取,立即 ready', () => {
    const remoteRepo = remote();
    const localRepo = local([{ id: 'g', name: '訪客' }]);
    expect(resolveCollectionView({ source: remoteRepo, items: [{ id: 'c', name: '雲端' }], status: 'ready' }, localRepo))
      .toEqual({ items: [{ id: 'g', name: '訪客' }], loading: false, ready: true });
  });

  it('remote 載入失敗:不再 loading,但也不 ready(禁止寫入,避免用空資料覆蓋雲端)', () => {
    const remoteRepo = remote();
    expect(resolveCollectionView({ source: remoteRepo, items: [], status: 'error' }, remoteRepo))
      .toEqual({ items: [], loading: false, ready: false });
  });
});

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

/** items 一律標記「來自哪個 repo」,避免 repo 切換瞬間把舊來源的資料當成新來源的資料。 */
export type CollectionState<T extends { id: string }> = {
  source: EntityRepository<T> | null;
  items: T[];
  status: 'ready' | 'error';
};

export type CollectionView<T> = {
  items: T[];
  /** 正在載入目前 repo 的資料 */
  loading: boolean;
  /** items 確實屬於目前 repo 且載入成功;只有 ready 時才允許寫入 */
  ready: boolean;
};

export function resolveCollectionView<T extends { id: string }>(
  state: CollectionState<T>,
  repo: EntityRepository<T>,
): CollectionView<T> {
  if (state.source !== repo) {
    // local repo 可同步讀取,切換當下即可正確呈現
    if (repo.getAllSync) return { items: repo.getAllSync(), loading: false, ready: true };
    // remote repo 尚未載入:絕不外洩舊來源(例如訪客 localStorage)的資料
    return { items: [], loading: true, ready: false };
  }
  if (state.status === 'error') return { items: [], loading: false, ready: false };
  return { items: state.items, loading: false, ready: true };
}

export function useSyncedCollection<T extends { id: string }>(
  repo: EntityRepository<T>,
  onError: (e: unknown, reload: () => void) => void,
  onLoadError?: (e: unknown) => void,
) {
  const [state, setState] = useState<CollectionState<T>>(() => (
    repo.getAllSync
      ? { source: repo, items: repo.getAllSync(), status: 'ready' }
      : { source: null, items: [], status: 'ready' }
  ));
  const { items, loading, ready } = resolveCollectionView(state, repo);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const repoRef = useRef(repo);
  repoRef.current = repo;

  const reload = useCallback(() => {
    if (repo.getAllSync) {
      setState({ source: repo, items: repo.getAllSync(), status: 'ready' });
      return;
    }
    repo.getAll()
      .then(data => { if (repoRef.current === repo) setState({ source: repo, items: data, status: 'ready' }); })
      .catch(() => {});
  }, [repo]);

  useEffect(() => {
    if (repo.getAllSync) {
      // local repo:資料已同步可得,無需 loading 狀態(訪客模式行為與改版前完全相同)
      setState({ source: repo, items: repo.getAllSync(), status: 'ready' });
      return;
    }
    let alive = true;
    repo.getAll()
      .then(data => { if (alive) setState({ source: repo, items: data, status: 'ready' }); })
      .catch(e => {
        if (!alive) return;
        setState({ source: repo, items: [], status: 'error' });
        onLoadError?.(e);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const apply = useCallback((next: T[], persist: (repo: EntityRepository<T>) => Promise<void>) => {
    // 資料尚未屬於目前 repo(載入中/載入失敗)時拒絕寫入:
    // next 是以過期 items 算出來的,寫進去可能覆蓋掉雲端的真實資料。
    if (!readyRef.current) return;
    void applyOptimistic({
      prev: itemsRef.current, next,
      setState: (v) => {
        // repo 已切換(例如持久化途中登出)就不要把舊 repo 的結果寫回畫面
        if (repoRef.current === repo) setState({ source: repo, items: v, status: 'ready' });
      },
      persist: () => persist(repo),
      onError: (e) => onError(e, reload),
    });
  }, [repo, onError, reload]);

  const replace = useCallback(async (data: T[]) => {
    await repo.replaceAll(data);
    if (repoRef.current === repo) setState({ source: repo, items: data, status: 'ready' });
  }, [repo]);

  return { items, loading, ready, apply, replace };
}

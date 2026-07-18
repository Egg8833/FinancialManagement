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
  onLoadError?: (e: unknown) => void,
) {
  const [items, setItems] = useState<T[]>(() => repo.getAllSync?.() ?? []);
  const [loading, setLoading] = useState(() => !repo.getAllSync);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const reload = useCallback(() => {
    if (repo.getAllSync) {
      setItems(repo.getAllSync());
      return;
    }
    repo.getAll().then(setItems).catch(() => {});
  }, [repo]);

  useEffect(() => {
    if (repo.getAllSync) {
      // local repo:資料已同步可得,無需 loading 狀態(訪客模式行為與改版前完全相同)
      setItems(repo.getAllSync());
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    repo.getAll()
      .then(data => { if (alive) { setItems(data); setLoading(false); } })
      .catch(e => { if (alive) { setLoading(false); onLoadError?.(e); } });
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

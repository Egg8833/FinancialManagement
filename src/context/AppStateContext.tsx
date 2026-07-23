"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRepositories } from './RepositoryContext';
import { createRemoteRepository } from '../repositories/remoteRepository';
import { ConflictError } from '../repositories/types';
import { useToast } from './ToastContext';

/** 通用鍵值狀態：對應 /api/user/state 的一列（id = 設定鍵名，value = 任意形狀） */
export interface StateEntry {
  id: string;
  value: unknown;
}

interface AppStateContextType {
  /** 雲端模式下，是否已完成一次性批次拉取；訪客模式恆為 true */
  ready: boolean;
  getValue: (key: string) => unknown;
  /** 樂觀更新 + 背景持久化；永不 reject（失敗時已處理回滾與提示），回傳是否成功供需要時 await */
  setValue: (key: string, value: unknown) => Promise<boolean>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function useAppStateContext() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppStateContext must be used within AppStateProvider');
  return ctx;
}

/**
 * 雲端模式下，登入後一次性拉取所有 app_state 列（貸款、股票、現金流、目標、FIRE 設定…）
 * 存成一個 Map，並提供樂觀更新的 getValue/setValue。訪客模式完全不啟用（ready 恆為 true，
 * map 恆為空），各網域改由 useSyncedState 內部走原本的 localStorage 路徑。
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const { mode } = useRepositories();
  const { toast } = useToast();
  const repo = useMemo(() => createRemoteRepository<StateEntry>('/api/user/state'), []);

  const [map, setMap] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(mode !== 'cloud');
  const existingKeysRef = useRef<Set<string>>(new Set());
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (mode !== 'cloud') {
      setMap({});
      existingKeysRef.current = new Set();
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    repo.getAll()
      .then(entries => {
        if (!alive) return;
        const next: Record<string, unknown> = {};
        const keys = new Set<string>();
        for (const entry of entries) { next[entry.id] = entry.value; keys.add(entry.id); }
        existingKeysRef.current = keys;
        setMap(next);
        setReady(true);
      })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [mode, repo]);

  const getValue = useCallback((key: string) => map[key], [map]);

  const reload = useCallback(() => {
    repo.getAll().then(entries => {
      const next: Record<string, unknown> = {};
      const keys = new Set<string>();
      for (const entry of entries) { next[entry.id] = entry.value; keys.add(entry.id); }
      existingKeysRef.current = keys;
      setMap(next);
    }).catch(() => {});
  }, [repo]);

  const setValue = useCallback((key: string, value: unknown): Promise<boolean> => {
    const prevMap = mapRef.current;
    setMap(m => ({ ...m, [key]: value }));

    const entry: StateEntry = { id: key, value };
    const isNew = !existingKeysRef.current.has(key);
    const persist = isNew ? repo.create(entry) : repo.update(entry);
    existingKeysRef.current.add(key);

    return persist.then(
      () => true,
      (e: unknown) => {
        setMap(prevMap);
        existingKeysRef.current.delete(key);
        if (e instanceof ConflictError) {
          toast('資料已在其他裝置修改，已重新載入', 'error');
          reload();
        } else {
          toast('儲存失敗，變更已還原', 'error');
        }
        return false;
      },
    );
  }, [repo, toast, reload]);

  const value = useMemo(() => ({ ready, getValue, setValue }), [ready, getValue, setValue]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

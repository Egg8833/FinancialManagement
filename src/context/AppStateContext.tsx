"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useRepositories } from './RepositoryContext';
import { createRemoteRepository } from '../repositories/remoteRepository';
import { createAppStateStore, type AppStateSnapshot, type StateEntry } from '../lib/appStateStore';
import { useToast } from './ToastContext';

export type { StateEntry };

interface AppStateContextType {
  /** 雲端模式下,是否已成功載入雲端資料;訪客模式恆為 true。未 ready 時所有寫入都會被拒絕。 */
  ready: boolean;
  getValue: (key: string) => unknown;
  /** 樂觀更新 + 背景持久化;永不 reject(失敗時已處理還原與提示),回傳是否成功 */
  setValue: (key: string, value: unknown) => Promise<boolean>;
  /** 函式型更新:以「最新」值(含尚未完成的樂觀更新)為基礎計算,連續呼叫不會吃掉更新 */
  updateValue: (key: string, updater: (prev: unknown) => unknown, defaultValue: unknown) => Promise<boolean>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function useAppStateContext() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppStateContext must be used within AppStateProvider');
  return ctx;
}

const GUEST_SNAPSHOT: AppStateSnapshot = { status: 'ready', map: {} };
const noopSubscribe = () => () => {};

/**
 * 雲端模式下,登入後一次性拉取所有 app_state 列(貸款、股票、現金流、目標、FIRE 設定…)。
 * 每次進入雲端模式都建立新的 store(初始為 loading),所以「剛從訪客切到雲端」的那一輪 render
 * 也會正確回報 not ready,不會把訪客/預設值當成雲端資料或寫回雲端。
 * 訪客模式不啟用(ready 恆為 true、map 恆為空),各網域改由 useSyncedState 走 localStorage。
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const { mode } = useRepositories();
  const { toast } = useToast();

  const store = useMemo(() => (
    mode === 'cloud'
      ? createAppStateStore(createRemoteRepository<StateEntry>('/api/user/state'), {
          onConflict: () => toast('資料已在其他裝置修改，已重新載入', 'error'),
          onError: () => toast('儲存失敗，變更已還原', 'error'),
        })
      : null
  ), [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- toast 為穩定參考

  useEffect(() => {
    if (!store) return;
    void store.load().then(() => {
      if (store.getSnapshot().status === 'error') toast('載入雲端資料失敗，請重新整理頁面', 'error');
    });
  }, [store, toast]);

  const snapshot = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : () => GUEST_SNAPSHOT,
    () => GUEST_SNAPSHOT,
  );

  const ready = snapshot.status === 'ready';
  const map = snapshot.map;
  const getValue = useCallback((key: string) => map[key], [map]);
  const setValue = useCallback(
    (key: string, value: unknown) => (store ? store.setValue(key, value) : Promise.resolve(false)),
    [store],
  );
  const updateValue = useCallback(
    (key: string, updater: (prev: unknown) => unknown, defaultValue: unknown) =>
      (store ? store.updateValue(key, updater, defaultValue) : Promise.resolve(false)),
    [store],
  );

  const value = useMemo(
    () => ({ ready, getValue, setValue, updateValue }),
    [ready, getValue, setValue, updateValue],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

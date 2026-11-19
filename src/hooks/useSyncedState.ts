"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useStickyState } from './useStickyState';
import { useRepositories } from '../context/RepositoryContext';
import { useAppStateContext } from '../context/AppStateContext';

/**
 * 取代 useStickyState 的雲端感知版本，對外簽名完全相同（[value, setValue]）。
 * 訪客模式：行為與 useStickyState 完全一致（同步讀寫 localStorage）。
 * 登入模式：透過 AppStateContext 讀寫 /api/user/state 底下對應的 key，
 *   樂觀更新、失敗自動回滾，呼叫端不需要處理任何非同步邏輯。
 *   雲端資料尚未載入完成時，寫入會被拒絕（避免用預設值覆蓋雲端資料）。
 *
 * 回傳的 setValue 參考穩定（同一模式下不會每次 render 都變），可安全放進 useEffect 依賴；
 * 函式型更新以最新值為基礎，連續呼叫不會吃掉更新。
 *
 * localStorageKey 必須沿用該欄位既有的 localStorage key，讓訪客模式資料不受影響；
 * key 則是雲端 app_state 表的設定鍵名，可與 localStorageKey 不同。
 */
export function useSyncedState<T>(
  key: string,
  defaultValue: T,
  localStorageKey: string,
): [T, Dispatch<SetStateAction<T>>] {
  const { mode } = useRepositories();
  const [localValue, setLocalValue] = useStickyState<T>(defaultValue, localStorageKey);
  const { getValue, updateValue } = useAppStateContext();

  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const setCloudValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    void updateValue(
      key,
      prev => (typeof next === 'function' ? (next as (p: T) => T)(prev as T) : next),
      defaultRef.current,
    );
  }, [key, updateValue]);

  if (mode !== 'cloud') return [localValue, setLocalValue];

  const rawValue = getValue(key);
  const value = (rawValue === undefined ? defaultValue : rawValue) as T;
  return [value, setCloudValue];
}

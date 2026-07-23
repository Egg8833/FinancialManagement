"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useStickyState } from './useStickyState';
import { useRepositories } from '../context/RepositoryContext';
import { useAppStateContext } from '../context/AppStateContext';

/**
 * 取代 useStickyState 的雲端感知版本，對外簽名完全相同（[value, setValue]）。
 * 訪客模式：行為與 useStickyState 完全一致（同步讀寫 localStorage）。
 * 登入模式：透過 AppStateContext 讀寫 /api/user/state 底下對應的 key，
 *   樂觀更新、失敗自動回滾，呼叫端不需要處理任何非同步邏輯。
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
  const local = useStickyState<T>(defaultValue, localStorageKey);
  const cloud = useAppStateContext();

  if (mode !== 'cloud') return local;

  const rawValue = cloud.getValue(key);
  const value = (rawValue === undefined ? defaultValue : rawValue) as T;

  const setValue: Dispatch<SetStateAction<T>> = (next) => {
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
    cloud.setValue(key, resolved);
  };

  return [value, setValue];
}

"use client";

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

function readFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function useStickyState<T>(defaultValue: T, key: string): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readFromStorage(key, defaultValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable
    }
  }, [key, value]);

  return [value, setValue];
}

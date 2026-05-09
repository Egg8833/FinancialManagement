"use client";

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export function useStickyState<T>(defaultValue: T, key: string): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stickyValue = window.localStorage.getItem(key);
    if (stickyValue !== null) {
      try {
        setValue(JSON.parse(stickyValue));
      } catch (e) {
        console.error("Error parsing sticky state", e);
      }
    }
    setIsInitialized(true);
  }, [key]);

  // Sync to localStorage on change, but only after initialization
  useEffect(() => {
    if (isInitialized) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value, isInitialized]);

  return [value, setValue];
}

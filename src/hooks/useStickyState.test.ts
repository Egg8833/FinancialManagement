import { describe, it, expect, beforeEach } from 'vitest';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

function readFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = (window.localStorage as typeof localStorageMock).getItem(key);
    return item !== null ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  (global as Record<string, unknown>).window = { localStorage: localStorageMock };
});

describe('readFromStorage', () => {
  it('returns defaultValue when key not in storage', () => {
    expect(readFromStorage('missing', 42)).toBe(42);
  });

  it('returns parsed value when key exists', () => {
    localStorageMock.setItem('mykey', JSON.stringify({ x: 1 }));
    expect(readFromStorage('mykey', null)).toEqual({ x: 1 });
  });

  it('returns defaultValue when stored value is invalid JSON', () => {
    localStorageMock.setItem('badkey', 'not-json{');
    expect(readFromStorage('badkey', 'default')).toBe('default');
  });

  it('returns defaultValue array when key missing', () => {
    expect(readFromStorage('arr', [])).toEqual([]);
  });
});

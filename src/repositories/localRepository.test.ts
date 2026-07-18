import { beforeEach, describe, it, expect } from 'vitest';
import { runRepositoryContract } from './repositoryContract';
import { createLocalRepository } from './localRepository';

const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

runRepositoryContract('localRepository', async () =>
  createLocalRepository<{ id: string; name: string }>('test-key', []));

describe('localRepository 預設值', () => {
  it('localStorage 無資料時 getAll 回傳 defaultValue', async () => {
    const repo = createLocalRepository('empty-key', [{ id: 'd', name: '預設' }]);
    expect(await repo.getAll()).toEqual([{ id: 'd', name: '預設' }]);
  });
});

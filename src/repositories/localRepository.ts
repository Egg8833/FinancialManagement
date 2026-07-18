import type { EntityRepository } from './types';

export function createLocalRepository<T extends { id: string }>(
  storageKey: string,
  defaultValue: T[],
): EntityRepository<T> {
  const read = (): T[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T[]) : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  const write = (items: T[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* storage full */ }
  };

  return {
    async getAll() { return read(); },
    async create(entity) { write([...read(), entity]); },
    async update(entity) { write(read().map(i => (i.id === entity.id ? entity : i))); },
    async remove(id) { write(read().filter(i => i.id !== id)); },
    async replaceAll(entities) { write(entities); },
    getAllSync() { return read(); },
  };
}

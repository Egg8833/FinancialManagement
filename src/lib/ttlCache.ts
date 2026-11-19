/**
 * 有上限的 TTL 快取(LRU 淘汰)。用於伺服器端代理外部 API 的結果,
 * 避免任意輸入讓記憶體無限成長。過期項目仍可讀取(fresh=false),供上游失敗時回傳舊資料。
 */
export function createTtlCache<V>({ maxEntries, ttlMs }: { maxEntries: number; ttlMs: number }) {
  const map = new Map<string, { value: V; expiresAt: number }>();

  return {
    get(key: string): { value: V; fresh: boolean } | undefined {
      const entry = map.get(key);
      if (!entry) return undefined;
      // 重新插入以標記為最近使用
      map.delete(key);
      map.set(key, entry);
      return { value: entry.value, fresh: Date.now() < entry.expiresAt };
    },
    set(key: string, value: V) {
      map.delete(key);
      map.set(key, { value, expiresAt: Date.now() + ttlMs });
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value as string;
        map.delete(oldest);
      }
    },
    size: () => map.size,
  };
}

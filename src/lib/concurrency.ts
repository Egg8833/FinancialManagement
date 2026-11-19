/**
 * 以固定並行數處理所有項目。每個項目都會被處理(某項失敗不會中斷其他項),
 * 全部結束後若有任何失敗,拋出第一個錯誤。
 */
export async function forEachWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const errors: unknown[] = [];
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch (e) { errors.push(e); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (errors.length > 0) throw errors[0];
}

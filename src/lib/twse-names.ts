// Shared cache for Taiwan stock Chinese names (covers TWSE listed + OTC)
type NameMap = Map<string, string>;

let cache: NameMap | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchTwseNames(): Promise<NameMap> {
  const map: NameMap = new Map();

  // 上市 (TWSE listed) — 公司簡稱
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data: { 公司代號: string; 公司簡稱: string }[] = await res.json();
      for (const item of data) {
        if (item.公司代號 && item.公司簡稱) {
          map.set(item.公司代號.trim(), item.公司簡稱.trim());
        }
      }
    }
  } catch { /* ignore, fallback below */ }

  // 補充：TWSE STOCK_DAY_ALL 涵蓋上市 + 上櫃，用 Name 欄位補齊未命中的代號
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data: { Code: string; Name: string }[] = await res.json();
      for (const item of data) {
        if (item.Code && item.Name && !map.has(item.Code.trim())) {
          map.set(item.Code.trim(), item.Name.trim());
        }
      }
    }
  } catch { /* ignore */ }

  return map;
}

export async function getStockNameMap(): Promise<NameMap> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  cache = await fetchTwseNames();
  cacheTime = Date.now();
  return cache;
}

export async function getChineseName(code: string): Promise<string | null> {
  const map = await getStockNameMap();
  return map.get(code.trim()) ?? null;
}

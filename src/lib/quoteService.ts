import YahooFinance from 'yahoo-finance2';
import { getStockNameMap } from './twse-names';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export type QuoteResult = Record<string, { price: number; changePercent: number; currency: string; shortName?: string }>;

const CACHE_TTL_MS = 60_000;
const quoteCache = new Map<string, { data: QuoteResult; expiresAt: number }>();
const inflightMap = new Map<string, Promise<QuoteResult>>();

async function fetchQuotes(symbols: string[]): Promise<QuoteResult> {
  const hasTW = symbols.some(s => s.endsWith('.TW') || s.endsWith('.TWO'));
  const nameMap = hasTW ? await getStockNameMap() : null;
  const quotes = await yf.quote(symbols, { return: 'object' });

  const result: QuoteResult = {};
  for (const [symbol, quote] of Object.entries(quotes)) {
    let shortName = quote.shortName ?? quote.longName ?? undefined;

    if (nameMap && (symbol.endsWith('.TW') || symbol.endsWith('.TWO'))) {
      const code = symbol.replace(/\.(TWO|TW)$/, '');
      const chineseName = nameMap.get(code);
      if (chineseName) shortName = chineseName;
    }

    result[symbol] = {
      price: quote.regularMarketPrice ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      currency: quote.currency ?? 'USD',
      shortName,
    };
  }
  return result;
}

/**
 * 60 秒快取 + 同批 symbols 進行中請求共用同一個 Promise。
 * 查詢失敗時若有舊快取,回傳舊資料並標記 stale:true;沒有快取則把錯誤往外丟。
 */
export async function getQuotes(symbols: string[]): Promise<{ data: QuoteResult; stale: boolean }> {
  const cacheKey = [...symbols].sort().join(',');

  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { data: cached.data, stale: false };
  }

  const existing = inflightMap.get(cacheKey);
  if (existing) {
    return { data: await existing, stale: false };
  }

  const fetchPromise = fetchQuotes(symbols);
  inflightMap.set(cacheKey, fetchPromise);

  try {
    const result = await fetchPromise;
    quoteCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return { data: result, stale: false };
  } catch (error) {
    const stale = quoteCache.get(cacheKey);
    if (stale) return { data: stale.data, stale: true };
    throw error;
  } finally {
    inflightMap.delete(cacheKey);
  }
}

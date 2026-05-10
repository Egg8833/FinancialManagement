import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getStockNameMap } from '../../../lib/twse-names';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

type QuoteResult = Record<string, { price: number; changePercent: number; currency: string; shortName?: string }>;

const CACHE_TTL_MS = 60_000;
const quoteCache = new Map<string, { data: QuoteResult; expiresAt: number }>();
const inflightMap = new Map<string, Promise<QuoteResult>>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  const cacheKey = [...symbols].sort().join(',');

  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  // 若同一批 symbols 已有進行中的請求，共用同一個 Promise 避免重複打 Yahoo Finance
  const existing = inflightMap.get(cacheKey);
  if (existing) {
    return NextResponse.json(await existing);
  }

  const fetchPromise = (async (): Promise<QuoteResult> => {
    // 判斷是否有台股，預先取得中文名稱 map（只呼叫一次，有快取）
    const hasTW = symbols.some(s => s.endsWith('.TW') || s.endsWith('.TWO'));
    const nameMap = hasTW ? await getStockNameMap() : null;
    const quotes = await yf.quote(symbols, { return: 'object' });

    const result: QuoteResult = {};
    for (const [symbol, quote] of Object.entries(quotes)) {
      let shortName = quote.shortName ?? quote.longName ?? undefined;

      // 台股：用 TWSE/TPEx 中文簡稱覆蓋 Yahoo 英文名
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
  })();

  inflightMap.set(cacheKey, fetchPromise);

  try {
    const result = await fetchPromise;
    quoteCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching quotes:', message);
    return NextResponse.json({ error: 'Failed to fetch quotes', details: message }, { status: 500 });
  } finally {
    inflightMap.delete(cacheKey);
  }
}

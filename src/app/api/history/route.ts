import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { createTtlCache } from '../../../lib/ttlCache';
import { isValidSymbol, DATE_RE } from '../../../lib/symbolValidation';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CACHE_TTL_MS = 5 * 60_000;
const historyCache = createTtlCache<unknown>({ maxEntries: 300, ttlMs: CACHE_TTL_MS });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const period1 = searchParams.get('period1');
  const period2 = searchParams.get('period2') ?? new Date().toISOString().slice(0, 10);

  if (!symbol || !period1) {
    return NextResponse.json({ error: 'Missing symbol or period1' }, { status: 400 });
  }
  if (!isValidSymbol(symbol) || !DATE_RE.test(period1) || !DATE_RE.test(period2)) {
    return NextResponse.json({ error: 'Invalid symbol or date (use YYYY-MM-DD)' }, { status: 400 });
  }

  const cacheKey = `${symbol}:${period1}:${period2}`;
  const cached = historyCache.get(cacheKey);
  if (cached?.fresh) {
    return NextResponse.json(cached.value);
  }

  try {
    const history = await yf.historical(symbol, { period1, period2, interval: '1d' });
    const data = history.map(row => ({
      date: row.date.toISOString().slice(0, 10),
      close: row.adjClose ?? row.close,
    }));
    historyCache.set(cacheKey, data);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error fetching history:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

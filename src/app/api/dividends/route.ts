import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { createTtlCache } from '../../../lib/ttlCache';
import { isValidSymbol, DATE_RE } from '../../../lib/symbolValidation';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

type DividendEntry = { date: string; dividendPerShare: number };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = createTtlCache<DividendEntry[]>({ maxEntries: 300, ttlMs: CACHE_TTL_MS });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const from = searchParams.get('from') ?? '2020-01-01';

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }
  if (!isValidSymbol(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  if (!DATE_RE.test(from)) {
    return NextResponse.json({ error: 'Invalid from date. Use YYYY-MM-DD format.' }, { status: 400 });
  }

  const cacheKey = `${symbol}:${from}`;
  const cached = cache.get(cacheKey);
  if (cached?.fresh) {
    return NextResponse.json(cached.value);
  }

  try {
    const history = await yf.historical(symbol, {
      period1: from,
      events: 'dividends',
    });

    const dividends: DividendEntry[] = (history as any[])
      .filter(h => typeof h.dividends === 'number' && h.dividends > 0)
      .map(h => ({
        date: (h.date instanceof Date ? h.date : new Date(h.date)).toISOString().split('T')[0],
        dividendPerShare: h.dividends as number,
      }));

    cache.set(cacheKey, dividends);
    return NextResponse.json(dividends);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching dividends:', message);
    return NextResponse.json({ error: 'Failed to fetch dividends' }, { status: 500 });
  }
}

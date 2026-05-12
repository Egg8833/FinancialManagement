import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CACHE_TTL_MS = 5 * 60_000;
const historyCache = new Map<string, { data: unknown; expiresAt: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const period1 = searchParams.get('period1');
  const period2 = searchParams.get('period2') ?? new Date().toISOString().slice(0, 10);

  if (!symbol || !period1) {
    return NextResponse.json({ error: 'Missing symbol or period1' }, { status: 400 });
  }

  const cacheKey = `${symbol}:${period1}:${period2}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const history = await yf.historical(symbol, { period1, period2, interval: '1d' });
    const data = history.map(row => ({
      date: row.date.toISOString().slice(0, 10),
      close: row.adjClose ?? row.close,
    }));
    historyCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch history', details: message }, { status: 500 });
  }
}

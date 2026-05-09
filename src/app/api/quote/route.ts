import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const quotes = await yf.quote(symbols, { return: 'object' });

    const result: Record<string, { price: number; changePercent: number; currency: string; shortName?: string }> = {};
    for (const [symbol, quote] of Object.entries(quotes)) {
      result[symbol] = {
        price: quote.regularMarketPrice ?? 0,
        changePercent: quote.regularMarketChangePercent ?? 0,
        currency: quote.currency ?? 'USD',
        shortName: quote.shortName ?? quote.longName ?? undefined,
      };
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching quotes:', message);
    return NextResponse.json({ error: 'Failed to fetch quotes', details: message }, { status: 500 });
  }
}

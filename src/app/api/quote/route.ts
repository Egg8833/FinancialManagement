import { NextResponse } from 'next/server';
import { getQuotes } from '../../../lib/quoteService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const { data, stale } = await getQuotes(symbols);
    return NextResponse.json(stale ? { ...data, _stale: true } : data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching quotes:', message);
    return NextResponse.json({ error: 'Failed to fetch quotes', details: message }, { status: 500 });
  }
}

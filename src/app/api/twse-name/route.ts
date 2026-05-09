import { NextResponse } from 'next/server';

type TwseStock = { 公司代號: string; 公司名稱: string; 公司簡稱: string };

let cache: Map<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getStockMap(): Promise<Map<string, string>> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const res = await fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L', {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`TWSE API error: ${res.status}`);

  const data: TwseStock[] = await res.json();
  const map = new Map<string, string>();
  for (const item of data) {
    if (item.公司代號 && item.公司簡稱) {
      map.set(item.公司代號.trim(), item.公司簡稱.trim());
    }
  }

  cache = map;
  cacheTime = Date.now();
  return map;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim();

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  try {
    const map = await getStockMap();
    const name = map.get(code);
    return NextResponse.json({ name: name ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

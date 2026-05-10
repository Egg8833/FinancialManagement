import { NextResponse } from 'next/server';
import { getChineseName } from '../../../lib/twse-names';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim();

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  try {
    const name = await getChineseName(code);
    return NextResponse.json({ name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

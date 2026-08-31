export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getDb } from '../../../../db/client';
import { computeUserReport } from '../../../../server/reportEngine';
import { sendEmail } from '../../../../lib/mail';
import { runDailyCheck } from '../../../../server/dailyCheck';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const summary = await runDailyCheck({ getDb, computeUserReport, sendEmail });
  return NextResponse.json(summary);
}

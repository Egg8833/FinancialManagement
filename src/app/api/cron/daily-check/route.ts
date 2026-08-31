export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getDb } from '../../../../db/client';
import { computeUserReport } from '../../../../server/reportEngine';
import { sendEmail } from '../../../../lib/mail';
import { runDailyCheck } from '../../../../server/dailyCheck';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const summary = await runDailyCheck({ getDb, computeUserReport, sendEmail });
  return NextResponse.json(summary);
}

export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getDb } from '../../../../db/client';
import { computeUserReport } from '../../../../server/reportEngine';
import { sendEmail } from '../../../../lib/mail';
import { runDailyCheck } from '../../../../server/dailyCheck';
import { isAuthorizedCron } from '../../../../server/cronAuth';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }
  if (!isAuthorizedCron(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const summary = await runDailyCheck({ getDb, computeUserReport, sendEmail });
  return NextResponse.json(summary);
}

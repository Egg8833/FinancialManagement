import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// route.ts imports the real getDb/computeUserReport/sendEmail; mock them so this
// test never touches a real DB connection or SMTP, and to isolate the auth branch.
vi.mock('../../../../db/client', () => ({
  getDb: vi.fn(),
}));
vi.mock('../../../../server/reportEngine', () => ({
  computeUserReport: vi.fn(),
}));
vi.mock('../../../../lib/mail', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('../../../../server/dailyCheck', () => ({
  runDailyCheck: vi.fn(),
}));

import { GET } from './route';
import { runDailyCheck } from '../../../../server/dailyCheck';

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.mocked(runDailyCheck).mockReset();
  vi.mocked(runDailyCheck).mockResolvedValue({ processed: 0, reportsSent: 0, alertsSent: 0, failures: [] });
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/cron/daily-check', { headers });
}

describe('GET /api/cron/daily-check', () => {
  it('CRON_SECRET 未設定時回傳 500,且不執行 runDailyCheck(不可 fail-open)', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest('Bearer undefined'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'not_configured' });
    expect(runDailyCheck).not.toHaveBeenCalled();
  });

  it('CRON_SECRET 已設定但 header 缺少時回傳 401', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(runDailyCheck).not.toHaveBeenCalled();
  });

  it('CRON_SECRET 已設定但 header 不符時回傳 401', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    expect(runDailyCheck).not.toHaveBeenCalled();
  });

  it('header 為 Bearer <secret> 時通過驗證並呼叫 runDailyCheck', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = await GET(makeRequest('Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(runDailyCheck).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toEqual({ processed: 0, reportsSent: 0, alertsSent: 0, failures: [] });
  });
});

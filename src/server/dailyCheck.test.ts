import { describe, it, expect, vi, beforeEach } from 'vitest';

// entityStore.ts -> apiHelpers.ts imports ../auth (next-auth), which fails to resolve
// under vitest's module graph; mock it out as entityStore.test.ts already does.
vi.mock('../auth', () => ({
  auth: vi.fn(),
}));

import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { runDailyCheck } from './dailyCheck';
import type { UserReportResult } from './reportEngine';

const appStateStore = createEntityStore(appState);
let db: Db;

const baseReport = (overrides: Partial<UserReportResult> = {}): UserReportResult => ({
  reportPayload: {
    totalAssets: 0, totalLiabilities: 0, netWorth: 0,
    totalMonthlyIncome: 0, totalMonthlyExpense: 0, monthlyNetCashFlow: 0,
    usdToTwd: 32, combinedAssets: [], combinedLiabilities: [], loans: [], stakingItems: [], stockItems: [],
    generatedAt: new Date().toISOString(),
  },
  pledgeAlert: null,
  reportSchedule: 'none',
  lastReportSent: '',
  pledgeAlertLastSent: { warning: '', danger: '' },
  ...overrides,
});

beforeEach(async () => {
  db = await createTestDb();
});

describe('runDailyCheck', () => {
  it('沒有使用者時 processed 為 0', async () => {
    const sendEmail = vi.fn();
    const summary = await runDailyCheck({
      getDb: () => db, sendEmail, computeUserReport: vi.fn(),
    });
    expect(summary).toEqual({ processed: 0, reportsSent: 0, alertsSent: 0, failures: [] });
  });

  it('reportSchedule=weekly 且今天是週一時寄送報表,並把 lastReportSent 寫回 appState', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });
    const monday = new Date('2026-08-31T01:00:00Z'); // 2026-08-31 為週一
    vi.useFakeTimers();
    vi.setSystemTime(monday);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'weekly' }),
    });

    expect(summary).toEqual({ processed: 1, reportsSent: 1, alertsSent: 0, failures: [] });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('u1@test.local');

    const rows = await appStateStore.getAll(db, 'u1');
    const lastReportSent = rows.find(r => r.id === 'lastReportSent');
    expect((lastReportSent?.data as { value: string }).value).toBe('2026-08-31');
    vi.useRealTimers();
  });

  it('今天已經寄過(lastReportSent = 今天)就不會重複寄送', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn();
    const monday = new Date('2026-08-31T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(monday);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'weekly', lastReportSent: '2026-08-31' }),
    });

    expect(summary.reportsSent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('有質押警示且今天該等級尚未寄過時寄送警示信,並寫回 pledgeAlertLastSent', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({
        pledgeAlert: { level: 'danger', platform: '元大', ratio: 150, pledgeData: [{ platform: '元大', ratio: 150, borrowValue: 100, collateralValue: 150 }] },
      }),
    });

    expect(summary.alertsSent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const rows = await appStateStore.getAll(db, 'u1');
    const pledgeAlertLastSent = rows.find(r => r.id === 'pledgeAlertLastSent');
    expect((pledgeAlertLastSent?.data as { value: Record<string, string> }).value.danger).toBeTruthy();
  });

  it('沒有 email 的使用者會被跳過,不計入失敗', async () => {
    const db2 = await createTestDb();
    await db2.insert((await import('../db/schema')).users).values({ id: 'no-email' });
    const sendEmail = vi.fn();
    const summary = await runDailyCheck({
      getDb: () => db2, sendEmail, computeUserReport: vi.fn(),
    });
    expect(summary).toEqual({ processed: 1, reportsSent: 0, alertsSent: 0, failures: [] });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('單一使用者 computeUserReport 拋錯不影響其他使用者,記錄到 failures 並印出 console.error', async () => {
    await createTestUser(db, 'bad');
    await createTestUser(db, 'good');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });
    const monday = new Date('2026-08-31T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(monday);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async (_db, userId) => {
        if (userId === 'bad') throw new Error('quote api down');
        return baseReport({ reportSchedule: 'weekly' });
      },
    });

    expect(summary.processed).toBe(2);
    expect(summary.reportsSent).toBe(1);
    expect(summary.failures).toEqual([{ userId: 'bad', error: 'quote api down' }]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bad'), expect.any(Error));
    vi.useRealTimers();
    errorSpy.mockRestore();
  });

  it('reportSchedule=monthly 且今天是 1 號時寄送報表', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });
    const firstOfMonth = new Date('2026-09-01T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(firstOfMonth);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'monthly' }),
    });

    expect(summary.reportsSent).toBe(1);
    vi.useRealTimers();
  });

  it('reportSchedule=monthly 但今天不是 1 號時不寄送', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn();
    const midMonth = new Date('2026-09-15T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(midMonth);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'monthly' }),
    });

    expect(summary.reportsSent).toBe(0);
    vi.useRealTimers();
  });
});

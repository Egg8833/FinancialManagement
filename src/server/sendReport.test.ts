import { describe, it, expect, vi } from 'vitest';
import { handleSendReport } from './sendReport';
import type { UserReportResult } from './reportEngine';

const report: UserReportResult = {
  reportPayload: {
    totalAssets: 100, totalLiabilities: 0, netWorth: 100,
    totalMonthlyIncome: 0, totalMonthlyExpense: 0, monthlyNetCashFlow: 0,
    usdToTwd: 32, combinedAssets: [], combinedLiabilities: [], loans: [], stakingItems: [], stockItems: [],
    generatedAt: new Date().toISOString(),
  },
  pledgeAlert: null, reportSchedule: 'none', lastReportSent: '',
  pledgeAlertLastSent: { warning: '', danger: '' },
};

const deps = (user: { id: string; email?: string | null } | null) => ({
  getSessionUser: vi.fn().mockResolvedValue(user),
  getDb: vi.fn().mockReturnValue({}),
  computeUserReport: vi.fn().mockResolvedValue(report),
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'm1' }),
  smtpConfigured: () => true,
});

describe('handleSendReport', () => {
  it('未登入:401,且不寄信', async () => {
    const d = deps(null);
    const res = await handleSendReport(d);
    expect(res.status).toBe(401);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it('登入但帳號沒有 email:400,且不寄信', async () => {
    const d = deps({ id: 'u1', email: null });
    const res = await handleSendReport(d);
    expect(res.status).toBe(400);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it('只寄給登入者本人,報表由伺服器依該使用者資料計算', async () => {
    const d = deps({ id: 'u1', email: 'me@example.com' });
    const res = await handleSendReport(d);
    expect(res.status).toBe(200);
    expect(d.computeUserReport).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(d.sendEmail).toHaveBeenCalledOnce();
    expect(d.sendEmail.mock.calls[0][0].to).toBe('me@example.com');
    expect(d.sendEmail.mock.calls[0][0].html).toContain('100');
  });

  it('SMTP 未設定:500,且不寄信', async () => {
    const d = { ...deps({ id: 'u1', email: 'me@example.com' }), smtpConfigured: () => false };
    const res = await handleSendReport(d);
    expect(res.status).toBe(500);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it('寄信失敗:500,不外洩內部錯誤細節', async () => {
    const d = deps({ id: 'u1', email: 'me@example.com' });
    d.sendEmail.mockRejectedValue(new Error('535 auth failed for smtp-user@internal'));
    const res = await handleSendReport(d);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('smtp-user@internal');
  });
});

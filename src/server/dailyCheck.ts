import type { Db } from '../db/client';
import { users, appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { generateAssetReportHtml, buildPledgeAlertHtml } from '../lib/mail';
import type { UserReportResult } from './reportEngine';

const appStateStore = createEntityStore(appState);

export interface DailyCheckDeps {
  getDb: () => Db;
  computeUserReport: (db: Db, userId: string) => Promise<UserReportResult>;
  sendEmail: (args: { to: string; subject: string; html: string }) => Promise<unknown>;
}

export interface DailyCheckSummary {
  processed: number;
  reportsSent: number;
  alertsSent: number;
  failures: { userId: string; error: string }[];
}

async function setAppStateValue(db: Db, userId: string, key: string, value: unknown): Promise<void> {
  const existing = await appStateStore.getAll(db, userId);
  const row = existing.find(r => r.id === key);
  if (row) {
    await appStateStore.update(db, userId, key, { id: key, value }, row.version);
  } else {
    await appStateStore.create(db, userId, key, { id: key, value });
  }
}

function isReportDue(
  schedule: 'none' | 'weekly' | 'monthly',
  lastSent: string,
  today: Date,
  todayStr: string,
): boolean {
  if (schedule === 'none') return false;
  if (lastSent === todayStr) return false;
  if (schedule === 'weekly') return today.getDay() === 1;
  return today.getDate() === 1;
}

export async function runDailyCheck(deps: DailyCheckDeps): Promise<DailyCheckSummary> {
  const db = deps.getDb();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);

  const summary: DailyCheckSummary = { processed: 0, reportsSent: 0, alertsSent: 0, failures: [] };

  for (const user of allUsers) {
    summary.processed += 1;
    if (!user.email) continue;

    try {
      const result = await deps.computeUserReport(db, user.id);

      if (isReportDue(result.reportSchedule, result.lastReportSent, today, todayStr)) {
        const html = generateAssetReportHtml(result.reportPayload);
        await deps.sendEmail({
          to: user.email,
          subject: `📊 AssetDash 資產報表 - ${today.toLocaleDateString('zh-TW')}`,
          html,
        });
        await setAppStateValue(db, user.id, 'lastReportSent', todayStr);
        summary.reportsSent += 1;
      }

      if (result.pledgeAlert && result.pledgeAlertLastSent[result.pledgeAlert.level] !== todayStr) {
        const isDanger = result.pledgeAlert.level === 'danger';
        const html = buildPledgeAlertHtml({
          isDanger,
          platformName: result.pledgeAlert.platform,
          ratio: result.pledgeAlert.ratio,
          pledgeData: result.pledgeAlert.pledgeData,
        });
        const subject = isDanger
          ? `[緊急] 質押維持率 ${result.pledgeAlert.ratio.toFixed(1)}% — 請立即補倉`
          : `[注意] 質押維持率 ${result.pledgeAlert.ratio.toFixed(1)}% — 建議補充保證金`;
        await deps.sendEmail({ to: user.email, subject, html });
        await setAppStateValue(db, user.id, 'pledgeAlertLastSent', {
          ...result.pledgeAlertLastSent,
          [result.pledgeAlert.level]: todayStr,
        });
        summary.alertsSent += 1;
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      // 只記錄 userId,不含 email 等 PII
      console.error(`[daily-check] user ${user.id} failed`, error);
      summary.failures.push({ userId: user.id, error: error.message });
    }
  }

  return summary;
}

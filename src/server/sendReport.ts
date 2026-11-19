import type { Db } from '../db/client';
import { generateAssetReportHtml } from '../lib/mail';
import type { UserReportResult } from './reportEngine';

export interface SendReportDeps {
  getSessionUser: () => Promise<{ id: string; email?: string | null } | null>;
  getDb: () => Db;
  computeUserReport: (db: Db, userId: string) => Promise<UserReportResult>;
  sendEmail: (msg: { to: string; subject: string; html: string }) => Promise<unknown>;
  smtpConfigured: () => boolean;
}

/**
 * 手動寄送資產報表。
 * 安全性:必須登入;收件人固定為登入者本人的 email;報表內容由伺服器依該使用者的雲端資料計算,
 * 不接受前端傳入的收件人或報表內容(否則任何人都能借用本站 SMTP 寄任意 HTML 給任意對象)。
 */
export async function handleSendReport(deps: SendReportDeps): Promise<Response> {
  const user = await deps.getSessionUser();
  if (!user?.id) return Response.json({ error: '請先登入' }, { status: 401 });
  if (!user.email) return Response.json({ error: '此帳號沒有 Email,無法寄送報表' }, { status: 400 });
  if (!deps.smtpConfigured()) return Response.json({ error: '伺服器尚未設定 SMTP 郵件服務' }, { status: 500 });

  try {
    const { reportPayload } = await deps.computeUserReport(deps.getDb(), user.id);
    await deps.sendEmail({
      to: user.email,
      subject: `📊 AssetDash 資產報表 - ${new Date().toLocaleDateString('zh-TW')}`,
      html: generateAssetReportHtml(reportPayload),
    });
    return Response.json({ success: true, message: `報表已寄送至 ${user.email}` });
  } catch (e: unknown) {
    // 只記錄 userId,不回傳內部錯誤細節(可能含 SMTP 帳號等資訊)
    console.error(`[send-report] user ${user.id} failed`, e);
    return Response.json({ error: '寄送失敗,請稍後再試' }, { status: 500 });
  }
}

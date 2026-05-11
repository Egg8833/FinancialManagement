import { NextResponse } from 'next/server';
import { sendEmail } from '../../../lib/mail';

type PledgeData = {
  platform: string;
  ratio: number;
  borrowValue: number;
  collateralValue: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipientEmail, alertLevel, platformName, ratio, pledgeData } = body as {
      recipientEmail: string;
      alertLevel: 'warning' | 'danger';
      platformName: string;
      ratio: number;
      pledgeData: PledgeData[];
    };

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: '請提供有效的收件人 Email' }, { status: 400 });
    }
    if (!process.env.EMAIL_SERVER_HOST || !process.env.EMAIL_SERVER_USER) {
      return NextResponse.json({ error: '伺服器尚未設定 SMTP' }, { status: 500 });
    }

    const isDanger = alertLevel === 'danger';
    const subject = isDanger
      ? `[緊急] 質押維持率 ${ratio.toFixed(1)}% — 請立即補倉`
      : `[注意] 質押維持率 ${ratio.toFixed(1)}% — 建議補充保證金`;

    const html = buildAlertHtml({ isDanger, platformName, ratio, pledgeData });
    await sendEmail({ to: recipientEmail, subject, html });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `寄送失敗：${message}` }, { status: 500 });
  }
}

function buildAlertHtml(data: {
  isDanger: boolean;
  platformName: string;
  ratio: number;
  pledgeData: PledgeData[];
}): string {
  const { isDanger, platformName, ratio, pledgeData } = data;
  const headerColor = isDanger ? '#dc2626' : '#d97706';
  const headerBg = isDanger ? '#fef2f2' : '#fffbeb';
  const borderColor = isDanger ? '#fecaca' : '#fde68a';
  const dateStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const ratioColor = (r: number) => r < 167 ? '#dc2626' : r < 200 ? '#d97706' : '#059669';

  const rows = pledgeData.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:13px;color:#374151;">${p.platform}</span>
      <span style="font-size:14px;font-weight:700;color:${ratioColor(p.ratio)};">${p.ratio > 0 ? p.ratio.toFixed(1) + '%' : '—'}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI','Microsoft JhengHei',sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:${headerBg};border-bottom:3px solid ${borderColor};padding:24px 28px;">
    <div style="font-size:20px;font-weight:700;color:${headerColor};">${isDanger ? '⚠️ 緊急：質押維持率警示' : '⚡ 注意：質押維持率提醒'}</div>
    <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${dateStr}</p>
  </div>
  <div style="padding:24px 28px;">
    <p style="font-size:15px;color:#374151;margin:0 0 12px;">您的質押帳戶 <strong>${platformName}</strong> 維持率已${isDanger ? '低於 167%' : '低於 200%'}，目前為 <strong style="color:${headerColor};">${ratio.toFixed(1)}%</strong>。</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">${isDanger ? '⚠️ 請立即補充保證金或部分還款，以避免強制平倉。' : '建議您適時補充擔保品，以提高安全緩衝。'}</p>
    <div style="background:#f9fafb;border-radius:10px;padding:16px;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">各平台質押狀況</div>
      ${rows}
    </div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">此信件由 AssetDash 自動產生 · ${dateStr}</p>
  </div>
</div>
</body>
</html>`;
}

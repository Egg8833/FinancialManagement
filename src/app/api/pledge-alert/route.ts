import { NextResponse } from 'next/server';
import { sendEmail, buildPledgeAlertHtml } from '../../../lib/mail';

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

    const html = buildPledgeAlertHtml({ isDanger, platformName, ratio, pledgeData });
    await sendEmail({ to: recipientEmail, subject, html });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `寄送失敗：${message}` }, { status: 500 });
  }
}

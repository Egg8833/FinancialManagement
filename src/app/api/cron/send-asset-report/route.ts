import { NextResponse } from 'next/server';
import { sendEmail, generateAssetReportHtml } from '../../../../lib/mail';
import type { ReportPayload } from '../../../../lib/mail';

// POST: 前端從 localStorage 讀取資料後 POST 到此 API 寄信
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipientEmail, reportData } = body as {
      recipientEmail: string;
      reportData: ReportPayload;
    };

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: '請提供有效的收件人 Email' }, { status: 400 });
    }

    if (!reportData || !reportData.combinedAssets) {
      return NextResponse.json({ error: '缺少資產報表資料' }, { status: 400 });
    }

    // 確保有 SMTP 設定
    if (!process.env.EMAIL_SERVER_HOST || !process.env.EMAIL_SERVER_USER) {
      return NextResponse.json({
        error: '伺服器尚未設定 SMTP 郵件服務。請在 .env.local 設定 EMAIL_SERVER_HOST、EMAIL_SERVER_USER、EMAIL_SERVER_PASSWORD。',
      }, { status: 500 });
    }

    const html = generateAssetReportHtml(reportData);

    const result = await sendEmail({
      to: recipientEmail,
      subject: `📊 AssetDash 資產報表 - ${new Date().toLocaleDateString('zh-TW')}`,
      html,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `報表已寄送至 ${recipientEmail}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Send report failed:', message);
    return NextResponse.json({ error: `寄送失敗：${message}` }, { status: 500 });
  }
}

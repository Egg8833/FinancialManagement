import nodemailer from 'nodemailer';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT) || 465,
      secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });
  }
  return _transporter;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const info = await getTransporter().sendMail({
    from: `"AssetDash 資產報表" <${process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER}>`,
    to,
    subject,
    html,
  });

  return info;
}

// ── Types ──
export type ReportAssetCategory = {
  title: string;
  items: { name: string; amount: number }[];
};

export type ReportLiability = {
  name: string;
  description?: string;
  amount: number;
};

export type ReportLoan = {
  name: string;
  bank: string;
  principal: number;
  interestRate: number;
  monthlyPayment: number;
  remainingPeriods: number;
};

export type ReportStakingItem = {
  name: string;
  protocol: string;
  value: number;
  apy: number;
  stakingType: 'borrow' | 'earn';
  monthlyInterest: number;
  borrowDate?: string;
  repayDate?: string;
};

export type ReportStockItem = {
  symbol: string;
  shortName?: string;
  platform?: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currency: string;
  changePercent: number;
  marketValueTWD: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
};

export type ReportPledgeRatio = {
  platform: string;
  ratio: number;
  totalBorrowValue: number;
  totalCollateralValueTWD: number;
  buffer: number;
  shortage: number;
  isRed: boolean;
  isYellow: boolean;
};

export type ReportPayload = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  combinedAssets: ReportAssetCategory[];
  combinedLiabilities: ReportLiability[];
  loans: ReportLoan[];
  stakingItems: ReportStakingItem[];
  stockItems: ReportStockItem[];
  pledgeRatioData?: ReportPledgeRatio[];
  usdToTwd: number;
  generatedAt: string;
};

// ── HTML Generator ──
export function generateAssetReportHtml(data: ReportPayload): string {
  const fmt = (n: number) => `NT$ ${n.toLocaleString('en-US')}`;
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const dateStr = new Date(data.generatedAt || Date.now()).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  // Palette
  const C_RED = '#dc2626';
  const C_YELLOW = '#d97706';
  const C_GREEN = '#059669';
  // 台灣慣例：漲 = 紅, 跌 = 綠
  const twPnlColor = (v: number) => v >= 0 ? C_RED : C_GREEN;
  const pledgeColor = (isRed: boolean, isYellow: boolean) => isRed ? C_RED : isYellow ? C_YELLOW : C_GREEN;

  const cashFlowColor = data.monthlyNetCashFlow >= 0 ? '#10b981' : '#ef4444';
  const totalStockValue = data.stockItems.reduce((s, i) => s + i.marketValueTWD, 0);
  const totalUnrealizedPnL = data.stockItems.reduce((s, i) => s + i.unrealizedPnL, 0);

  const raw = `
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI','Microsoft JhengHei',sans-serif;">
<div style="max-width:660px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 28px;color:#fff;">
    <div style="font-size:11px;opacity:0.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">AssetDash Weekly Report</div>
    <h1 style="margin:0 0 4px 0;font-size:22px;">📊 每週資產狀況報表</h1>
    <p style="margin:0;font-size:13px;opacity:0.85;">${dateStr}</p>
  </div>

  <!-- KPI Summary -->
  <div style="padding:24px 28px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:14px 16px;background:#f0fdf4;border-radius:10px;width:33%;vertical-align:top;">
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">總資產</div>
          <div style="font-size:20px;font-weight:700;color:#059669;margin-top:4px;">${fmt(data.totalAssets)}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:14px 16px;background:#fef2f2;border-radius:10px;width:33%;vertical-align:top;">
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">總負債</div>
          <div style="font-size:20px;font-weight:700;color:#dc2626;margin-top:4px;">${fmt(data.totalLiabilities)}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:14px 16px;background:#eef2ff;border-radius:10px;width:33%;vertical-align:top;">
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">淨資產</div>
          <div style="font-size:20px;font-weight:700;color:#4f46e5;margin-top:4px;">${fmt(data.netWorth)}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Cash Flow -->
  <div style="padding:20px 28px 0;">
    <div style="background:#fafafa;border-radius:10px;padding:16px 20px;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">💰 每月現金流</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">每月收入</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;color:#059669;">${fmt(data.totalMonthlyIncome)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">每月支出</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;color:#dc2626;">${fmt(data.totalMonthlyExpense)}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:8px 0 0;font-weight:700;color:#374151;">月淨現金流</td>
          <td style="padding:8px 0 0;text-align:right;font-weight:700;color:${cashFlowColor};">${fmt(data.monthlyNetCashFlow)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Assets Detail -->
  <div style="padding:20px 28px 0;">
    <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">📦 資產明細</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${data.combinedAssets.map(cat => `
        <tr><td colspan="2" style="padding:8px 12px;background:#f3f4f6;font-weight:700;color:#374151;border-radius:6px;">${cat.title}</td></tr>
        ${cat.items.map(item => `
          <tr>
            <td style="padding:6px 12px;color:#4b5563;border-bottom:1px solid #f3f4f6;">${item.name}</td>
            <td style="padding:6px 12px;text-align:right;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">${fmt(item.amount)}</td>
          </tr>
        `).join('')}
      `).join('')}
    </table>
  </div>

  <!-- Liabilities Detail -->
  <div style="padding:20px 28px 0;">
    <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">📋 負債明細</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${data.combinedLiabilities.map(item => `
        <tr>
          <td style="padding:6px 12px;color:#4b5563;border-bottom:1px solid #f3f4f6;">
            ${item.name}
            ${item.description ? `<div style="font-size:11px;color:#9ca3af;">${item.description}</div>` : ''}
          </td>
          <td style="padding:6px 12px;text-align:right;font-weight:600;color:#dc2626;border-bottom:1px solid #f3f4f6;">${fmt(item.amount)}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <!-- Loans -->
  ${data.loans.length > 0 ? `
  <div style="padding:20px 28px 0;">
    <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">🏦 貸款進度</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:#f9fafb;">
        <th style="padding:8px;text-align:left;color:#6b7280;font-weight:600;">貸款</th>
        <th style="padding:8px;text-align:right;color:#6b7280;font-weight:600;">剩餘本金</th>
        <th style="padding:8px;text-align:right;color:#6b7280;font-weight:600;">月繳</th>
        <th style="padding:8px;text-align:right;color:#6b7280;font-weight:600;">剩餘期數</th>
      </tr>
      ${data.loans.map(loan => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${loan.name}（${loan.bank}）</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f3f4f6;">${fmt(loan.principal)}</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f3f4f6;">${fmt(loan.monthlyPayment)}</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f3f4f6;">${loan.remainingPeriods} 期</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  <!-- ── 投資標的清單 ── -->
  ${data.stockItems.length > 0 ? `
  <div style="padding:20px 28px 0;">
    <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">📈 持股資產狀況</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
      <tr>
        <td style="padding:10px 14px;background:#f0fdf4;border-radius:8px;vertical-align:top;width:50%;">
          <div style="font-size:11px;color:#6b7280;">持股總市值</div>
          <div style="font-size:16px;font-weight:700;color:#059669;">${fmt(totalStockValue)}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px 14px;background:${totalUnrealizedPnL >= 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;vertical-align:top;width:50%;">
          <div style="font-size:11px;color:#6b7280;">未實現損益</div>
          <div style="font-size:16px;font-weight:700;color:${twPnlColor(totalUnrealizedPnL)};">${totalUnrealizedPnL >= 0 ? '+' : ''}${fmt(totalUnrealizedPnL)}</div>
        </td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:#f9fafb;">
        <th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:600;">投資標的</th>
        <th style="padding:8px 10px;text-align:right;color:#6b7280;font-weight:600;">現價</th>
        <th style="padding:8px 10px;text-align:right;color:#6b7280;font-weight:600;">漲跌幅</th>
        <th style="padding:8px 10px;text-align:right;color:#6b7280;font-weight:600;">市值(TWD)</th>
        <th style="padding:8px 10px;text-align:right;color:#6b7280;font-weight:600;">損益</th>
      </tr>
      ${data.stockItems.map(stock => {
        const isTW = stock.symbol.endsWith('.TW') || stock.symbol.endsWith('.TWO');
        const displaySymbol = isTW ? stock.symbol.replace(/\.(TW|TWO)$/, '') : stock.symbol;
        const priceDisplay = stock.currency === 'USD'
          ? `$${stock.currentPrice.toFixed(2)}`
          : `${stock.currentPrice.toLocaleString('en-US')}`;
        const changeColor = twPnlColor(stock.changePercent);
        const pnlColor = twPnlColor(stock.unrealizedPnL);
        const sharesDisplay = isTW
          ? `${(stock.shares / 1000).toFixed(0)} 張`
          : `${stock.shares.toLocaleString('en-US')} 股`;
        return `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 10px;">
              <div style="font-weight:700;color:#1f2937;">${displaySymbol}</div>
              ${stock.shortName ? `<div style="font-size:11px;color:#9ca3af;">${stock.shortName}</div>` : ''}
              <div style="font-size:11px;color:#9ca3af;">${sharesDisplay}${stock.platform ? ` · ${stock.platform}` : ''}</div>
            </td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#374151;">${priceDisplay}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:${changeColor};">${fmtPct(stock.changePercent)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#374151;">${fmt(stock.marketValueTWD)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:${pnlColor};">${stock.unrealizedPnL >= 0 ? '+' : ''}${fmt(stock.unrealizedPnL)}</td>
          </tr>
        `;
      }).join('')}
    </table>
  </div>
  ` : ''}

  <!-- ── 質押維持率 ── -->
  ${data.pledgeRatioData && data.pledgeRatioData.length > 0 ? `
  <div style="padding:20px 28px 0;">
    <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:12px;">🔒 質押狀況</div>
    ${data.pledgeRatioData.map(p => {
      const statusText = p.isRed ? '危險' : p.isYellow ? '警戒' : '安全';
      const statusColor = pledgeColor(p.isRed, p.isYellow);
      const badgeBg = p.isRed ? '#fee2e2' : p.isYellow ? '#fef3c7' : '#d1fae5';
      const borderColor = p.isRed ? '#fecaca' : p.isYellow ? '#fde68a' : '#a7f3d0';
      const bufferColor = p.isRed ? C_RED : C_GREEN;
      const bufferBg = p.isRed ? '#fef2f2' : '#f0fdf4';
      const bufferLabel = p.isRed ? '追繳缺口' : '安全緩衝';
      const bufferDesc = p.isRed
        ? '擔保品市值低於追繳門檻的差額，需補充此金額才能回到安全線 (130%)。'
        : '擔保品市值跌超過此金額後，維持率將低於 130% 並觸發追繳。數字越大代表越安全。';
      const bufferValue = p.isRed
        ? `-${p.shortage.toLocaleString('en-US')}`
        : `+${p.buffer.toLocaleString('en-US')}`;
      return `
      <div style="border:1px solid ${borderColor};border-radius:12px;padding:18px;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
          <tr>
            <td style="vertical-align:middle;">
              <span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${badgeBg};color:${statusColor};">${statusText}</span>
              <span style="font-size:13px;font-weight:600;color:#374151;margin-left:8px;">質押維持率</span>
              <span style="font-size:11px;color:#9ca3af;background:#f3f4f6;padding:2px 8px;border-radius:20px;margin-left:6px;">${p.platform}</span>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <span style="font-size:26px;font-weight:700;color:${p.totalCollateralValueTWD > 0 ? statusColor : '#d1d5db'};">${p.totalCollateralValueTWD > 0 ? p.ratio.toFixed(1) + '%' : '—'}</span>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 12px;background:#f9fafb;border-radius:8px;vertical-align:top;width:32%;">
              <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">擔保品市值</div>
              <div style="font-size:13px;font-weight:700;color:#1f2937;">${p.totalCollateralValueTWD.toLocaleString('en-US')}</div>
              <div style="font-size:10px;color:#9ca3af;">TWD</div>
            </td>
            <td style="width:8px;"></td>
            <td style="padding:10px 12px;background:#f9fafb;border-radius:8px;vertical-align:top;width:32%;">
              <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">融資借款</div>
              <div style="font-size:13px;font-weight:700;color:#1f2937;">${p.totalBorrowValue.toLocaleString('en-US')}</div>
              <div style="font-size:10px;color:#9ca3af;">TWD</div>
            </td>
            <td style="width:8px;"></td>
            <td style="padding:10px 12px;border-radius:8px;vertical-align:top;width:32%;background:${bufferBg};">
              <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">${bufferLabel}</div>
              <div style="font-size:13px;font-weight:700;color:${bufferColor};">${bufferValue}</div>
              <div style="font-size:10px;color:#9ca3af;">TWD</div>
              <div style="font-size:10px;color:#9ca3af;margin-top:4px;line-height:1.4;">${bufferDesc}</div>
            </td>
          </tr>
        </table>
      </div>
      `;
    }).join('')}
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="padding:24px 28px;margin-top:16px;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">
      此信件由 AssetDash 系統自動產生 · ${dateStr}
    </p>
  </div>

</div>
</body>
</html>
  `.trim();
  return raw.replace(/>\s+</g, '><');
}

export function buildPledgeAlertHtml(data: {
  isDanger: boolean;
  platformName: string;
  ratio: number;
  pledgeData: { platform: string; ratio: number; borrowValue: number; collateralValue: number }[];
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

import { describe, it, expect } from 'vitest';
import { buildPledgeAlertHtml, generateAssetReportHtml, escapeHtml } from './mail';

describe('buildPledgeAlertHtml', () => {
  it('danger 等級會標示「緊急」與平台名稱、比率', () => {
    const html = buildPledgeAlertHtml({
      isDanger: true,
      platformName: '元大',
      ratio: 150.5,
      pledgeData: [{ platform: '元大', ratio: 150.5, borrowValue: 1000000, collateralValue: 1505000 }],
    });
    expect(html).toContain('緊急');
    expect(html).toContain('元大');
    expect(html).toContain('150.5%');
  });

  it('warning 等級不含「緊急」字樣,含「注意」', () => {
    const html = buildPledgeAlertHtml({
      isDanger: false,
      platformName: '國泰',
      ratio: 190,
      pledgeData: [{ platform: '國泰', ratio: 190, borrowValue: 500000, collateralValue: 950000 }],
    });
    expect(html).toContain('注意');
    expect(html).not.toContain('緊急');
  });
});

describe('質押警示信門檻文字與畫面一致(130% 追繳線 / 166% 警戒線)', () => {
  const data = (isDanger: boolean, ratio: number) => ({
    isDanger, platformName: '元大', ratio,
    pledgeData: [{ platform: '元大', ratio, borrowValue: 1, collateralValue: 1 }],
  });

  it('danger 提及追繳線 130%,不再出現 167%', () => {
    const html = buildPledgeAlertHtml(data(true, 120));
    expect(html).toContain('130%');
    expect(html).not.toContain('167%');
  });

  it('warning 提及警戒線 166%,不再出現 200%', () => {
    const html = buildPledgeAlertHtml(data(false, 150));
    expect(html).toContain('166%');
    expect(html).not.toContain('200%');
  });
});

describe('HTML 跳脫(防止使用者輸入的文字注入信件 HTML)', () => {
  const payload = (name: string) => ({
    totalAssets: 1, totalLiabilities: 0, netWorth: 1,
    totalMonthlyIncome: 0, totalMonthlyExpense: 0, monthlyNetCashFlow: 0, usdToTwd: 32,
    combinedAssets: [{ title: name, items: [{ name, amount: 1 }] }],
    combinedLiabilities: [{ name, description: name, amount: 1 }],
    loans: [{ name, bank: name, principal: 1, interestRate: 1, monthlyPayment: 1, remainingPeriods: 1 }],
    stakingItems: [],
    stockItems: [{
      symbol: name, shortName: name, platform: name, shares: 1, avgCost: 1, currentPrice: 1, currency: 'TWD',
      changePercent: 0, marketValueTWD: 1, costBasis: 1, unrealizedPnL: 0, unrealizedPnLPct: 0,
    }],
    pledgeRatioData: [{
      platform: name, ratio: 200, totalBorrowValue: 1, totalCollateralValueTWD: 2, buffer: 0, shortage: 0, isRed: false, isYellow: false,
    }],
    generatedAt: new Date().toISOString(),
  });

  it('escapeHtml 跳脫 & < > " \'', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('資產報表中所有使用者文字欄位都被跳脫', () => {
    const html = generateAssetReportHtml(payload('<script>alert(1)</script>'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('質押警示信的平台名稱被跳脫', () => {
    const html = buildPledgeAlertHtml({
      isDanger: true, platformName: '<img src=x>', ratio: 150,
      pledgeData: [{ platform: '<img src=x>', ratio: 150, borrowValue: 1, collateralValue: 1 }],
    });
    expect(html).not.toContain('<img src=x>');
  });
});

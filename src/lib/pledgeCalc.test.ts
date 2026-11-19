import { describe, it, expect } from 'vitest';
import {
  computePledgeRatios,
  getPledgeAlertLevel,
  buildReportPledgeRatios,
  simulatePledge,
  simulatePortfolio,
  repaymentForTargetRatio,
  collateralForTargetRatio,
  dropPctToRatio,
} from './pledgeCalc';
import type { StakingItem, StockItem, StockQuote } from '../types';

const staking: StakingItem[] = [
  { id: 's1', name: '借款A', protocol: '元大', amount: 1000000, value: 1000000, apy: 2.5, stakingType: 'borrow' },
];
const stocks: StockItem[] = [
  { id: 'st1', symbol: '2330.TW', shares: 1000, avgCost: 500, collateralShares: 1000, platform: '元大' },
];
const quotes: Record<string, StockQuote> = { '2330.TW': { price: 1500, changePercent: 0, currency: 'TWD' } };

describe('computePledgeRatios', () => {
  it('依平台分組計算維持率(擔保品市值/借款金額 * 100)', () => {
    const result = computePledgeRatios(staking, stocks, quotes, 32);
    expect(result).toEqual([{ platform: '元大', ratio: 150, borrowValue: 1000000, collateralValue: 1500000 }]);
  });

  it('無借款項目時回傳空陣列', () => {
    expect(computePledgeRatios([], stocks, quotes, 32)).toEqual([]);
  });

  it('USD 計價股票的擔保品市值會換算成台幣', () => {
    const usdStock: StockItem[] = [{ id: 'st2', symbol: 'AAPL', shares: 100, avgCost: 150, collateralShares: 100, platform: '元大' }];
    const usdQuotes: Record<string, StockQuote> = { AAPL: { price: 200, changePercent: 0, currency: 'USD' } };
    const result = computePledgeRatios(staking, usdStock, usdQuotes, 32);
    expect(result[0].collateralValue).toBe(200 * 100 * 32);
  });
});

describe('getPledgeAlertLevel', () => {
  it('維持率 < 130%(追繳線)回傳 danger', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 120, borrowValue: 100, collateralValue: 120 }]))
      .toEqual({ level: 'danger', platform: 'A', ratio: 120 });
  });

  it('130% <= 維持率 < 166%(警戒線)回傳 warning,與畫面/報表/模擬器同一套門檻', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 150, borrowValue: 100, collateralValue: 150 }]))
      .toEqual({ level: 'warning', platform: 'A', ratio: 150 });
  });

  it('維持率 >= 166% 回傳 null', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 170, borrowValue: 100, collateralValue: 170 }])).toBeNull();
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 250, borrowValue: 100, collateralValue: 250 }])).toBeNull();
  });

  it('未設定擔保品(市值 0)的平台被忽略,不會遮蔽其他平台的警示', () => {
    expect(getPledgeAlertLevel([
      { platform: '未設定', ratio: 0, borrowValue: 100, collateralValue: 0 },
      { platform: 'B', ratio: 150, borrowValue: 100, collateralValue: 150 },
    ])).toEqual({ level: 'warning', platform: 'B', ratio: 150 });
  });

  it('沒有任何借款 > 0 的平台時回傳 null', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 0, borrowValue: 0, collateralValue: 0 }])).toBeNull();
  });

  it('借款 > 0 但擔保品市值 0(無報價)時 ratio 為 0,不應誤觸發 danger', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 0, borrowValue: 100, collateralValue: 0 }])).toBeNull();
  });

  it('多平台時取維持率最低者', () => {
    const result = getPledgeAlertLevel([
      { platform: 'A', ratio: 180, borrowValue: 100, collateralValue: 180 },
      { platform: 'B', ratio: 120, borrowValue: 100, collateralValue: 120 },
    ]);
    expect(result).toEqual({ level: 'danger', platform: 'B', ratio: 120 });
  });
});

describe('buildReportPledgeRatios', () => {
  it('維持率 < 130% 標記 isRed,並計算追繳缺口 shortage', () => {
    const [r] = buildReportPledgeRatios([{ platform: 'A', ratio: 100, borrowValue: 1000000, collateralValue: 1000000 }]);
    expect(r.isRed).toBe(true);
    expect(r.isYellow).toBe(false);
    expect(r.shortage).toBe(Math.round(1000000 * 1.3 - 1000000));
  });

  it('130% <= 維持率 < 166% 標記 isYellow', () => {
    const [r] = buildReportPledgeRatios([{ platform: 'A', ratio: 150, borrowValue: 1000000, collateralValue: 1500000 }]);
    expect(r.isYellow).toBe(true);
    expect(r.isRed).toBe(false);
  });

  it('維持率 >= 166% 兩者皆 false,並計算安全緩衝 buffer', () => {
    const [r] = buildReportPledgeRatios([{ platform: 'A', ratio: 200, borrowValue: 1000000, collateralValue: 2000000 }]);
    expect(r.isRed).toBe(false);
    expect(r.isYellow).toBe(false);
    expect(r.buffer).toBe(Math.round(2000000 - 1000000 * 1.3));
  });
});

describe('simulatePledge', () => {
  it('無任何調整時等於現況維持率', () => {
    const r = simulatePledge(1_500_000, 1_000_000);
    expect(r.ratio).toBe(150);
    expect(r.status).toBe('warn');
    expect(r.isCleared).toBe(false);
  });

  it('手動還款會降低借款餘額並拉高維持率', () => {
    const r = simulatePledge(1_500_000, 1_000_000, { repayAmount: 200_000 });
    expect(r.borrowValue).toBe(800_000);
    expect(r.ratio).toBeCloseTo(187.5);
    expect(r.status).toBe('safe');
  });

  it('還款金額超過借款餘額時以還清處理', () => {
    const r = simulatePledge(1_500_000, 1_000_000, { repayAmount: 9_999_999 });
    expect(r.isCleared).toBe(true);
    expect(r.borrowValue).toBe(0);
    expect(r.ratio).toBe(0);
    expect(r.status).toBe('safe');
  });

  it('補繳擔保品在跌幅之後才計入', () => {
    const r = simulatePledge(1_000_000, 1_000_000, { dropPct: 50, addCollateral: 300_000 });
    expect(r.collateralValue).toBe(800_000);
    expect(r.ratio).toBe(80);
  });

  it('跌幅、還款、補繳可同時作用', () => {
    const r = simulatePledge(2_000_000, 1_000_000, { dropPct: 30, repayAmount: 300_000, addCollateral: 100_000 });
    expect(r.collateralValue).toBe(1_500_000);
    expect(r.borrowValue).toBe(700_000);
    expect(r.ratio).toBeCloseTo(214.29, 1);
  });

  it('跌幅低於追繳線時回傳 danger 與缺口', () => {
    const r = simulatePledge(1_300_000, 1_000_000, { dropPct: 20 });
    expect(r.ratio).toBe(104);
    expect(r.status).toBe('danger');
    expect(r.shortage).toBe(260_000);
  });

  it('負數還款與負數補繳視為 0', () => {
    const r = simulatePledge(1_500_000, 1_000_000, { repayAmount: -500_000, addCollateral: -500_000 });
    expect(r.ratio).toBe(150);
  });
});

describe('repaymentForTargetRatio / collateralForTargetRatio', () => {
  it('回推達到目標維持率所需的還款金額', () => {
    expect(repaymentForTargetRatio(1_500_000, 1_000_000, 200)).toBe(250_000);
  });

  it('已達目標時還款需求為 0', () => {
    expect(repaymentForTargetRatio(2_500_000, 1_000_000, 200)).toBe(0);
  });

  it('回推達到目標維持率所需補繳的擔保品市值', () => {
    expect(collateralForTargetRatio(1_500_000, 1_000_000, 200)).toBe(500_000);
  });

  it('無借款時兩者皆為 0', () => {
    expect(repaymentForTargetRatio(1_000_000, 0, 200)).toBe(0);
    expect(collateralForTargetRatio(1_000_000, 0, 200)).toBe(0);
  });
});

describe('dropPctToRatio', () => {
  it('計算還能跌幾 % 才碰到追繳線', () => {
    expect(dropPctToRatio(2_600_000, 1_000_000, 130)).toBe(50);
  });

  it('已低於目標線時回 0', () => {
    expect(dropPctToRatio(1_000_000, 1_000_000, 130)).toBe(0);
  });
});

describe('simulatePortfolio', () => {
  const accounts = [
    { platform: '元大', collateralValue: 2_000_000, borrowValue: 1_000_000 },
    { platform: '永豐', collateralValue: 1_400_000, borrowValue: 1_000_000 },
  ];

  it('共同跌幅下逐一算出各帳戶維持率', () => {
    const r = simulatePortfolio(accounts, 30);
    expect(r.accounts.map(a => Math.round(a.after.ratio))).toEqual([140, 98]);
    expect(r.breached).toEqual(['永豐']);
    expect(r.worst?.platform).toBe('永豐');
  });

  it('合併維持率以所有帳戶加總計算', () => {
    const r = simulatePortfolio(accounts, 30);
    expect(r.total.before.ratio).toBe(170);
    expect(r.total.after.ratio).toBe(119);
  });

  it('合計缺口只累加落入追繳區的帳戶', () => {
    const r = simulatePortfolio(accounts, 30);
    expect(r.totalShortage).toBe(1_300_000 - 980_000);
  });

  it('可針對個別平台加上還款與補繳', () => {
    const r = simulatePortfolio(accounts, 30, { 永豐: { repayAmount: 400_000 } });
    const sinopac = r.accounts.find(a => a.platform === '永豐')!;
    expect(sinopac.after.borrowValue).toBe(600_000);
    expect(Math.round(sinopac.after.ratio)).toBe(163);
    expect(r.breached).toEqual([]);
  });

  it('沒有借款的帳戶不納入模擬', () => {
    const r = simulatePortfolio([...accounts, { platform: '空帳戶', collateralValue: 500_000, borrowValue: 0 }], 10);
    expect(r.accounts.map(a => a.platform)).toEqual(['元大', '永豐']);
  });

  it('個別帳戶還款超過其借款時,合併維持率只扣除該帳戶的借款(不會被高估)', () => {
    const r = simulatePortfolio(accounts, 0, { 元大: { repayAmount: 5_000_000 } });
    expect(r.accounts.find(a => a.platform === '元大')!.after.isCleared).toBe(true);
    expect(r.total.after.borrowValue).toBe(1_000_000);
    expect(r.total.after.isCleared).toBe(false);
    expect(r.total.after.ratio).toBe(340);
  });

  it('距追繳的跌幅會反映手動還款', () => {
    const r = simulatePortfolio(accounts, 0, { 永豐: { repayAmount: 400_000 } });
    const sinopac = r.accounts.find(a => a.platform === '永豐')!;
    // 借款 600,000 → 追繳線 780,000;擔保品 1,400,000 還能跌 (1.4M - 0.78M) / 1.4M
    expect(sinopac.dropPctToCall).toBeCloseTo(44.29, 1);
  });

  it('已還清的帳戶距追繳為 100%(不會被追繳)', () => {
    const r = simulatePortfolio(accounts, 0, { 永豐: { repayAmount: 1_000_000 } });
    expect(r.accounts.find(a => a.platform === '永豐')!.dropPctToCall).toBe(100);
  });

  it('有借款但未設定擔保品的帳戶不納入模擬,另外列在 unconfigured', () => {
    const r = simulatePortfolio([...accounts, { platform: '未設定', collateralValue: 0, borrowValue: 500_000 }], 10);
    expect(r.accounts.map(a => a.platform)).toEqual(['元大', '永豐']);
    expect(r.unconfigured).toEqual(['未設定']);
    expect(r.breached).not.toContain('未設定');
  });

  it('無帳戶時回傳空結果', () => {
    const r = simulatePortfolio([], 20);
    expect(r.accounts).toEqual([]);
    expect(r.worst).toBeNull();
    expect(r.total.after.isCleared).toBe(true);
  });
});

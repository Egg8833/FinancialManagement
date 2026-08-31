import { describe, it, expect } from 'vitest';
import { computePledgeRatios, getPledgeAlertLevel, buildReportPledgeRatios } from './pledgeCalc';
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
  it('維持率 < 167% 回傳 danger', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 150, borrowValue: 100, collateralValue: 150 }]))
      .toEqual({ level: 'danger', platform: 'A', ratio: 150 });
  });

  it('167% <= 維持率 < 200% 回傳 warning', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 180, borrowValue: 100, collateralValue: 180 }]))
      .toEqual({ level: 'warning', platform: 'A', ratio: 180 });
  });

  it('維持率 >= 200% 回傳 null', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 250, borrowValue: 100, collateralValue: 250 }])).toBeNull();
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

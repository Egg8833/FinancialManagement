// src/lib/assetCalc.test.ts
import { describe, it, expect } from 'vitest';
import { buildCombinedAssets, buildCombinedLiabilities, computeTotalAssets, computeTotalLiabilities } from './assetCalc';
import type { AssetCategory, LiabilityItem } from '../types';

const cat = (id: string, amounts: number[]): AssetCategory => ({
  id, title: id, description: '', colorClass: '', bgClass: '', updatedAt: '',
  items: amounts.map((amount, i) => ({ id: `${id}-${i}`, name: `item${i}`, amount })),
});

describe('buildCombinedAssets', () => {
  it('非 investment 分類原樣回傳', () => {
    const assets = [cat('liquid', [1000])];
    expect(buildCombinedAssets(assets, 5000, 2000)).toEqual(assets);
  });

  it('investment 分類會附加自動化股票投資與活存/Earn 收益資產', () => {
    const assets = [cat('investment', [100])];
    const result = buildCombinedAssets(assets, 50000, 20000);
    expect(result[0].items).toEqual([
      { id: 'investment-0', name: 'item0', amount: 100 },
      { id: 'auto-stocks', name: '自動化股票投資', amount: 50000 },
      { id: 'auto-earn', name: '活存/Earn 收益資產', amount: 20000 },
    ]);
  });

  it('股票市值與 Earn 皆為 0 時,investment 分類不附加任何項目', () => {
    const assets = [cat('investment', [100])];
    expect(buildCombinedAssets(assets, 0, 0)).toEqual(assets);
  });
});

describe('buildCombinedLiabilities', () => {
  const liabilities: LiabilityItem[] = [
    { id: 'l1', name: '房貸', description: '', amount: 3000000, updatedAt: '', icon: 'building' },
  ];

  it('質押借款與本金 > 0 的貸款會併入負債清單', () => {
    const result = buildCombinedLiabilities(
      liabilities,
      [{ id: 's1', name: 'ETH 質押', protocol: 'Lido', value: 1000000, apy: 3.4 }],
      [{ id: 'loan1', name: '信貸A', bank: '樂天', principal: 500000, interestRate: 2.08, remainingPeriods: 68, loanType: 'installment' }],
    );
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({ id: 'auto-staking-s1', amount: 1000000, icon: 'building' });
    expect(result[2]).toMatchObject({ id: 'auto-loan-loan1', amount: 500000, icon: 'creditCard' });
  });

  it('本金為 0 的貸款不會被列入', () => {
    const result = buildCombinedLiabilities(
      liabilities, [],
      [{ id: 'loan1', name: '已還清', bank: '樂天', principal: 0, interestRate: 2.08, remainingPeriods: 0, loanType: 'installment' }],
    );
    expect(result).toHaveLength(1);
  });
});

describe('computeTotalAssets / computeTotalLiabilities', () => {
  it('加總所有分類 items 的 amount', () => {
    expect(computeTotalAssets([cat('a', [100, 200]), cat('b', [50])])).toBe(350);
  });

  it('加總所有負債的 amount', () => {
    const liabilities: LiabilityItem[] = [
      { id: 'l1', name: 'x', description: '', amount: 100, updatedAt: '', icon: 'building' },
      { id: 'l2', name: 'y', description: '', amount: 200, updatedAt: '', icon: 'creditCard' },
    ];
    expect(computeTotalLiabilities(liabilities)).toBe(300);
  });
});

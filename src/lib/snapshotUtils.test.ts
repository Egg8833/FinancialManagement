import { describe, it, expect } from 'vitest';
import { buildSnapshot } from './snapshotUtils';
import type { AssetCategory } from '../types';

const cat = (id: string, amounts: number[]): AssetCategory => ({
  id, title: id, description: '', colorClass: '', bgClass: '', updatedAt: '',
  items: amounts.map((amount, i) => ({ id: `${id}-${i}`, name: `item${i}`, amount })),
});

describe('buildSnapshot', () => {
  it('依分類 id 加總 liquid/investment/fixed/receivable', () => {
    const assets = [cat('liquid', [1000, 2000]), cat('fixed', [50000])];
    const combinedAssets = [...assets, cat('investment', [3000, 7000])]; // investment 只存在於 combinedAssets（含自動同步項目）
    const snap = buildSnapshot({
      assets, combinedAssets,
      totalAssets: 63000, totalLiabilities: 10000, netWorth: 53000,
      totalMonthlyIncome: 80000, totalMonthlyExpense: 50000, monthlyNetCashFlow: 30000,
      snapshots: [],
    });
    expect(snap.liquid).toBe(3000);
    expect(snap.investment).toBe(10000);
    expect(snap.fixed).toBe(50000);
    expect(snap.receivable).toBe(0); // 無 receivable 分類，fallback 0
    expect(snap.totalAssets).toBe(63000);
    expect(snap.totalLiabilities).toBe(10000);
    expect(snap.netWorth).toBe(53000);
  });

  it('investment 一律從 combinedAssets 取值，不是 assets（自動同步的股票/質押收益不會存在原始 assets）', () => {
    const assets = [cat('liquid', [1000])]; // 不含 investment 分類
    const combinedAssets = [...assets, cat('investment', [99999])];
    const snap = buildSnapshot({
      assets, combinedAssets,
      totalAssets: 100999, totalLiabilities: 0, netWorth: 100999,
      totalMonthlyIncome: 0, totalMonthlyExpense: 0, monthlyNetCashFlow: 0,
      snapshots: [],
    });
    expect(snap.investment).toBe(99999);
  });

  it('id 帶有 snap- 前綴，date 為今天（ISO 日期）', () => {
    const today = new Date().toISOString().split('T')[0];
    const snap = buildSnapshot({
      assets: [], combinedAssets: [],
      totalAssets: 0, totalLiabilities: 0, netWorth: 0,
      totalMonthlyIncome: 0, totalMonthlyExpense: 0, monthlyNetCashFlow: 0,
      snapshots: [],
    });
    expect(snap.id.startsWith('snap-')).toBe(true);
    expect(snap.date).toBe(today);
  });

  it('healthScore 為 calculateHealthScore 算出的 0-100 分數', () => {
    const snap = buildSnapshot({
      assets: [cat('liquid', [500000])], combinedAssets: [cat('liquid', [500000])],
      totalAssets: 500000, totalLiabilities: 0, netWorth: 500000,
      totalMonthlyIncome: 80000, totalMonthlyExpense: 40000, monthlyNetCashFlow: 40000,
      snapshots: [],
    });
    expect(typeof snap.healthScore).toBe('number');
    expect(snap.healthScore).toBeGreaterThanOrEqual(0);
    expect(snap.healthScore).toBeLessThanOrEqual(100);
  });
});

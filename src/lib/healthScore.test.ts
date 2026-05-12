import { describe, it, expect } from 'vitest';
import { calculateHealthScore, type HealthScoreInput } from './healthScore';

const base: HealthScoreInput = {
  totalMonthlyIncome: 100_000,
  totalMonthlyExpense: 70_000,
  monthlyNetCashFlow: 30_000,
  totalAssets: 3_000_000,
  totalLiabilities: 600_000,
  liquidAssets: 500_000,
  investmentAssets: 1_200_000,
  snapshots: [],
};

describe('calculateHealthScore', () => {
  it('回傳 totalScore 在 0–100 之間', () => {
    const r = calculateHealthScore(base);
    expect(r.totalScore).toBeGreaterThanOrEqual(0);
    expect(r.totalScore).toBeLessThanOrEqual(100);
  });

  it('回傳 6 個 metrics', () => {
    expect(calculateHealthScore(base).metrics).toHaveLength(6);
  });

  it('grade 值在允許範圍內', () => {
    const grade = calculateHealthScore(base).grade;
    expect(['優秀', '良好', '普通', '警示', '危險']).toContain(grade);
  });

  it('儲蓄率 30% → savings score = 100', () => {
    const r = calculateHealthScore({ ...base, monthlyNetCashFlow: 30_000, totalMonthlyIncome: 100_000 });
    expect(r.metrics.find(m => m.key === 'savings')!.score).toBe(100);
  });

  it('儲蓄率負值 → savings score = 0', () => {
    const r = calculateHealthScore({ ...base, monthlyNetCashFlow: -1 });
    expect(r.metrics.find(m => m.key === 'savings')!.score).toBe(0);
  });

  it('負債比率 20% → debt score = 100', () => {
    const r = calculateHealthScore({ ...base, totalLiabilities: 600_000, totalAssets: 3_000_000 });
    expect(r.metrics.find(m => m.key === 'debt')!.score).toBe(100);
  });

  it('負債比率 70%+ → debt score = 0', () => {
    const r = calculateHealthScore({ ...base, totalLiabilities: 2_200_000, totalAssets: 3_000_000 });
    expect(r.metrics.find(m => m.key === 'debt')!.score).toBe(0);
  });

  it('緊急備用金 6 個月 → liquidity score = 100', () => {
    const r = calculateHealthScore({ ...base, liquidAssets: 6 * 70_000, totalMonthlyExpense: 70_000 });
    expect(r.metrics.find(m => m.key === 'liquidity')!.score).toBe(100);
  });

  it('連續 3 月淨資產上升 → growth score = 100', () => {
    const snapshots = [
      { netWorth: 800_000 },
      { netWorth: 900_000 },
      { netWorth: 1_000_000 },
    ];
    const r = calculateHealthScore({ ...base, snapshots });
    expect(r.metrics.find(m => m.key === 'growth')!.score).toBe(100);
  });

  it('連續 3 月淨資產下降 → growth score = 0', () => {
    const snapshots = [
      { netWorth: 1_000_000 },
      { netWorth: 900_000 },
      { netWorth: 800_000 },
    ];
    const r = calculateHealthScore({ ...base, snapshots });
    expect(r.metrics.find(m => m.key === 'growth')!.score).toBe(0);
  });

  it('淨資產持平（無漲無跌）→ growth score = 50', () => {
    const snapshots = [
      { netWorth: 1_000_000 },
      { netWorth: 1_000_000 },
      { netWorth: 1_000_000 },
    ];
    const r = calculateHealthScore({ ...base, snapshots });
    expect(r.metrics.find(m => m.key === 'growth')!.score).toBe(50);
  });

  it('完美輸入 → grade 為 優秀', () => {
    const r = calculateHealthScore({
      totalMonthlyIncome: 100_000,
      totalMonthlyExpense: 50_000,
      monthlyNetCashFlow: 50_000,
      totalAssets: 10_000_000,
      totalLiabilities: 500_000,
      liquidAssets: 3_000_000,
      investmentAssets: 5_000_000,
      snapshots: [
        { netWorth: 8_400_000 },
        { netWorth: 8_950_000 },
        { netWorth: 9_500_000 },
      ],
    });
    expect(r.grade).toBe('優秀');
  });
});

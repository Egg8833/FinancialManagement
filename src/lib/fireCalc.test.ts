import { describe, it, expect } from 'vitest';
import { calculateFire, type FireInput } from './fireCalc';

const base: FireInput = {
  currentAge: 35,
  targetRetirementAge: 55,
  currentNetWorth: 2_000_000,
  monthlyInvestment: 30_000,
  retirementMonthlyExpense: 60_000,
  annualReturnRate: 0.06,
  inflationRate: 0.02,
};

describe('calculateFire', () => {
  it('FIRE Number = 月支出（通膨調整後） × 12 × 25', () => {
    const r = calculateFire(base);
    // 20 years to retirement, 2% inflation: expense × (1.02)^20 × 12 × 25
    const expected = 60_000 * Math.pow(1.02, 20) * 12 * 25;
    expect(r.fireNumber).toBeCloseTo(expected, -3); // within 1000
  });

  it('projectionData 至少包含 1 筆資料', () => {
    expect(calculateFire(base).projectionData.length).toBeGreaterThan(0);
  });

  it('projectionData 第一筆 neutral 值等於 currentNetWorth', () => {
    const r = calculateFire(base);
    expect(r.projectionData[0].neutral).toBe(base.currentNetWorth);
  });

  it('樂觀情境達成 FIRE 早於或等於中性情境', () => {
    const r = calculateFire(base);
    if (r.optimisticFireYear && r.neutralFireYear) {
      expect(r.optimisticFireYear).toBeLessThanOrEqual(r.neutralFireYear);
    }
  });

  it('保守情境達成 FIRE 晚於或等於中性情境', () => {
    const r = calculateFire(base);
    if (r.conservativeFireYear && r.neutralFireYear) {
      expect(r.conservativeFireYear).toBeGreaterThanOrEqual(r.neutralFireYear);
    }
  });

  it('netWorth = 0 且 monthlyInvestment = 0 → 不會達成 FIRE（返回 null）', () => {
    const r = calculateFire({ ...base, currentNetWorth: 0, monthlyInvestment: 0 });
    expect(r.neutralFireYear).toBeNull();
  });

  it('已超過 FIRE Number → neutralFireYear 為當前年份', () => {
    const r = calculateFire({ ...base, currentNetWorth: 100_000_000 });
    expect(r.neutralFireYear).toBe(new Date().getFullYear());
  });
});

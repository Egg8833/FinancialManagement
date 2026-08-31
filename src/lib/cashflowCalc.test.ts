// src/lib/cashflowCalc.test.ts
import { describe, it, expect } from 'vitest';
import { computeMonthlyIncome, computeMonthlyExpense } from './cashflowCalc';
import type { CashflowTemplate, MonthRecord } from '../types';

const template: CashflowTemplate = {
  income: [{ id: 'i1', name: '薪資', amount: 80000, category: 'Salary', isRecurring: true }],
  expense: [{ id: 'e1', name: '房租', amount: 20000, category: 'Housing', isRecurring: true }],
};

describe('computeMonthlyIncome', () => {
  it('無當月紀錄時用範本收入,並加上四捨五入後的 Earn 收益', () => {
    expect(computeMonthlyIncome(undefined, template, 1234.6)).toBe(80000 + 1235);
  });

  it('有當月紀錄時優先用紀錄的收入清單', () => {
    const record: MonthRecord = { income: [{ id: 'i2', name: '獎金', amount: 10000, category: 'Bonus', isRecurring: false }], expense: [] };
    expect(computeMonthlyIncome(record, template, 0)).toBe(10000);
  });
});

describe('computeMonthlyExpense', () => {
  it('無當月紀錄時用範本支出,加上質押利息與貸款月付金', () => {
    expect(computeMonthlyExpense(undefined, template, 500.4, 10242)).toBe(20000 + 500 + 10242);
  });

  it('有當月紀錄時優先用紀錄的支出清單', () => {
    const record: MonthRecord = { income: [], expense: [{ id: 'e2', name: '醫療', amount: 3000, category: 'Medical', isRecurring: false }] };
    expect(computeMonthlyExpense(record, template, 0, 0)).toBe(3000);
  });
});

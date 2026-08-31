// src/lib/cashflowCalc.ts
import type { CashflowTemplate, MonthRecord } from '../types';

export function computeMonthlyIncome(
  monthRecord: MonthRecord | undefined,
  cashflowTemplate: CashflowTemplate,
  stakingEarnIncome: number,
): number {
  const items = monthRecord?.income ?? cashflowTemplate.income;
  return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(stakingEarnIncome);
}

export function computeMonthlyExpense(
  monthRecord: MonthRecord | undefined,
  cashflowTemplate: CashflowTemplate,
  stakingBorrowInterest: number,
  totalLoanMonthlyPayments: number,
): number {
  const items = monthRecord?.expense ?? cashflowTemplate.expense;
  return items.reduce((sum, item) => sum + item.amount, 0)
    + Math.round(stakingBorrowInterest)
    + totalLoanMonthlyPayments;
}

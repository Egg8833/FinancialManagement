import type { LoanItem } from '../types';

export type ScheduleRow = {
  period: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  beginningBalance: number;
  endingBalance: number;
  isPaid: boolean;
};

export function calcEndDate(nextPaymentDate: string | undefined, remainingPeriods: number): string {
  if (remainingPeriods <= 0) return '已到期';
  const base = nextPaymentDate ? new Date(nextPaymentDate) : new Date();
  base.setMonth(base.getMonth() + remainingPeriods - 1);
  return `${base.getFullYear()}/${base.getMonth() + 1}/${base.getDate()}`;
}

export function generateSchedule(loan: LoanItem): ScheduleRow[] {
  const paidCount = loan.originalPeriods - loan.remainingPeriods;
  const initP = loan.initialPrincipal ?? loan.principal;
  const rows: ScheduleRow[] = [];
  let currentBalance = initP;

  for (let i = 0; i < loan.originalPeriods; i++) {
    let dateStr = '—';
    if (loan.nextPaymentDate) {
      const d = new Date(loan.nextPaymentDate);
      d.setMonth(d.getMonth() + (i - paidCount));
      dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }
    const beginningBalance = currentBalance;
    const interest = Math.round(beginningBalance * loan.interestRate / 100 / 12);
    let principal = loan.monthlyPayment - interest;
    if (beginningBalance < principal || i === loan.originalPeriods - 1) {
      principal = beginningBalance;
    }
    currentBalance = Math.max(0, beginningBalance - principal);
    if (i === paidCount - 1) currentBalance = loan.principal;
    rows.push({
      period: i + 1,
      date: dateStr,
      payment: principal + interest,
      principal,
      interest,
      beginningBalance,
      endingBalance: currentBalance,
      isPaid: i < paidCount,
    });
    if (currentBalance <= 0 && i >= paidCount) break;
  }
  return rows;
}

export function isPaymentDue(nextPaymentDate: string | undefined): boolean {
  if (!nextPaymentDate) return false;
  return new Date(nextPaymentDate) <= new Date();
}

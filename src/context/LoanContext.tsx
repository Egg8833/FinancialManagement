"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useSyncedState } from '../hooks/useSyncedState';
import type { LoanItem, StakingItem } from '../types';

interface LoanContextType {
  loans: LoanItem[];
  setLoans: (v: LoanItem[] | ((p: LoanItem[]) => LoanItem[])) => void;
  stakingItems: StakingItem[];
  setStakingItems: (v: StakingItem[] | ((p: StakingItem[]) => StakingItem[])) => void;
  borrowingLimits: Record<string, number>;
  setBorrowingLimits: (v: Record<string, number> | ((p: Record<string, number>) => Record<string, number>)) => void;
  recordLoanPayment: (id: string) => void;
  undoLoanPayment: (id: string) => void;
  totalLoanMonthlyPayments: number;
  stakingBorrowInterest: number;
  stakingEarnTotal: number;
  stakingEarnIncome: number;
  clearLoanData: () => void;
}

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export function useLoanContext() {
  const ctx = useContext(LoanContext);
  if (!ctx) throw new Error('useLoanContext must be used within a LoanProvider');
  return ctx;
}

const DEFAULT_LOANS: LoanItem[] = [
  { id: 'loan1', name: '信貸A', bank: '樂天', principal: 800000, initialPrincipal: 800000, interestRate: 2.08, monthlyPayment: 10242, paymentDay: 11, remainingPeriods: 68, loanType: 'installment', originalPeriods: 84, nextPaymentDate: '2026-05-11' },
  { id: 'loan2', name: '信貸B', bank: '王道', principal: 550000, initialPrincipal: 550000, interestRate: 3.20, monthlyPayment: 7274, paymentDay: 15, remainingPeriods: 70, loanType: 'installment', originalPeriods: 70 },
];

const DEFAULT_STAKING: StakingItem[] = [
  { id: 's1', name: 'ETH 2.0 質押', protocol: 'Lido', amount: 15.5, value: 1550000, apy: 3.4, stakingType: 'borrow', borrowDate: '2024-01-15', repayDate: '2025-01-15' },
  { id: 's2', name: 'USDT 活存', protocol: 'Binance Earn', amount: 20000, value: 640000, apy: 6.5, stakingType: 'earn', borrowDate: '2024-02-01' },
  { id: 's3', name: '質押借款A', protocol: '元大', amount: 3734000, value: 3734000, apy: 2.58, stakingType: 'borrow' },
  { id: 's4', name: '質押借款B', protocol: '元大', amount: 126000, value: 126000, apy: 2.85, stakingType: 'borrow' },
];

export function LoanProvider({ children }: { children: ReactNode }) {
  const [loans, setLoans] = useSyncedState<LoanItem[]>('loans', DEFAULT_LOANS, 'app-loans-v5');
  const [stakingItems, setStakingItems] = useSyncedState<StakingItem[]>('stakingItems', DEFAULT_STAKING, 'app-staking-v5');
  const [borrowingLimits, setBorrowingLimits] = useSyncedState<Record<string, number>>('borrowingLimits', {}, 'app-borrowing-limits-v1');

  const borrowItems = useMemo(() => stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow'), [stakingItems]);
  const earnItems   = useMemo(() => stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn'),  [stakingItems]);

  const stakingBorrowInterest    = useMemo(() => borrowItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [borrowItems]);
  const stakingEarnTotal         = useMemo(() => earnItems.reduce((s, i) => s + i.value, 0), [earnItems]);
  const stakingEarnIncome        = useMemo(() => earnItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [earnItems]);
  const totalLoanMonthlyPayments = useMemo(() => loans.reduce((s, l) => s + l.monthlyPayment, 0), [loans]);

  const recordLoanPayment = (id: string) => {
    setLoans(prev => prev.map(loan => {
      if (loan.id !== id || loan.loanType !== 'installment' || loan.remainingPeriods <= 0) return loan;
      let nextDate: string | undefined;
      if (loan.nextPaymentDate) {
        const d = new Date(loan.nextPaymentDate);
        d.setMonth(d.getMonth() + 1);
        nextDate = d.toISOString().split('T')[0];
      }
      const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
      const principalReduction = loan.monthlyPayment - interest;
      return {
        ...loan,
        principal: Math.max(0, Math.round(loan.principal - principalReduction)),
        remainingPeriods: loan.remainingPeriods - 1,
        nextPaymentDate: nextDate,
      };
    }));
  };

  const undoLoanPayment = (id: string) => {
    setLoans(prev => prev.map(loan => {
      if (loan.id !== id || loan.loanType !== 'installment') return loan;
      let prevDate: string | undefined;
      if (loan.nextPaymentDate) {
        const d = new Date(loan.nextPaymentDate);
        d.setMonth(d.getMonth() - 1);
        prevDate = d.toISOString().split('T')[0];
      }
      const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
      const principalReduction = loan.monthlyPayment - interest;
      return {
        ...loan,
        principal: Math.round(loan.principal + principalReduction),
        remainingPeriods: loan.remainingPeriods + 1,
        nextPaymentDate: prevDate,
      };
    }));
  };

  const clearLoanData = () => {
    setLoans([]);
    setStakingItems([]);
    setBorrowingLimits({});
  };

  return (
    <LoanContext.Provider value={{
      loans, setLoans,
      stakingItems, setStakingItems,
      borrowingLimits, setBorrowingLimits,
      recordLoanPayment, undoLoanPayment,
      totalLoanMonthlyPayments,
      stakingBorrowInterest, stakingEarnTotal, stakingEarnIncome,
      clearLoanData,
    }}>
      {children}
    </LoanContext.Provider>
  );
}

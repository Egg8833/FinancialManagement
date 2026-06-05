"use client";
import { useMemo } from 'react';
import { useAppContext, type LoanItem } from '../../context/AppContext';

export function AutoStakingIncomeRow() {
  const { stakingItems, showValues } = useAppContext();
  const total = useMemo(() => stakingItems
    .filter(i => (i.stakingType ?? 'borrow') === 'earn')
    .reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [stakingItems]);
  if (total === 0) return null;
  return (
    <div className="px-4 py-3 flex items-center justify-between bg-emerald-50/50">
      <div>
        <span className="text-sm font-medium text-gray-700">活存/Earn 收益</span>
        <span className="ml-2 px-1 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
      </div>
      <span className="font-bold text-emerald-700 text-sm tabular-nums">
        {showValues ? Math.round(total).toLocaleString('en-US') : '****'}
      </span>
    </div>
  );
}

export function AutoStakingExpenseRow() {
  const { stakingItems, showValues } = useAppContext();
  const total = useMemo(() => stakingItems
    .filter(i => (i.stakingType ?? 'borrow') === 'borrow')
    .reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [stakingItems]);
  if (total === 0) return null;
  return (
    <div className="px-4 py-3 flex items-center justify-between bg-rose-50/50">
      <div>
        <span className="text-sm font-medium text-gray-700">質押利息支出</span>
        <span className="ml-2 px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
      </div>
      <span className="font-bold text-rose-700 text-sm tabular-nums">
        {showValues ? Math.round(total).toLocaleString('en-US') : '****'}
      </span>
    </div>
  );
}

export function AutoLoanExpenseRows() {
  const { loans, showValues } = useAppContext();
  const active = loans.filter((l: LoanItem) => l.principal > 0);
  if (active.length === 0) return null;
  return (
    <>
      {active.map((loan: LoanItem) => (
        <div key={loan.id} className="px-4 py-3 flex items-center justify-between bg-rose-50/30">
          <div>
            <span className="text-sm font-medium text-gray-700">{loan.name}（{loan.bank}）月繳</span>
            <span className="ml-2 px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
          </div>
          <span className="font-bold text-rose-700 text-sm tabular-nums">
            {showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}
          </span>
        </div>
      ))}
    </>
  );
}

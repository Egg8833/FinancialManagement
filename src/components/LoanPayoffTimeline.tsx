'use client';

import { useMemo } from 'react';
import { CalendarCheck, Flag } from 'lucide-react';
import { useAppContext, type LoanItem } from '../context/AppContext';

function calcPayoffDate(loan: LoanItem): Date {
  if (loan.remainingPeriods <= 0) return new Date();
  const base = loan.nextPaymentDate ? new Date(loan.nextPaymentDate) : new Date();
  base.setMonth(base.getMonth() + loan.remainingPeriods - 1);
  return base;
}

function fmtYM(d: Date): string {
  return `${d.getFullYear()} / ${d.getMonth() + 1} 月`;
}

const LOAN_COLORS: { bar: string; label: string; bg: string; text: string }[] = [
  { bar: '#6366f1', label: 'bg-indigo-100',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  { bar: '#f43f5e', label: 'bg-rose-100',    bg: 'bg-rose-50',    text: 'text-rose-700'   },
  { bar: '#f59e0b', label: 'bg-amber-100',   bg: 'bg-amber-50',   text: 'text-amber-700'  },
  { bar: '#10b981', label: 'bg-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-700'},
];

export function LoanPayoffTimeline() {
  const { loans } = useAppContext();
  const activeLoans = loans.filter(l => l.principal > 0 && l.remainingPeriods > 0);

  const timelines = useMemo(() =>
    activeLoans
      .map((loan, idx) => {
        const paid = loan.originalPeriods - loan.remainingPeriods;
        const paidPct = loan.originalPeriods > 0
          ? Math.round((paid / loan.originalPeriods) * 100)
          : 0;
        const totalInterestPaid = (() => {
          let total = 0;
          const initP = loan.initialPrincipal ?? loan.principal + paid * (loan.monthlyPayment - Math.round((loan.initialPrincipal ?? loan.principal) * loan.interestRate / 100 / 12));
          let bal = initP;
          for (let i = 0; i < paid; i++) {
            const interest = Math.round(bal * loan.interestRate / 100 / 12);
            total += interest;
            bal = Math.max(0, bal - (loan.monthlyPayment - interest));
          }
          return total;
        })();
        return {
          loan,
          color: LOAN_COLORS[idx % LOAN_COLORS.length],
          payoffDate: calcPayoffDate(loan),
          paid, paidPct, totalInterestPaid,
        };
      })
      .sort((a, b) => a.payoffDate.getTime() - b.payoffDate.getTime()),
  [activeLoans]);

  if (timelines.length === 0) return null;

  const debtFreeDate = timelines[timelines.length - 1].payoffDate;
  const now = new Date();
  const debtFreeMonths = Math.max(0,
    (debtFreeDate.getFullYear() - now.getFullYear()) * 12 +
    (debtFreeDate.getMonth() - now.getMonth())
  );
  const totalDebt    = activeLoans.reduce((s, l) => s + l.principal, 0);
  const totalMonthly = activeLoans.reduce((s, l) => s + l.monthlyPayment, 0);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-gray-900">還款進度總覽</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">無債身輕日</p>
            <p className="text-base font-black text-indigo-600">{fmtYM(debtFreeDate)}</p>
            <p className="text-xs text-gray-400">還有 {debtFreeMonths} 個月</p>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">剩餘總債務</p>
          <p className="text-base font-black text-gray-900">
            NT${totalDebt >= 10000 ? `${(totalDebt / 10000).toFixed(0)}萬` : totalDebt.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">每月總還款</p>
          <p className="text-base font-black text-gray-900">NT${totalMonthly.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">筆數</p>
          <p className="text-base font-black text-gray-900">{timelines.length} 筆</p>
        </div>
      </div>

      {/* Per-loan progress cards */}
      <div className="space-y-5">
        {timelines.map(({ loan, color, payoffDate, paid, paidPct }) => {
          const remainingPct = 100 - paidPct;
          return (
            <div key={loan.id} className={`rounded-xl p-4 ${color.bg} border border-white`}>
              {/* Loan title row */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.label} ${color.text}`}>
                    {loan.name}（{loan.bank}）
                  </span>
                  <span className="text-xs text-gray-500">{loan.interestRate}% 年利率</span>
                </div>
                <span className={`text-sm font-black ${color.text}`}>{paidPct}% 已還清</span>
              </div>

              {/* Progress bar */}
              <div className="h-5 bg-white/70 rounded-full overflow-hidden relative mb-3 shadow-inner">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                  style={{ width: `${Math.max(paidPct, 4)}%`, backgroundColor: color.bar }}
                >
                  {paidPct >= 15 && (
                    <span className="text-[9px] font-bold text-white">{paidPct}%</span>
                  )}
                </div>
                {/* Remaining label inside bar */}
                {remainingPct > 20 && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400"
                  >
                    剩 {remainingPct}%
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">已還</p>
                  <p className="font-bold text-gray-700">{paid} 期 / {loan.originalPeriods} 期</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">剩餘本金</p>
                  <p className={`font-bold ${color.text}`}>NT${loan.principal.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">月繳</p>
                  <p className="font-bold text-gray-700">NT${loan.monthlyPayment.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">預計還清</p>
                  <p className={`font-bold ${color.text}`}>{fmtYM(payoffDate)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Debt free banner */}
      <div className="mt-5 flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
        <Flag className="w-4 h-4 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-800">
            預計 {fmtYM(debtFreeDate)} 完全無負債
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            還有 {debtFreeMonths} 個月（{(debtFreeMonths / 12).toFixed(1)} 年），共 {timelines.length} 筆貸款全數清償
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";
import { memo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Shield } from 'lucide-react';

export const CashflowSummaryBar = memo(function CashflowSummaryBar({
  totalMonthlyIncome,
  totalMonthlyExpense,
  monthlyNetCashFlow,
  runwayMonths,
  formatCurrency,
}: {
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  runwayMonths: number | null;
  formatCurrency: (v: number) => string;
}) {
  return (
    <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-rose-50 p-2 rounded-lg text-rose-600">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月預計收入</p>
          <p className="font-bold text-gray-900">{formatCurrency(totalMonthlyIncome)}</p>
        </div>
      </div>
      <div className="h-8 w-px bg-gray-100" />
      <div className="flex items-center gap-3">
        <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
          <TrendingDown className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月預計支出</p>
          <p className="font-bold text-gray-900">{formatCurrency(totalMonthlyExpense)}</p>
        </div>
      </div>
      <div className="h-8 w-px bg-gray-100" />
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${monthlyNetCashFlow >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">本月淨現金流</p>
          <p className={`font-bold ${monthlyNetCashFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(monthlyNetCashFlow)}</p>
        </div>
      </div>
      <div className="h-8 w-px bg-gray-100" />
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          runwayMonths === null ? 'bg-gray-50 text-gray-400'
          : runwayMonths >= 6 ? 'bg-emerald-50 text-emerald-600'
          : runwayMonths >= 3 ? 'bg-amber-50 text-amber-600'
          : 'bg-rose-50 text-rose-600'
        }`}>
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">現金彈藥</p>
          <p className={`font-bold ${
            runwayMonths === null ? 'text-gray-400'
            : runwayMonths >= 6 ? 'text-emerald-600'
            : runwayMonths >= 3 ? 'text-amber-600'
            : 'text-rose-600'
          }`}>
            {runwayMonths !== null ? `${runwayMonths.toFixed(1)} 個月` : '—'}
          </p>
          <p className="text-[10px] text-gray-400">流動資金 / 月支出</p>
        </div>
      </div>
    </div>
  );
});

"use client";
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';

interface Props {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  oneTimeIncomeTotal: number;
  oneTimeExpenseTotal: number;
  formatCurrency: (n: number) => string;
}

export function CashflowKPICards({
  totalIncome, totalExpense, netAmount,
  oneTimeIncomeTotal, oneTimeExpenseTotal,
  formatCurrency,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-rose-600 mb-2">
          <ArrowUpCircle className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">本月總收入</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalIncome)}</h2>
        {oneTimeIncomeTotal > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">含本月一次性收入 {formatCurrency(oneTimeIncomeTotal)}</p>
        )}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-emerald-600 mb-2">
          <ArrowDownCircle className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">本月總支出</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpense)}</h2>
        {oneTimeExpenseTotal > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">含本月一次性支出 {formatCurrency(oneTimeExpenseTotal)}</p>
        )}
      </div>
      <div className={`rounded-2xl p-6 shadow-lg text-white ${netAmount >= 0 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-rose-500 to-rose-700'}`}>
        <div className="flex items-center gap-2 mb-2 opacity-80">
          <Wallet className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">本月預計盈餘</span>
        </div>
        <h2 className="text-3xl font-bold">{formatCurrency(netAmount)}</h2>
        <p className="text-xs mt-2 opacity-70">
          儲蓄率: {totalIncome > 0 ? ((netAmount / totalIncome) * 100).toFixed(1) : 0}%
        </p>
      </div>
    </div>
  );
}

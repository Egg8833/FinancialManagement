'use client';

import { useState, useMemo } from 'react';
import { Calculator, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function calcTotalInterest(principal: number, rate: number, periods: number, payment: number): number {
  // Simulate amortization to get actual remaining interest
  let balance = principal;
  let totalInterest = 0;
  const monthlyRate = rate / 100 / 12;
  for (let i = 0; i < periods; i++) {
    const interest = Math.round(balance * monthlyRate);
    totalInterest += interest;
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);
  }
  return totalInterest;
}

function calcNewPayment(principal: number, annualRate: number, periods: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return Math.round(principal / periods);
  return Math.round(principal * r * Math.pow(1 + r, periods) / (Math.pow(1 + r, periods) - 1));
}

export function LoanRefinanceCalc() {
  const { loans } = useAppContext();
  const activeLoans = loans.filter(l => l.principal > 0 && l.loanType === 'installment' && l.remainingPeriods > 0);

  const [selectedId, setSelectedId] = useState<string>(activeLoans[0]?.id ?? '');
  const [newRate, setNewRate] = useState<string>('');
  const [open, setOpen] = useState(false);

  const loan = activeLoans.find(l => l.id === selectedId);

  const result = useMemo(() => {
    if (!loan || !newRate) return null;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0 || rate >= 100) return null;

    const currentTotalInterest = calcTotalInterest(loan.principal, loan.interestRate, loan.remainingPeriods, loan.monthlyPayment);
    const newPayment = calcNewPayment(loan.principal, rate, loan.remainingPeriods);
    const newTotalInterest = calcTotalInterest(loan.principal, rate, loan.remainingPeriods, newPayment);

    const monthlySaving = loan.monthlyPayment - newPayment;
    const totalInterestSaving = currentTotalInterest - newTotalInterest;

    return { currentTotalInterest, newPayment, newTotalInterest, monthlySaving, totalInterestSaving };
  }, [loan, newRate]);

  if (activeLoans.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-500" />
          <span className="font-bold text-gray-900">貸款再融資試算</span>
          <span className="text-xs text-gray-400">— 換低利率能省多少？</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-5">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">選擇貸款</label>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                {activeLoans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}（{l.bank}）— {l.interestRate}% · 剩餘{l.remainingPeriods}期
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">新利率（%）</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="30"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                placeholder="例：1.80"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {loan && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">現有月繳</p>
                <p className="text-lg font-black text-gray-800">NT${loan.monthlyPayment.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{loan.interestRate}% 年利率</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">剩餘本金</p>
                <p className="text-lg font-black text-gray-800">NT${loan.principal.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">剩餘 {loan.remainingPeriods} 期</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-400 mb-1">現有剩餘總利息</p>
                <p className="text-lg font-black text-gray-800">
                  {result ? `NT$${result.currentTotalInterest.toLocaleString()}` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">依目前還款計劃</p>
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-xl p-5 ${result.totalInterestSaving > 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className={`w-4 h-4 ${result.totalInterestSaving > 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span className={`text-sm font-bold ${result.totalInterestSaving > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {result.totalInterestSaving > 0 ? '再融資節省分析' : '注意：新利率高於現有利率'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">新月繳金額</p>
                  <p className="text-base font-black text-gray-900">NT${result.newPayment.toLocaleString()}</p>
                  <p className={`text-xs font-bold mt-0.5 ${result.monthlySaving > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {result.monthlySaving > 0 ? `每月省 ${result.monthlySaving.toLocaleString()}` : `每月多 ${Math.abs(result.monthlySaving).toLocaleString()}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">新利率剩餘總利息</p>
                  <p className="text-base font-black text-gray-900">NT${result.newTotalInterest.toLocaleString()}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-500 mb-0.5">總利息節省</p>
                  <p className={`text-2xl font-black ${result.totalInterestSaving > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {result.totalInterestSaving >= 0 ? '+' : ''}NT${result.totalInterestSaving.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.totalInterestSaving > 0
                      ? `可節省 ${((result.totalInterestSaving / result.currentTotalInterest) * 100).toFixed(0)}% 利息支出`
                      : '此利率不建議再融資'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!result && newRate && (
            <p className="text-xs text-amber-600 mt-2">請輸入有效利率（0.1% - 30%）</p>
          )}
        </div>
      )}
    </div>
  );
}

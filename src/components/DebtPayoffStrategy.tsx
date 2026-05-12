'use client';

import { useMemo, useState } from 'react';
import { useAppContext, type LoanItem } from '../context/AppContext';
import { formatCurrency as _fmt } from '../lib/utils';

type StrategyResult = {
  method: 'snowball' | 'avalanche';
  label: string;
  months: number;
  totalInterest: number;
  order: string[];
};

function simulatePayoff(loans: LoanItem[], extraMonthly: number, method: 'snowball' | 'avalanche'): StrategyResult {
  if (loans.length === 0) return { method, label: method === 'snowball' ? '雪球法' : '雪崩法', months: 0, totalInterest: 0, order: [] };

  // 複製貸款資料
  type LoanState = { id: string; name: string; balance: number; rate: number; minPayment: number };
  let active: LoanState[] = loans.map(l => ({
    id: l.id,
    name: `${l.name}（${l.bank}）`,
    balance: l.principal,
    rate: l.interestRate / 100 / 12,
    minPayment: l.monthlyPayment,
  }));

  // 排序：雪球法（餘額最小優先），雪崩法（利率最高優先）
  const sortFn = method === 'snowball'
    ? (a: LoanState, b: LoanState) => a.balance - b.balance
    : (a: LoanState, b: LoanState) => b.rate - a.rate;

  active.sort(sortFn);

  let totalInterest = 0;
  let months = 0;
  const order: string[] = [];
  const MAX_MONTHS = 600;

  while (active.length > 0 && months < MAX_MONTHS) {
    months++;
    // 計算每筆利息
    for (const loan of active) {
      const interest = loan.balance * loan.rate;
      totalInterest += interest;
      loan.balance = loan.balance - (loan.minPayment - interest);
    }

    // 額外還款給優先貸款（排序後第一筆）
    if (active.length > 0 && extraMonthly > 0) {
      active[0].balance -= extraMonthly;
    }

    // 移除已還清的貸款
    const paid = active.filter(l => l.balance <= 0);
    paid.forEach(l => order.push(l.name));
    active = active.filter(l => l.balance > 0);

    // 重新排序
    active.sort(sortFn);
  }

  return {
    method,
    label: method === 'snowball' ? '雪球法' : '雪崩法',
    months,
    totalInterest: Math.round(totalInterest),
    order,
  };
}

export function DebtPayoffStrategy() {
  const { loans, showValues } = useAppContext();
  const [extraMonthly, setExtraMonthly] = useState(0);

  const activeLoans = loans.filter(l => l.loanType === 'installment' && l.principal > 0 && l.remainingPeriods > 0);

  const snowball = useMemo(() => simulatePayoff(activeLoans, extraMonthly, 'snowball'), [activeLoans, extraMonthly]);
  const avalanche = useMemo(() => simulatePayoff(activeLoans, extraMonthly, 'avalanche'), [activeLoans, extraMonthly]);

  if (activeLoans.length < 2) return null;

  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const monthsSaved = snowball.months - avalanche.months;
  const betterMethod = interestSaved > 0 ? '雪崩法' : '雪球法';

  return (
    <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">還款策略比較</h3>
          <p className="text-xs text-gray-400 mt-0.5">雪球法（心理激勵）vs 雪崩法（數學最優）</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">每月額外還款</span>
          <input
            type="number"
            value={extraMonthly}
            onChange={e => setExtraMonthly(Math.max(0, Number(e.target.value)))}
            className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right outline-none focus:border-indigo-400"
            placeholder="0"
          />
          <span className="text-xs text-gray-400">元</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {[snowball, avalanche].map(strategy => (
          <div
            key={strategy.method}
            className={`rounded-xl p-4 border-2 ${strategy.method === 'avalanche' && interestSaved > 0 ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50'}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-gray-900">{strategy.label}</span>
              {strategy.method === 'snowball' && (
                <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">先還小額</span>
              )}
              {strategy.method === 'avalanche' && (
                <span className="text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">先還高利</span>
              )}
              {betterMethod === strategy.label && (
                <span className="text-xs text-white bg-emerald-500 px-1.5 py-0.5 rounded font-bold ml-auto">省最多</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">還清月數</p>
                <p className="font-bold text-gray-900">
                  {strategy.months} 個月
                  <span className="text-xs text-gray-400 ml-1">（{(strategy.months / 12).toFixed(1)} 年）</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">總利息支出</p>
                <p className="font-bold text-rose-600">{showValues ? strategy.totalInterest.toLocaleString() : '****'}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200/50">
              <p className="text-xs text-gray-400 mb-1">還款順序</p>
              <div className="flex flex-wrap gap-1">
                {strategy.order.map((name, i) => (
                  <span key={i} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                    {i + 1}. {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 比較結論 */}
      <div className={`rounded-xl p-4 ${interestSaved > 0 ? 'bg-emerald-50 border border-emerald-200' : interestSaved < 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
        {interestSaved > 0 ? (
          <p className="text-sm text-emerald-700">
            <span className="font-bold">雪崩法可省 {showValues ? interestSaved.toLocaleString() : '****'} 元利息</span>
            {monthsSaved > 0 && `，早 ${monthsSaved} 個月還清`}。若你需要心理動力，選雪球法也很好，小勝利能維持還款動力。
          </p>
        ) : interestSaved === 0 ? (
          <p className="text-sm text-gray-600">兩種策略在此情境下利息相同，選擇更能激勵自己的方式即可。</p>
        ) : (
          <p className="text-sm text-blue-700">
            <span className="font-bold">雪球法可省 {showValues ? Math.abs(interestSaved).toLocaleString() : '****'} 元利息</span>
            {Math.abs(monthsSaved) > 0 && `，早 ${Math.abs(monthsSaved)} 個月還清`}。
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

interface Props {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  showValues: boolean;
}

export function MonthlySummaryCard({ totalIncome, totalExpense, netAmount, showValues }: Props) {
  const savingsRate = totalIncome > 0 ? Math.round((netAmount / totalIncome) * 100) : 0;
  return (
    <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">收入</p>
            <p className="text-lg font-bold text-green-700">
              {showValues ? `+NT$${totalIncome.toLocaleString()}` : '●●●●'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">支出</p>
            <p className="text-lg font-bold text-red-600">
              {showValues ? `-NT$${totalExpense.toLocaleString()}` : '●●●●'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">結餘</p>
            <p className={`text-lg font-bold ${netAmount >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
              {showValues ? `${netAmount >= 0 ? '+' : ''}NT$${netAmount.toLocaleString()}` : '●●●●'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">儲蓄率</p>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${savingsRate >= 30 ? 'bg-green-500' : savingsRate >= 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${savingsRate >= 30 ? 'text-green-700' : savingsRate >= 15 ? 'text-yellow-700' : 'text-red-700'}`}>
              {savingsRate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

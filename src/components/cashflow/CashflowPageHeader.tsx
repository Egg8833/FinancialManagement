"use client";
import { Settings2 } from 'lucide-react';
import { MonthNavigator } from './MonthNavigator';
import { MonthlySummaryCard } from './MonthlySummaryCard';

interface Props {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  showValues: boolean;
  activeTab: 'flow' | 'category' | 'annual';
  onTabChange: (tab: 'flow' | 'category' | 'annual') => void;
}

export function CashflowPageHeader({
  year, month, onPrev, onNext,
  totalIncome, totalExpense, netAmount, showValues,
  activeTab, onTabChange,
}: Props) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收支管理</h1>
          <p className="text-sm text-gray-500 mt-1">記錄固定收支與本月一次性項目</p>
        </div>
        <MonthNavigator year={year} month={month} onPrev={onPrev} onNext={onNext} />
      </div>

      <MonthlySummaryCard
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netAmount={netAmount}
        showValues={showValues}
      />

      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {(['flow', 'category', 'annual'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'flow' ? '本月收支' : tab === 'category' ? '類別分析' : '年度總覽'}
            </button>
          ))}
        </div>
        <button
          onClick={() => onTabChange('category')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors bg-white"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">管理類別</span>
        </button>
      </div>
    </>
  );
}

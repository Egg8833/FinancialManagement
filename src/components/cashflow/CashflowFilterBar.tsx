"use client";
import { Search, X } from 'lucide-react';

interface Props {
  filterType: 'all' | 'income' | 'expense';
  onFilterType: (t: 'all' | 'income' | 'expense') => void;
  filterKeyword: string;
  onFilterKeyword: (k: string) => void;
}

export function CashflowFilterBar({ filterType, onFilterType, filterKeyword, onFilterKeyword }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl text-sm">
        {(['all', 'income', 'expense'] as const).map(t => (
          <button
            key={t}
            onClick={() => onFilterType(t)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? '全部' : t === 'income' ? '收入' : '支出'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="搜尋項目名稱..."
          value={filterKeyword}
          onChange={e => onFilterKeyword(e.target.value)}
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
        />
        {filterKeyword && (
          <button onClick={() => onFilterKeyword('')} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

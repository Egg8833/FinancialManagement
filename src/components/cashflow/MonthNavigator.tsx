"use client";
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthNavigator({ year, month, onPrev, onNext }: Props) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm shrink-0">
      <button onClick={onPrev} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>
      <div className="text-center min-w-[88px]">
        <p className="font-bold text-gray-900 text-sm leading-tight"><span className="hidden md:inline">{year} 年 </span>{month} 月</p>
        {isCurrent && <p className="text-[10px] text-indigo-500 leading-tight">本月</p>}
      </div>
      <button onClick={onNext} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}

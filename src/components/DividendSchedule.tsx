'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Coins, Layers } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { DividendRecord } from '../types';

type SymbolGroup = {
  symbol: string;
  records: DividendRecord[];
  lastDate: string;
  cashCount: number;
  stockCount: number;
};

export function DividendSchedule() {
  const { dividendRecords } = useAppContext();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo<SymbolGroup[]>(() => {
    const bySymbol = new Map<string, DividendRecord[]>();
    for (const r of dividendRecords) {
      if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, []);
      bySymbol.get(r.symbol)!.push(r);
    }
    return Array.from(bySymbol.entries())
      .map(([symbol, records]) => {
        const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
        return {
          symbol,
          records: sorted,
          lastDate: sorted[0]?.date ?? '',
          cashCount: records.filter(r => r.type !== 'stock').length,
          stockCount: records.filter(r => r.type === 'stock').length,
        };
      })
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [dividendRecords]);

  if (dividendRecords.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-gray-900">股利發放日期一覽</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">每檔股票的現金股利／股票股利發放日期紀錄</p>

      <div className="space-y-2">
        {groups.map(g => {
          const isOpen = expanded[g.symbol] ?? false;
          return (
            <div key={g.symbol} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [g.symbol]: !isOpen }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900">{g.symbol}</span>
                  {g.cashCount > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600">
                      <Coins className="w-2.5 h-2.5" /> 現金 {g.cashCount}
                    </span>
                  )}
                  {g.stockCount > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                      <Layers className="w-2.5 h-2.5" /> 配股 {g.stockCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">最近 {g.lastDate || '—'}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {g.records.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-2 text-xs">
                      <span className="text-gray-600 font-medium tabular-nums">{r.date}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.type === 'stock' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'}`}>
                        {r.type === 'stock' ? '股票股利' : '現金股利'}
                      </span>
                      <span className="text-gray-500">每股 {r.dividendPerShare} · {r.shares.toLocaleString()} 股</span>
                      <span className="font-medium text-emerald-600">
                        {r.type === 'stock'
                          ? `配 ${(r.dividendPerShare * r.shares).toLocaleString()} 股`
                          : `${(r.dividendPerShare * r.shares).toLocaleString()} ${r.currency}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

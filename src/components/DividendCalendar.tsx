'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

type MonthEntry = {
  month: number;
  name: string;
  total: number;      // actual confirmed TWD
  predicted: number;  // predicted TWD based on prior-year pattern
  records: ReturnType<typeof useAppContext>['dividendRecords'];
  predictedItems: { symbol: string; amount: number }[];
};

export function DividendCalendar() {
  const { dividendRecords, usdToTwd } = useAppContext();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [viewYear, setViewYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Build per-month data with pattern-based prediction for future months
  const monthlyData = useMemo<MonthEntry[]>(() => {
    const isFutureMonth = (month: number) =>
      viewYear > currentYear || (viewYear === currentYear && month > currentMonth);

    return MONTH_NAMES.map((name, i) => {
      const month = i + 1;
      // Confirmed records this viewYear/month
      const records = dividendRecords.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === viewYear && d.getMonth() + 1 === month;
      });
      const total = Math.round(records.reduce((sum, r) => {
        const amt = r.dividendPerShare * r.shares;
        return sum + (r.currency === 'USD' ? amt * usdToTwd : amt);
      }, 0));

      // Prediction: only for future months of the current/future year
      let predicted = 0;
      const predictedItems: { symbol: string; amount: number }[] = [];
      if (isFutureMonth(month) && total === 0) {
        // Get all unique symbols
        const symbols = [...new Set(dividendRecords.map(r => r.symbol))];
        for (const symbol of symbols) {
          // Look for same month in prior 2 years
          const priorYearRecords = dividendRecords.filter(r => {
            const d = new Date(r.date);
            return r.symbol === symbol &&
              d.getMonth() + 1 === month &&
              d.getFullYear() >= viewYear - 2 &&
              d.getFullYear() < viewYear;
          });
          if (priorYearRecords.length > 0) {
            // Use average of prior year entries as estimate
            const latestRecord = priorYearRecords
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            const amt = latestRecord.dividendPerShare * latestRecord.shares;
            const amtTWD = latestRecord.currency === 'USD' ? amt * usdToTwd : amt;
            predicted += amtTWD;
            predictedItems.push({ symbol, amount: Math.round(amtTWD) });
          }
        }
      }

      return { month, name, total, predicted: Math.round(predicted), records, predictedItems };
    });
  }, [dividendRecords, viewYear, currentYear, currentMonth, usdToTwd]);

  const annualConfirmed = monthlyData.reduce((s, m) => s + m.total, 0);
  const annualPredicted = monthlyData.reduce((s, m) => s + m.predicted, 0);
  const annualTotal = annualConfirmed + annualPredicted;
  const maxMonthly = Math.max(...monthlyData.map(m => m.total + m.predicted), 1);

  const selectedData = selectedMonth !== null ? monthlyData[selectedMonth - 1] : null;

  const stockBreakdown = useMemo(() => {
    if (!selectedData) return [];
    const bySymbol: Record<string, { symbol: string; total: number; count: number }> = {};
    for (const r of selectedData.records) {
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = { symbol: r.symbol, total: 0, count: 0 };
      const amt = r.dividendPerShare * r.shares;
      bySymbol[r.symbol].total += r.currency === 'USD' ? amt * usdToTwd : amt;
      bySymbol[r.symbol].count += 1;
    }
    return Object.values(bySymbol).sort((a, b) => b.total - a.total);
  }, [selectedData, usdToTwd]);

  if (dividendRecords.length === 0) return null;

  const monthsWithIncome = monthlyData.filter(m => m.total > 0).length;
  const monthsWithPrediction = monthlyData.filter(m => m.predicted > 0).length;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-gray-900">股利日曆</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setViewYear(v => v - 1); setSelectedMonth(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-bold text-gray-700 w-16 text-center">{viewYear} 年</span>
          <button
            onClick={() => { setViewYear(v => v + 1); setSelectedMonth(null); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Annual summary */}
      {annualTotal > 0 && (
        <div className="flex items-center flex-wrap gap-x-6 gap-y-3 mb-5 p-4 bg-emerald-50 rounded-xl">
          <div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">年度預估股利</p>
            <p className="text-2xl font-black text-emerald-700">NT${annualTotal.toLocaleString()}</p>
            {annualPredicted > 0 && (
              <p className="text-[10px] text-emerald-500 mt-0.5">
                含預測 NT${annualPredicted.toLocaleString()}
              </p>
            )}
          </div>
          <div className="h-10 w-px bg-emerald-200" />
          <div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">已確認</p>
            <p className="text-lg font-bold text-emerald-700">NT${annualConfirmed.toLocaleString()}</p>
          </div>
          <div className="h-10 w-px bg-emerald-200" />
          <div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">已發放月份</p>
            <p className="text-lg font-bold text-emerald-700">{monthsWithIncome} 月</p>
          </div>
          {monthsWithPrediction > 0 && (
            <>
              <div className="h-10 w-px bg-emerald-200" />
              <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">預測月份</p>
                <p className="text-lg font-bold text-teal-600">{monthsWithPrediction} 月</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* 12-month heatmap grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {monthlyData.map(({ month, name, total, predicted, predictedItems }) => {
          const combined = total + predicted;
          const isPredicted = predicted > 0 && total === 0;
          const intensity = combined > 0 ? Math.max(0.12, combined / maxMonthly) : 0;
          const isSelected = selectedMonth === month;
          const isCurrentMonth = viewYear === currentYear && month === currentMonth;
          const isPast = viewYear < currentYear || (viewYear === currentYear && month < currentMonth);

          return (
            <button
              key={month}
              onClick={() => setSelectedMonth(isSelected ? null : month)}
              className={`relative rounded-xl p-3 text-left transition-all duration-150 ${
                isSelected ? 'ring-2 ring-emerald-500 shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'
              } ${isPredicted ? 'border border-dashed border-emerald-300' : ''}`}
              style={{
                backgroundColor: combined > 0
                  ? `rgba(16, 185, 129, ${isPredicted ? 0.04 + intensity * 0.18 : 0.07 + intensity * 0.35})`
                  : isPast ? '#f3f4f6' : '#f9fafb',
              }}
            >
              {isCurrentMonth && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
              {isPredicted && (
                <Sparkles className="absolute top-1.5 right-1.5 w-3 h-3 text-teal-400" />
              )}
              <p className={`text-xs font-bold mb-1 ${isCurrentMonth ? 'text-indigo-600' : isPast && combined === 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                {name}
              </p>
              <p className={`text-sm font-black leading-tight ${
                total > 0 ? 'text-emerald-700'
                : predicted > 0 ? 'text-teal-500'
                : 'text-gray-300'
              }`}>
                {combined > 0
                  ? combined >= 10000
                    ? `${(combined / 10000).toFixed(1)}萬`
                    : `${(combined / 1000).toFixed(0)}K`
                  : '—'}
              </p>
              {isPredicted && (
                <p className="text-[9px] text-teal-400 font-bold mt-0.5">預測</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-400/60" />
          <span>已確認</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border border-dashed border-emerald-300 bg-emerald-50" />
          <Sparkles className="w-2.5 h-2.5 text-teal-400" />
          <span>預測（依歷史規律推算，非官方公告）</span>
        </div>
      </div>

      {/* Month detail panel */}
      {selectedData && (selectedData.total > 0 || selectedData.predicted > 0) && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            {viewYear}/{selectedMonth} 詳細明細
          </p>
          {/* Confirmed records */}
          {stockBreakdown.length > 0 && (
            <div className="space-y-2 mb-3">
              {stockBreakdown.map(({ symbol, total, count }) => (
                <div key={symbol} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{symbol}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{count} 筆</span>
                    <span className="text-sm font-bold text-emerald-700 w-28 text-right">
                      NT${Math.round(total).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">已確認合計</span>
                <span className="text-sm font-black text-emerald-700">NT${selectedData.total.toLocaleString()}</span>
              </div>
            </div>
          )}
          {/* Predicted items */}
          {selectedData.predictedItems.length > 0 && (
            <div className="border-t border-dashed border-teal-200 pt-3 space-y-2">
              <p className="text-[10px] text-teal-500 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 預測（依前一年同期推算）
              </p>
              {selectedData.predictedItems.map(({ symbol, amount }) => (
                <div key={symbol} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{symbol}</span>
                  <span className="font-bold text-teal-600 w-28 text-right">
                    ≈ NT${amount.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-teal-600">預測合計</span>
                <span className="text-sm font-black text-teal-600">≈ NT${selectedData.predicted.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {annualTotal === 0 && (
        <p className="text-center text-xs text-gray-400 py-4">
          尚無股利記錄。請至「績效」分頁新增或同步股利資料。
        </p>
      )}
    </div>
  );
}

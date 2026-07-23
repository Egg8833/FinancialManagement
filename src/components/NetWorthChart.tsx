"use client";

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { AssetSnapshot } from '../context/AppContext';
import { ChartSkeleton } from './ui/Skeleton';

type Range = '1M' | '3M' | '6M' | '1Y';

const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

interface NetWorthChartProps {
  snapshots: AssetSnapshot[];
  showValues: boolean;
  formatCurrency: (n: number) => string;
  loading?: boolean;
}

export function NetWorthChart({ snapshots, showValues, formatCurrency, loading = false }: NetWorthChartProps) {
  const [range, setRange] = useState<Range>('3M');

  const data = useMemo(() => {
    const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 86400_000);
    return snapshots
      .filter(s => new Date(s.date) >= cutoff)
      .map(s => ({ ...s, label: s.date.slice(5) }));
  }, [snapshots, range]);

  const ranges: Range[] = ['1M', '3M', '6M', '1Y'];

  // 雲端資料載入中：先顯示 skeleton，避免誤判成「資料累積中」的空狀態
  if (loading) {
    return <ChartSkeleton height="h-56" />;
  }

  if (snapshots.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h3 className="text-base font-bold text-gray-900 mb-1">淨值歷史趨勢</h3>
        <p className="text-sm text-gray-400 mt-1">
          資料累積中，每天自動記錄一筆快照。至少需要 2 筆才能顯示趨勢圖。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">淨值歷史趨勢</h3>
        <div className="flex gap-1">
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                range === r ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {showValues ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${Math.round(v / 10000)}萬`}
              width={48}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), '淨值']}
              labelStyle={{ color: '#6b7280', fontSize: 12 }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              stroke="#4f46e5"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#4f46e5' }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-xl">
          數值已隱藏
        </div>
      )}
    </div>
  );
}

"use client";
import { TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface TrendDataPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

interface Props {
  data: TrendDataPoint[];
  showValues: boolean;
  formatCurrency: (v: number) => string;
}

export function MonthTrendChart({ data, showValues, formatCurrency }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-indigo-500" />
        <h3 className="text-base font-bold text-gray-900">近 12 個月收支趨勢</h3>
      </div>
      <p className="text-xs text-gray-400 mb-5">每月固定收支 + 年度一次性項目（獎金、股利、臨時支出）</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis
            axisLine={false} tickLine={false}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={v => showValues ? `${(v / 1000).toFixed(0)}K` : ''}
            width={38}
          />
          <Tooltip
            formatter={(v: number, name: string) => [formatCurrency(v), name]}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          <Bar dataKey="income"  name="收入"   fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="支出"   fill="#f43f5e" radius={[3, 3, 0, 0]} />
          <Bar dataKey="net"     name="淨盈餘" fill="#6366f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

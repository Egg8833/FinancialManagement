'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

export function HealthScoreTrendChart({ data }: { data: { date: string; score: number }[] }) {
  const scoreTrend = data;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip
          formatter={(v: unknown) => [`${v} 分`, '健康分數']}
          contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        {/* 等級參考線 */}
        {[
          { y: 90, label: '優秀', color: '#10b981' },
          { y: 75, label: '良好', color: '#3b82f6' },
          { y: 60, label: '普通', color: '#eab308' },
        ].map(ref => (
          <ReferenceLine
            key={ref.y} y={ref.y}
            stroke={ref.color} strokeDasharray="4 2"
            label={{ value: ref.label, position: 'insideTopRight', fontSize: 9, fill: ref.color }}
          />
        ))}
        <Line
          type="monotone" dataKey="score"
          stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

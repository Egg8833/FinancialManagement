"use client";

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { AssetCategory } from '../types';

const COLORS = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

interface AssetAllocationChartProps {
  combinedAssets: AssetCategory[];
  totalAssets: number;
  showValues: boolean;
}

export function AssetAllocationChart({ combinedAssets, totalAssets, showValues }: AssetAllocationChartProps) {
  const data = useMemo(() =>
    combinedAssets
      .map(cat => ({
        name: cat.title,
        value: cat.items.reduce((s, i) => s + i.amount, 0),
      }))
      .filter(d => d.value > 0),
    [combinedAssets]
  );

  if (data.length === 0 || totalAssets === 0) return null;

  const investmentValue = data
    .filter(d => d.name === '投資')
    .reduce((s, d) => s + d.value, 0);
  const growthPct = totalAssets > 0 ? ((investmentValue / totalAssets) * 100).toFixed(1) : '0';
  const stablePct = (100 - parseFloat(growthPct)).toFixed(1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">資產配置分析</h3>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            投資型 {growthPct}%
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
            穩定型 {stablePct}%
          </span>
        </div>
      </div>

      {showValues ? (
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="shrink-0">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `NT$ ${Math.round(value).toLocaleString('en-US')}`,
                    '',
                  ]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-2.5 w-full">
            {data.map((item, i) => {
              const pct = totalAssets > 0 ? ((item.value / totalAssets) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700 w-20 shrink-0">{item.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct.toFixed(1)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 w-10 text-right tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              參考：傳統 60/40 配置建議投資型佔 60%，穩定型佔 40%
            </p>
          </div>
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-xl">
          數值已隱藏
        </div>
      )}
    </div>
  );
}

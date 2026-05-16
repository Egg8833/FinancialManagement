"use client";

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { Trash2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const CATEGORY_COLORS = {
  液: '#10b981',   // liquid  — emerald
  投資: '#6366f1', // investment — indigo
  固定: '#3b82f6', // fixed — blue
  應收: '#38bdf8', // receivable — sky
};

export default function ChartPage() {
  const { snapshots, setSnapshots } = useAppContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const chartData = useMemo(() => {
    return snapshots.map(s => ({
      date: s.date.slice(5), // MM-DD
      淨資產: s.netWorth,
      總負債: s.totalLiabilities,
    }));
  }, [snapshots]);

  // Stacked area: only show snapshots that have category breakdown
  const categoryData = useMemo(() => {
    return snapshots
      .filter(s => s.liquid !== undefined || s.investment !== undefined)
      .slice(-60)
      .map(s => ({
        date: s.date.slice(5),
        流動資金: s.liquid ?? 0,
        投資: s.investment ?? 0,
        固定資產: s.fixed ?? 0,
        應收款: s.receivable ?? 0,
      }));
  }, [snapshots]);

  const hasCategoryData = categoryData.length >= 2;

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資產狀態圖</h1>
          <p className="text-sm text-gray-500 mt-1">每日自動記錄快照，追蹤資產負債變化趨勢</p>
        </div>
      </div>

      {/* Net Worth Bar Chart */}
      <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">資產負債趨勢 (TWD)</h3>

        {snapshots.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-3">
            <p className="text-sm">尚無快照資料，回到總覽頁面讓資料自動產生第一筆快照</p>
          </div>
        ) : (
          <div className="h-96 w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 10000).toFixed(0)}萬`}
                    dx={-10}
                  />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number | string) => new Intl.NumberFormat('en-US').format(Number(value))}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="總負債" stackId="a" fill="#f43f5e" radius={[0, 0, 4, 4]} barSize={40} />
                  <Bar dataKey="淨資產" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Asset Category Stacked Area Chart */}
      {hasCategoryData && mounted && (
        <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">資產分類趨勢</h3>
          <p className="text-xs text-gray-400 mb-5">各類資產隨時間的配置變化（最近 60 筆）</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  {[
                    { key: '流動資金', color: CATEGORY_COLORS['液'] },
                    { key: '投資', color: CATEGORY_COLORS['投資'] },
                    { key: '固定資產', color: CATEGORY_COLORS['固定'] },
                    { key: '應收款', color: CATEGORY_COLORS['應收'] },
                  ].map(({ key, color }) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis
                  axisLine={false} tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}萬`}
                  dx={-5}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value: number | string) => [`NT$${Number(value).toLocaleString()}`, undefined]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Area type="monotone" dataKey="流動資金" stackId="1" stroke={CATEGORY_COLORS['液']}    fill={`url(#grad-流動資金)`} strokeWidth={1.5} />
                <Area type="monotone" dataKey="投資"     stackId="1" stroke={CATEGORY_COLORS['投資']}  fill={`url(#grad-投資)`}     strokeWidth={1.5} />
                <Area type="monotone" dataKey="固定資產" stackId="1" stroke={CATEGORY_COLORS['固定']}  fill={`url(#grad-固定資產)`} strokeWidth={1.5} />
                <Area type="monotone" dataKey="應收款"   stackId="1" stroke={CATEGORY_COLORS['應收']}  fill={`url(#grad-應收款)`}   strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-900">快照記錄</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {snapshots.map(s => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 group transition-colors">
                <span className="text-sm font-medium text-gray-700 w-28 shrink-0">{s.date}</span>
                <div className="flex items-center gap-6 text-sm flex-wrap">
                  <span className="text-gray-500">總資產: <span className="font-semibold text-gray-900">{s.totalAssets.toLocaleString('en-US')}</span></span>
                  <span className="text-gray-500">總負債: <span className="font-semibold text-rose-600">{s.totalLiabilities.toLocaleString('en-US')}</span></span>
                  <span className="text-gray-500">淨資產: <span className="font-semibold text-indigo-600">{s.netWorth.toLocaleString('en-US')}</span></span>
                </div>
                <button
                  onClick={() => handleDeleteSnapshot(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-rose-600 transition-opacity ml-4"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

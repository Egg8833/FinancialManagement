"use client";

import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Camera, Trash2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export default function ChartPage() {
  const { netWorth, totalAssets, totalLiabilities, snapshots, setSnapshots } = useAppContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveSnapshot = () => {
    const now = new Date();
    const label = now.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    setSnapshots(prev => [...prev, {
      id: Date.now().toString(),
      date: label,
      totalAssets,
      totalLiabilities,
      netWorth,
    }]);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const chartData = useMemo(() => {
    return snapshots.map(s => ({
      date: s.date,
      淨資產: s.netWorth,
      總負債: s.totalLiabilities,
    }));
  }, [snapshots]);

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資產狀態圖</h1>
          <p className="text-sm text-gray-500 mt-1">手動記錄快照，追蹤資產負債變化趨勢</p>
        </div>
        <button
          onClick={handleSaveSnapshot}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Camera className="w-4 h-4" />
          儲存今日快照
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">資產負債趨勢 (TWD)</h3>

        {snapshots.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Camera className="w-10 h-10 opacity-30" />
            <p className="text-sm">尚無快照資料，請點擊「儲存今日快照」開始記錄</p>
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

'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Pencil, Check, X } from 'lucide-react';
import { useAppContext, type StockSector } from '../context/AppContext';

const SECTORS: StockSector[] = [
  '科技', '金融', '醫療', '消費', '工業',
  '能源', '原物料', '房地產', '公用事業', '通訊', '其他',
];

const SECTOR_COLORS: Record<StockSector, string> = {
  '科技':   '#6366f1',
  '金融':   '#3b82f6',
  '醫療':   '#10b981',
  '消費':   '#f59e0b',
  '工業':   '#64748b',
  '能源':   '#f97316',
  '原物料': '#84cc16',
  '房地產': '#ec4899',
  '公用事業':'#06b6d4',
  '通訊':   '#8b5cf6',
  '其他':   '#94a3b8',
};

export function StockSectorChart() {
  const { stockItems, setStockItems, stockQuotes, usdToTwd } = useAppContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSector, setEditSector] = useState<StockSector>('其他');

  const itemsWithValue = useMemo(() => stockItems.map(item => {
    const quote = stockQuotes[item.symbol];
    const value = quote
      ? quote.currency === 'USD'
        ? quote.price * item.shares * usdToTwd
        : quote.price * item.shares
      : 0;
    return { ...item, value, displayName: quote?.shortName ?? item.symbol };
  }), [stockItems, stockQuotes, usdToTwd]);

  const totalValue = itemsWithValue.reduce((s, i) => s + i.value, 0);

  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of itemsWithValue) {
      const s = item.sector ?? '其他';
      map[s] = (map[s] ?? 0) + item.value;
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [itemsWithValue, totalValue]);

  const geoData = useMemo(() => {
    const tw = itemsWithValue.filter(i => i.symbol.endsWith('.TW') || i.symbol.endsWith('.TWO')).reduce((s, i) => s + i.value, 0);
    const us = itemsWithValue.filter(i => !i.symbol.endsWith('.TW') && !i.symbol.endsWith('.TWO')).reduce((s, i) => s + i.value, 0);
    return [
      { name: '台股', value: tw, pct: totalValue > 0 ? (tw / totalValue) * 100 : 0 },
      { name: '美股/其他', value: us, pct: totalValue > 0 ? (us / totalValue) * 100 : 0 },
    ].filter(d => d.value > 0);
  }, [itemsWithValue, totalValue]);

  const untaggedCount = itemsWithValue.filter(i => !i.sector).length;

  const handleSaveSector = (id: string) => {
    setStockItems(prev => prev.map(s => s.id === id ? { ...s, sector: editSector } : s));
    setEditingId(null);
  };

  if (stockItems.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-gray-900">板塊 & 地區配置</h3>
          {untaggedCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              {untaggedCount} 筆股票尚未設定板塊，請在下方標記
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 板塊 donut */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">板塊分佈</p>
          {sectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sectorData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                  {sectorData.map(entry => (
                    <Cell key={entry.name} fill={SECTOR_COLORS[entry.name as StockSector] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => [(v as number).toLocaleString(), '市值']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Legend formatter={name => {
                  const d = sectorData.find(s => s.name === name);
                  return `${name} ${d ? d.pct.toFixed(0) + '%' : ''}`;
                }} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">請設定板塊後顯示</div>
          )}
        </div>

        {/* 地區 donut */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">地區分佈</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={geoData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                {geoData.map((entry, i) => (
                  <Cell key={entry.name} fill={i === 0 ? '#10b981' : '#6366f1'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: unknown) => [(v as number).toLocaleString(), '市值']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend formatter={name => {
                const d = geoData.find(g => g.name === name);
                return `${name} ${d ? d.pct.toFixed(0) + '%' : ''}`;
              }} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 每筆股票板塊標記 */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">板塊標記</p>
        <div className="space-y-2">
          {itemsWithValue.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate">{item.displayName}</span>
                <span className="text-xs text-gray-400 ml-2">{item.symbol}</span>
              </div>
              {editingId === item.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={editSector}
                    onChange={e => setEditSector(e.target.value as StockSector)}
                    className="text-xs border border-indigo-200 rounded px-2 py-1 outline-none"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => handleSaveSector(item.id)} className="text-indigo-600 hover:text-indigo-800"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {item.sector ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${SECTOR_COLORS[item.sector]}20`, color: SECTOR_COLORS[item.sector] }}>
                      {item.sector}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 italic">未設定</span>
                  )}
                  <button
                    onClick={() => { setEditingId(item.id); setEditSector(item.sector ?? '其他'); }}
                    className="text-gray-300 hover:text-indigo-500"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

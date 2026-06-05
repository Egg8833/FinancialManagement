"use client";
import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useAppContext, type CashFlowItem } from '../../context/AppContext';
import {
  CATEGORY_COLORS, UNCATEGORIZED_COLOR,
  buildDonutData, buildCategoryMonthData, getCategoryColor,
} from '../../lib/categoryUtils';
import { CategoryManager } from './CategoryManager';

interface Props {
  expenseItems: CashFlowItem[];
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  setExpenseItems: (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => void;
  showValues: boolean;
}

export function CategoryAnalysisTab({
  expenseItems,
  customCategories,
  setCustomCategories,
  setExpenseItems,
  showValues,
}: Props) {
  const { categoryBudgets, setCategoryBudgets } = useAppContext();
  const donutData = useMemo(() => buildDonutData(expenseItems), [expenseItems]);
  const categoryMonthData = useMemo(() => buildCategoryMonthData(expenseItems), [expenseItems]);
  const allCats = useMemo(() => {
    const set = new Set<string>();
    for (const item of expenseItems) set.add(item.customCategory ?? '未分類');
    return Array.from(set);
  }, [expenseItems]);

  return (
    <div className="space-y-6 mt-2">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <CategoryManager
          customCategories={customCategories}
          setCustomCategories={setCustomCategories}
          setExpenseItems={setExpenseItems}
        />
        {customCategories.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">類別月預算</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {customCategories.map(cat => {
                const spent = expenseItems.filter(e => e.customCategory === cat).reduce((s, e) => s + e.amount, 0);
                const budget = categoryBudgets[cat] ?? 0;
                const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                const color = getCategoryColor(cat, customCategories);
                return (
                  <div key={cat} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color }}>{cat}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">預算</span>
                        <input
                          type="number"
                          value={budget || ''}
                          onChange={e => setCategoryBudgets(prev => ({ ...prev, [cat]: Number(e.target.value) || 0 }))}
                          placeholder="未設定"
                          className="w-20 text-xs text-right border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-300"
                        />
                      </div>
                    </div>
                    {budget > 0 && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>已用 {showValues ? spent.toLocaleString() : '****'}</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {donutData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            尚無支出項目，請在「收支管理」tab 新增支出並設定類別
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">當月佔比</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                    {donutData.map(entry => {
                      const color = entry.name === '未分類' ? UNCATEGORIZED_COLOR : getCategoryColor(entry.name, customCategories);
                      return <Cell key={entry.name} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [showValues ? `NT$${v.toLocaleString()}` : '****', name]}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend
                    formatter={(name: string) => {
                      const d = donutData.find(x => x.name === name);
                      const total = donutData.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 && d ? ((d.value / total) * 100).toFixed(0) : '0';
                      return `${name} ${pct}%`;
                    }}
                    iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">近 12 個月趨勢</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryMonthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => showValues ? `${(v / 1000).toFixed(0)}K` : ''} width={35} />
                  <Tooltip
                    formatter={(v: number, name: string) => [showValues ? `NT$${v.toLocaleString()}` : '****', name]}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {allCats.map((cat, idx) => {
                    const color = cat === '未分類' ? UNCATEGORIZED_COLOR : getCategoryColor(cat, customCategories);
                    return (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={color} radius={idx === allCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

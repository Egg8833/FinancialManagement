"use client";

import { useState, useMemo } from 'react';
import { Wallet, Plus, Trash2, Pencil, Check, X, ArrowUpCircle, ArrowDownCircle, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import { useAppContext, type CashFlowItem, type LoanItem } from '../../context/AppContext';
import {
  CATEGORY_COLORS, UNCATEGORIZED_COLOR,
  buildDonutData, buildCategoryMonthData, getCategoryColor,
} from '../../lib/categoryUtils';
import { formatCurrency as _fmt } from '../../lib/utils';
import { AnnualTracker } from '../../components/AnnualTracker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';

export default function CashFlowPage() {
  const {
    incomeItems, setIncomeItems,
    expenseItems, setExpenseItems,
    annualEntries,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    showValues,
    customCategories, setCustomCategories,
  } = useAppContext();

  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [activeTab, setActiveTab] = useState<'flow' | 'category'>('flow');

  const formatCurrency = (amount: number) => _fmt(amount, showValues);

  const handleAddItem = (type: 'income' | 'expense', name: string, amount: number, customCategory?: string) => {
    const newItem: CashFlowItem = {
      id: Date.now().toString(),
      name,
      amount,
      category: 'General',
      isRecurring: true,
      customCategory,
    };
    if (type === 'income') setIncomeItems(prev => [...prev, newItem]);
    else setExpenseItems(prev => [...prev, newItem]);
  };

  const handleDeleteItem = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') setIncomeItems(prev => prev.filter(item => item.id !== id));
    else setExpenseItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (type: 'income' | 'expense', id: string, name: string, amount: number, customCategory?: string) => {
    const updateFn = (prev: CashFlowItem[]) =>
      prev.map(item => item.id === id ? { ...item, name, amount, customCategory } : item);
    if (type === 'income') setIncomeItems(updateFn);
    else setExpenseItems(updateFn);
  };

  // 12-month trend
  const monthTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      let income = totalMonthlyIncome;
      let expense = totalMonthlyExpense;
      for (const entry of annualEntries) {
        if (entry.year === year && entry.month === month) {
          if (entry.category === 'dividend' || entry.category === 'bonus' || entry.category === 'other_income') {
            income += entry.amount;
          } else if (entry.category === 'one_time_expense') {
            expense += entry.amount;
          }
        }
      }
      return { label: `${month}月`, income: Math.round(income), expense: Math.round(expense), net: Math.round(income - expense) };
    });
  }, [totalMonthlyIncome, totalMonthlyExpense, annualEntries]);

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收支管理 (Cash Flow)</h1>
          <p className="text-sm text-gray-500 mt-1">追蹤每月的收入與支出流量</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(['flow', 'category'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'flow' ? '收支管理' : '類別分析'}
          </button>
        ))}
      </div>

      {activeTab === 'flow' && (
        <>
          {/* Summary KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <ArrowUpCircle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">每月總收入</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalMonthlyIncome)}</h2>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <ArrowDownCircle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">每月總支出</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalMonthlyExpense)}</h2>
            </div>

            <div className={`rounded-2xl p-6 shadow-lg text-white ${monthlyNetCashFlow >= 0 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-rose-500 to-rose-700'}`}>
              <div className="flex items-center gap-2 mb-2 opacity-80">
                <Wallet className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">每月預計盈餘</span>
              </div>
              <h2 className="text-3xl font-bold">{formatCurrency(monthlyNetCashFlow)}</h2>
              <p className="text-xs mt-2 opacity-70">儲蓄率: {totalMonthlyIncome > 0 ? ((monthlyNetCashFlow / totalMonthlyIncome) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Income Column */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">收入項目</h3>
                <button onClick={() => setIsAddingIncome(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 新增收入
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-50">
                  {isAddingIncome && (
                    <AddItemRow
                      type="income"
                      customCategories={customCategories}
                      onConfirm={(n, a, c) => { handleAddItem('income', n, a, c); setIsAddingIncome(false); }}
                      onCancel={() => setIsAddingIncome(false)}
                    />
                  )}
                  {incomeItems.map(item => (
                    <CashFlowRow
                      key={item.id}
                      item={item}
                      type="income"
                      customCategories={customCategories}
                      onUpdate={(n, a, c) => handleUpdateItem('income', item.id, n, a, c)}
                      onDelete={() => handleDeleteItem('income', item.id)}
                      showValues={showValues}
                    />
                  ))}
                  <AutoStakingIncomeRow />
                  {incomeItems.length === 0 && !isAddingIncome && (
                    <div className="p-8 text-center text-gray-400 text-sm">尚無手動收入項目</div>
                  )}
                </div>
              </div>
            </div>

            {/* Expense Column */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">支出項目</h3>
                <button onClick={() => setIsAddingExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 新增支出
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-50">
                  {isAddingExpense && (
                    <AddItemRow
                      type="expense"
                      customCategories={customCategories}
                      onConfirm={(n, a, c) => { handleAddItem('expense', n, a, c); setIsAddingExpense(false); }}
                      onCancel={() => setIsAddingExpense(false)}
                    />
                  )}
                  {expenseItems.map(item => (
                    <CashFlowRow
                      key={item.id}
                      item={item}
                      type="expense"
                      customCategories={customCategories}
                      onUpdate={(n, a, c) => handleUpdateItem('expense', item.id, n, a, c)}
                      onDelete={() => handleDeleteItem('expense', item.id)}
                      showValues={showValues}
                    />
                  ))}
                  <AutoStakingExpenseRow />
                  <AutoLoanExpenseRow />
                  {expenseItems.length === 0 && !isAddingExpense && (
                    <div className="p-8 text-center text-gray-400 text-sm">尚無手動支出項目</div>
                  )}
                </div>
                <div className="border-t-2 border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
                  <span className="text-sm font-bold text-gray-600">支出合計</span>
                  <span className="text-base font-bold text-rose-600">{formatCurrency(totalMonthlyExpense)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 12-month trend chart */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-8">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h3 className="text-base font-bold text-gray-900">近 12 個月收支趨勢</h3>
            </div>
            <p className="text-xs text-gray-400 mb-5">每月固定收支 + 年度一次性項目（獎金、股利、臨時支出）</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barCategoryGap="30%">
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
                <Bar dataKey="income" name="收入" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="支出" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="net" name="淨盈餘" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <AnnualTracker />
        </>
      )}

      {activeTab === 'category' && (
        <CategoryAnalysisTab
          expenseItems={expenseItems}
          customCategories={customCategories}
          setCustomCategories={setCustomCategories}
          setExpenseItems={setExpenseItems}
          showValues={showValues}
        />
      )}
    </>
  );
}

function CategoryManager({
  customCategories,
  setCustomCategories,
  setExpenseItems,
}: {
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  setExpenseItems: (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => void;
}) {
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || customCategories.includes(trimmed)) return;
    setCustomCategories(prev => [...prev, trimmed]);
    setNewCat('');
  };

  const handleDelete = (cat: string) => {
    setCustomCategories(prev => prev.filter(c => c !== cat));
    setExpenseItems(prev =>
      prev.map(item => item.customCategory === cat ? { ...item, customCategory: undefined } : item)
    );
  };

  const handleRename = (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== oldName && customCategories.includes(trimmed))) return;
    setCustomCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    setExpenseItems(prev =>
      prev.map(item => item.customCategory === oldName ? { ...item, customCategory: trimmed } : item)
    );
    setEditingCat(null);
  };

  return (
    <div className="mb-6">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">類別管理</p>
      <div className="flex flex-wrap gap-2 items-center">
        {customCategories.map((cat, i) =>
          editingCat === cat ? (
            <div key={cat} className="flex items-center gap-1">
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(cat);
                  if (e.key === 'Escape') setEditingCat(null);
                }}
                className="text-xs border border-indigo-300 rounded px-2 py-0.5 w-20 outline-none"
              />
              <button onClick={() => handleRename(cat)} className="text-indigo-600 hover:text-indigo-800">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditingCat(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              key={cat}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}20`,
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }}
            >
              <span className="cursor-pointer" onDoubleClick={() => { setEditingCat(cat); setEditValue(cat); }}>
                {cat}
              </span>
              <button onClick={() => { setEditingCat(cat); setEditValue(cat); }} className="opacity-50 hover:opacity-100 ml-0.5">
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => handleDelete(cat)} className="opacity-50 hover:opacity-100">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )
        )}
        <div className="flex items-center gap-1">
          <input
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="新增類別"
            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-20 outline-none focus:border-indigo-300"
          />
          <button onClick={handleAdd} className="text-indigo-600 hover:text-indigo-800">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryAnalysisTab({
  expenseItems,
  customCategories,
  setCustomCategories,
  setExpenseItems,
  showValues,
}: {
  expenseItems: CashFlowItem[];
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  setExpenseItems: (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => void;
  showValues: boolean;
}) {
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
                    {donutData.map((entry) => {
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

function CashFlowRow({
  item,
  type,
  onUpdate,
  onDelete,
  showValues,
  customCategories,
}: {
  item: CashFlowItem;
  type: 'income' | 'expense';
  onUpdate: (n: string, a: number, c?: string) => void;
  onDelete: () => void;
  showValues: boolean;
  customCategories: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount.toString());
  const [customCategory, setCustomCategory] = useState<string | undefined>(item.customCategory);
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate(name, Number(amount) || 0, customCategory);
    setIsEditing(false);
    toast('已更新項目');
  };

  const handleDelete = () => {
    onDelete();
    toast(`已刪除「${item.name}」`, 'info');
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-gray-50 space-y-2">
        <div className="flex items-center gap-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" placeholder="名稱" />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-24 border rounded px-2 py-1 text-sm text-right" placeholder="金額" />
          <button onClick={handleSave} className="text-indigo-600"><Check className="w-4 h-4" /></button>
          <button onClick={() => setIsEditing(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        {type === 'expense' && (
          <div className="flex items-center gap-3">
            <select
              value={customCategory ?? ''}
              onChange={e => setCustomCategory(e.target.value || undefined)}
              className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-indigo-300 bg-white"
            >
              <option value="">不分類</option>
              {customCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 hover:bg-gray-50 group transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{item.name}</span>
            {item.customCategory && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{
                  backgroundColor: `${getCategoryColor(item.customCategory, customCategories)}20`,
                  color: getCategoryColor(item.customCategory, customCategories),
                }}
              >
                {item.customCategory}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 uppercase tracking-tighter">每月固定</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-900 text-sm">{showValues ? item.amount.toLocaleString() : '****'}</span>
          <div className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 flex gap-1">
            <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          message={`確定要刪除「${item.name}」嗎？`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function AddItemRow({
  type,
  onConfirm,
  onCancel,
  customCategories,
}: {
  type: 'income' | 'expense';
  onConfirm: (n: string, a: number, c?: string) => void;
  onCancel: () => void;
  customCategories: string[];
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [customCategory, setCustomCategory] = useState<string | undefined>(undefined);

  return (
    <div className="p-4 bg-indigo-50 space-y-2">
      <div className="flex items-center gap-3">
        <input type="text" placeholder="名稱" value={name} onChange={e => setName(e.target.value)} className="flex-1 border border-indigo-200 rounded px-2 py-1 text-sm outline-none" autoFocus />
        <input type="number" placeholder="金額" value={amount} onChange={e => setAmount(e.target.value)} className="w-24 border border-indigo-200 rounded px-2 py-1 text-sm text-right outline-none" />
        <button onClick={() => onConfirm(name, Number(amount) || 0, customCategory)} className="text-indigo-600 font-bold"><Check className="w-4 h-4" /></button>
        <button onClick={onCancel} className="text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      {type === 'expense' && (
        <div className="flex items-center gap-3">
          <select
            value={customCategory ?? ''}
            onChange={e => setCustomCategory(e.target.value || undefined)}
            className="text-xs border border-indigo-200 rounded px-2 py-1 outline-none bg-white"
          >
            <option value="">不分類</option>
            {customCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function AutoStakingIncomeRow() {
  const { stakingItems, showValues } = useAppContext();
  const earnItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');
  const totalIncome = earnItems.reduce((sum, item) => sum + (item.value * item.apy / 100 / 12), 0);
  if (totalIncome === 0) return null;
  return (
    <div className="p-4 flex items-center justify-between bg-emerald-50/50">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">活存/Earn 收益</span>
        <span className="text-[10px] text-emerald-600 flex items-center gap-1">
          <span className="px-1 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
          同步自質押管理分頁
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-emerald-700 text-sm">{showValues ? Math.round(totalIncome).toLocaleString() : '****'}</span>
        <div className="invisible flex gap-1">
          <button className="p-1"><Pencil className="w-3.5 h-3.5" /></button>
          <button className="p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function AutoLoanExpenseRow() {
  const { loans, showValues } = useAppContext();
  const activeLoans = loans.filter(l => l.principal > 0);
  if (activeLoans.length === 0) return null;
  return (
    <>
      {activeLoans.map((loan: LoanItem) => (
        <div key={loan.id} className="p-4 flex items-center justify-between bg-rose-50/30">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700">{loan.name}（{loan.bank}）月繳</span>
            <span className="text-[10px] text-rose-500 flex items-center gap-1">
              <span className="px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
              同步自借貸管理分頁
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-bold text-rose-700 text-sm">{showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}</span>
            <div className="invisible flex gap-1">
              <button className="p-1"><Pencil className="w-3.5 h-3.5" /></button>
              <button className="p-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function AutoStakingExpenseRow() {
  const { stakingItems, showValues } = useAppContext();
  const borrowItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const totalInterest = borrowItems.reduce((sum, item) => sum + (item.value * item.apy / 100 / 12), 0);
  if (totalInterest === 0) return null;
  return (
    <div className="p-4 flex items-center justify-between bg-rose-50/50">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">質押利息支出</span>
        <span className="text-[10px] text-rose-500 flex items-center gap-1">
          <span className="px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
          同步自質押管理分頁
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-rose-700 text-sm">{showValues ? Math.round(totalInterest).toLocaleString() : '****'}</span>
        <div className="invisible flex gap-1">
          <button className="p-1"><Pencil className="w-3.5 h-3.5" /></button>
          <button className="p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

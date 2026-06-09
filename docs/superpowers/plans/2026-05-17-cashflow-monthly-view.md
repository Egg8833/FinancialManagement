# Cashflow Monthly View (Option C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the cashflow page as a month-aware view that shows which month is being managed, with a fixed recurring items section and an inline "this month's one-time entries" section — replacing the confusing isRecurring toggle with a clear two-section layout.

**Architecture:** The existing `annualEntries` (AnnualEntry[]) already stores one-time entries by year+month, so no new data model is needed. The cashflow page adds a month navigator (top-right), renders fixed `incomeItems`/`expenseItems` in one section, and renders the selected month's `annualEntries` in a second section. KPI row computes month-specific totals by adding annualEntries for the selected month to the fixed monthly base. The category analysis tab and AnnualTracker are preserved unchanged.

**Tech Stack:** Next.js 15.5 · React 19 · TypeScript · Tailwind CSS 4 · lucide-react · recharts · localStorage via `useStickyState`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/app/cashflow/page.tsx` | **Full rewrite** | Month navigator, two-section layout, no isRecurring toggle, inline one-time entries |
| `src/app/annual/page.tsx` | **Tiny fix** | Remove `isRecurring !== false` filter (2 lines) — all cashflow items are now recurring by design |

`src/context/AppContext.tsx` — no changes needed (already correct)  
`src/components/AnnualTracker.tsx` — no changes needed (already uses all items without filter)

---

## Task 1: Fix annual/page.tsx isRecurring filter

**Files:**
- Modify: `src/app/annual/page.tsx:137-138`

- [ ] **Step 1: Open the file and locate the filter**

Lines 137–138 in `src/app/annual/page.tsx` currently read:
```ts
const fixedIncome  = useMemo(() => incomeItems.filter(i => i.isRecurring !== false).reduce((s, i) => s + i.amount, 0), [incomeItems]);
const fixedExpense = useMemo(() => expenseItems.filter(i => i.isRecurring !== false).reduce((s, i) => s + i.amount, 0), [expenseItems]);
```

Replace them with (drop the `.filter(...)` — all cashflow items are recurring by design in Option C):
```ts
const fixedIncome  = useMemo(() => incomeItems.reduce((s, i) => s + i.amount, 0), [incomeItems]);
const fixedExpense = useMemo(() => expenseItems.reduce((s, i) => s + i.amount, 0), [expenseItems]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/user/Desktop/FinancialManagement && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors about annual/page.tsx

- [ ] **Step 3: Commit**

```bash
git add src/app/annual/page.tsx
git commit -m "fix: remove isRecurring filter from annual page fixed income/expense — all cashflow items are recurring by design"
```

---

## Task 2: Rewrite src/app/cashflow/page.tsx

**Files:**
- Rewrite: `src/app/cashflow/page.tsx`

The full new file is given in the steps below. Read it carefully — every component is shown completely.

- [ ] **Step 1: Write the new cashflow/page.tsx**

Replace the entire file with the following:

```tsx
"use client";

import { useState, useMemo } from 'react';
import {
  Wallet, Plus, Trash2, Pencil, Check, X,
  ArrowUpCircle, ArrowDownCircle, TrendingUp, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import {
  useAppContext,
  type CashFlowItem, type LoanItem, type AnnualEntry, type AnnualEntryCategory,
} from '../../context/AppContext';
import {
  CATEGORY_COLORS, UNCATEGORIZED_COLOR,
  buildDonutData, buildCategoryMonthData, getCategoryColor,
} from '../../lib/categoryUtils';
import { formatCurrency as _fmt } from '../../lib/utils';
import { AnnualTracker } from '../../components/AnnualTracker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../context/ToastContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_ENTRY_CATS: { key: AnnualEntryCategory; label: string }[] = [
  { key: 'other_income', label: '其他收入' },
  { key: 'bonus',        label: '業績獎金' },
  { key: 'dividend',     label: '股利收入' },
];

const EXPENSE_ENTRY_CATS: { key: AnnualEntryCategory; label: string }[] = [
  { key: 'one_time_expense', label: '其他支出' },
  { key: 'travel',           label: '旅遊'     },
  { key: 'medical',          label: '醫療/健康' },
  { key: 'equipment',        label: '設備購置' },
];

const INCOME_ENTRY_KEYS = new Set<AnnualEntryCategory>(['other_income', 'bonus', 'dividend']);

// ─── MonthNavigator ───────────────────────────────────────────────────────────

function MonthNavigator({
  year, month, onPrev, onNext,
}: { year: number; month: number; onPrev: () => void; onNext: () => void }) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm shrink-0">
      <button onClick={onPrev} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>
      <div className="text-center min-w-[88px]">
        <p className="font-bold text-gray-900 text-sm leading-tight">{year} 年 {month} 月</p>
        {isCurrent && <p className="text-[10px] text-indigo-500 leading-tight">本月</p>}
      </div>
      <button onClick={onNext} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}

// ─── OneTimeEntryRow ──────────────────────────────────────────────────────────

function OneTimeEntryRow({
  entry, onDelete, showValues,
}: { entry: AnnualEntry; onDelete: () => void; showValues: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const catLabel = [
    ...INCOME_ENTRY_CATS,
    ...EXPENSE_ENTRY_CATS,
  ].find(c => c.key === entry.category)?.label ?? entry.category;

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 group transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-800 truncate">{entry.name}</span>
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
          {catLabel}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-sm tabular-nums text-gray-900">
          {showValues ? entry.amount.toLocaleString('en-US') : '****'}
        </span>
        <div className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setConfirm(true)}
            className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          message={`確定要刪除「${entry.name}」嗎？`}
          onConfirm={onDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── AddOneTimeEntryRow ───────────────────────────────────────────────────────

function AddOneTimeEntryRow({
  type, onConfirm, onCancel,
}: {
  type: 'income' | 'expense';
  onConfirm: (name: string, amount: number, category: AnnualEntryCategory) => void;
  onCancel: () => void;
}) {
  const cats = type === 'income' ? INCOME_ENTRY_CATS : EXPENSE_ENTRY_CATS;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<AnnualEntryCategory>(cats[0].key);

  const submit = () => onConfirm(name.trim(), Number(amount) || 0, category);
  const bgClass = type === 'income' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';
  const borderColor = type === 'income' ? 'border-emerald-200' : 'border-rose-200';
  const focusColor = type === 'income' ? 'focus:border-emerald-400' : 'focus:border-rose-400';

  return (
    <div className={`px-4 py-3 ${bgClass} border-b`}>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <input
          autoFocus
          type="text"
          placeholder="項目名稱"
          value={name}
          onChange={e => setName(e.target.value)}
          className={`flex-1 min-w-0 border ${borderColor} rounded-lg px-3 py-1.5 text-sm outline-none ${focusColor} bg-white`}
        />
        <input
          type="number"
          placeholder="金額"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className={`w-28 border ${borderColor} rounded-lg px-3 py-1.5 text-sm text-right outline-none ${focusColor} bg-white`}
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value as AnnualEntryCategory)}
          className={`shrink-0 text-xs border ${borderColor} rounded-lg px-2 py-1.5 outline-none ${focusColor} bg-white text-gray-600`}
        >
          {cats.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={submit} className="p-1.5 text-indigo-600 hover:text-indigo-800 shrink-0">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── CashFlowRow (fixed items — no isRecurring) ───────────────────────────────

function CashFlowRow({
  item, type, onUpdate, onDelete, showValues, customCategories,
}: {
  item: CashFlowItem;
  type: 'income' | 'expense';
  onUpdate: (name: string, amount: number, customCategory?: string) => void;
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
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white"
            placeholder="項目名稱"
          />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:border-indigo-400 bg-white"
            placeholder="金額"
          />
          {type === 'expense' && customCategories.length > 0 && (
            <select
              value={customCategory ?? ''}
              onChange={e => setCustomCategory(e.target.value || undefined)}
              className="shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-white text-gray-600"
            >
              <option value="">不分類</option>
              {customCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          )}
          <button onClick={handleSave} className="p-1.5 text-indigo-600 hover:text-indigo-800 shrink-0">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setIsEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 hover:bg-gray-50 group transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
          {item.customCategory && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `${getCategoryColor(item.customCategory, customCategories)}20`,
                color: getCategoryColor(item.customCategory, customCategories),
              }}
            >
              {item.customCategory}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-sm tabular-nums text-gray-900">
            {showValues ? item.amount.toLocaleString('en-US') : '****'}
          </span>
          <div className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 flex gap-0.5 transition-opacity">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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

// ─── AddFixedItemRow (no isRecurring toggle) ──────────────────────────────────

function AddFixedItemRow({
  type, onConfirm, onCancel, customCategories,
}: {
  type: 'income' | 'expense';
  onConfirm: (name: string, amount: number, customCategory?: string) => void;
  onCancel: () => void;
  customCategories: string[];
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [customCategory, setCustomCategory] = useState<string | undefined>(undefined);

  const submit = () => onConfirm(name.trim(), Number(amount) || 0, customCategory);

  return (
    <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <input
          autoFocus
          type="text"
          placeholder="項目名稱"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white"
        />
        <input
          type="number"
          placeholder="金額"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className="w-28 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:border-indigo-400 bg-white"
        />
        {type === 'expense' && customCategories.length > 0 && (
          <select
            value={customCategory ?? ''}
            onChange={e => setCustomCategory(e.target.value || undefined)}
            className="shrink-0 text-xs border border-indigo-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-white text-gray-600"
          >
            <option value="">不分類</option>
            {customCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        )}
        <button onClick={submit} className="p-1.5 text-indigo-600 hover:text-indigo-800 shrink-0">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Auto rows (unchanged logic, just cleaned up) ─────────────────────────────

function AutoStakingIncomeRow() {
  const { stakingItems, showValues } = useAppContext();
  const total = useMemo(() => stakingItems
    .filter(i => (i.stakingType ?? 'borrow') === 'earn')
    .reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [stakingItems]);
  if (total === 0) return null;
  return (
    <div className="px-4 py-3 flex items-center justify-between bg-emerald-50/50">
      <div>
        <span className="text-sm font-medium text-gray-700">活存/Earn 收益</span>
        <span className="ml-2 px-1 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
      </div>
      <span className="font-bold text-emerald-700 text-sm tabular-nums">
        {showValues ? Math.round(total).toLocaleString('en-US') : '****'}
      </span>
    </div>
  );
}

function AutoStakingExpenseRow() {
  const { stakingItems, showValues } = useAppContext();
  const total = useMemo(() => stakingItems
    .filter(i => (i.stakingType ?? 'borrow') === 'borrow')
    .reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [stakingItems]);
  if (total === 0) return null;
  return (
    <div className="px-4 py-3 flex items-center justify-between bg-rose-50/50">
      <div>
        <span className="text-sm font-medium text-gray-700">質押利息支出</span>
        <span className="ml-2 px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
      </div>
      <span className="font-bold text-rose-700 text-sm tabular-nums">
        {showValues ? Math.round(total).toLocaleString('en-US') : '****'}
      </span>
    </div>
  );
}

function AutoLoanExpenseRow() {
  const { loans, showValues } = useAppContext();
  const active = loans.filter(l => l.principal > 0);
  if (active.length === 0) return null;
  return (
    <>
      {active.map((loan: LoanItem) => (
        <div key={loan.id} className="px-4 py-3 flex items-center justify-between bg-rose-50/30">
          <div>
            <span className="text-sm font-medium text-gray-700">{loan.name}（{loan.bank}）月繳</span>
            <span className="ml-2 px-1 py-0.5 bg-rose-100 text-rose-500 text-[9px] font-bold rounded uppercase animate-pulse">Auto</span>
          </div>
          <span className="font-bold text-rose-700 text-sm tabular-nums">
            {showValues ? loan.monthlyPayment.toLocaleString('en-US') : '****'}
          </span>
        </div>
      ))}
    </>
  );
}

// ─── CategoryManager (unchanged) ──────────────────────────────────────────────

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
    setExpenseItems(prev => prev.map(item =>
      item.customCategory === cat ? { ...item, customCategory: undefined } : item
    ));
  };

  const handleRename = (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== oldName && customCategories.includes(trimmed))) return;
    setCustomCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    setExpenseItems(prev => prev.map(item =>
      item.customCategory === oldName ? { ...item, customCategory: trimmed } : item
    ));
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

// ─── CategoryAnalysisTab (unchanged) ─────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const {
    incomeItems, setIncomeItems,
    expenseItems, setExpenseItems,
    annualEntries, setAnnualEntries,
    totalMonthlyIncome, totalMonthlyExpense,
    showValues,
    customCategories, setCustomCategories,
  } = useAppContext();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'flow' | 'category'>('flow');
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingOneTimeIncome, setIsAddingOneTimeIncome] = useState(false);
  const [isAddingOneTimeExpense, setIsAddingOneTimeExpense] = useState(false);

  const formatCurrency = (amount: number) => _fmt(amount, showValues);

  // Month navigation
  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  // This month's one-time entries
  const monthEntries = useMemo(() =>
    annualEntries.filter(e => e.year === selectedYear && e.month === selectedMonth),
    [annualEntries, selectedYear, selectedMonth]
  );
  const monthOneTimeIncome  = useMemo(() => monthEntries.filter(e => INCOME_ENTRY_KEYS.has(e.category)), [monthEntries]);
  const monthOneTimeExpense = useMemo(() => monthEntries.filter(e => !INCOME_ENTRY_KEYS.has(e.category)), [monthEntries]);
  const monthOneTimeIncomeTotal  = monthOneTimeIncome.reduce((s, e) => s + e.amount, 0);
  const monthOneTimeExpenseTotal = monthOneTimeExpense.reduce((s, e) => s + e.amount, 0);

  // KPI for selected month (fixed base + this month's one-time)
  const monthTotalIncome  = totalMonthlyIncome  + monthOneTimeIncomeTotal;
  const monthTotalExpense = totalMonthlyExpense + monthOneTimeExpenseTotal;
  const monthNet          = monthTotalIncome - monthTotalExpense;

  // Fixed item handlers
  const handleAddFixedIncome = (name: string, amount: number, customCategory?: string) => {
    setIncomeItems(prev => [...prev, { id: Date.now().toString(), name, amount, category: 'General', isRecurring: true, customCategory }]);
    setIsAddingIncome(false);
  };
  const handleAddFixedExpense = (name: string, amount: number, customCategory?: string) => {
    setExpenseItems(prev => [...prev, { id: Date.now().toString(), name, amount, category: 'General', isRecurring: true, customCategory }]);
    setIsAddingExpense(false);
  };
  const handleDeleteFixedItem = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') setIncomeItems(prev => prev.filter(i => i.id !== id));
    else setExpenseItems(prev => prev.filter(i => i.id !== id));
  };
  const handleUpdateFixedItem = (type: 'income' | 'expense', id: string, name: string, amount: number, customCategory?: string) => {
    const fn = (prev: CashFlowItem[]) => prev.map(i => i.id === id ? { ...i, name, amount, customCategory } : i);
    if (type === 'income') setIncomeItems(fn);
    else setExpenseItems(fn);
  };

  // One-time entry handlers
  const handleAddOneTimeEntry = (category: AnnualEntryCategory, name: string, amount: number) => {
    if (!name || !amount) return;
    setAnnualEntries(prev => [...prev, { id: Date.now().toString(), year: selectedYear, month: selectedMonth, name, amount, category }]);
    if (INCOME_ENTRY_KEYS.has(category)) setIsAddingOneTimeIncome(false);
    else setIsAddingOneTimeExpense(false);
  };
  const handleDeleteOneTimeEntry = (id: string) => {
    setAnnualEntries(prev => prev.filter(e => e.id !== id));
  };

  // 12-month trend (based on fixed monthly totals + annualEntries per month)
  const monthTrend = useMemo(() => {
    const base = new Date(selectedYear, selectedMonth - 1, 1);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      let inc = totalMonthlyIncome;
      let exp = totalMonthlyExpense;
      for (const entry of annualEntries) {
        if (entry.year === y && entry.month === m) {
          if (INCOME_ENTRY_KEYS.has(entry.category)) inc += entry.amount;
          else exp += entry.amount;
        }
      }
      return { label: `${m}月`, income: Math.round(inc), expense: Math.round(exp), net: Math.round(inc - exp) };
    });
  }, [totalMonthlyIncome, totalMonthlyExpense, annualEntries, selectedYear, selectedMonth]);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收支管理</h1>
          <p className="text-sm text-gray-500 mt-1">記錄固定收支與本月一次性項目</p>
        </div>
        <MonthNavigator year={selectedYear} month={selectedMonth} onPrev={prevMonth} onNext={nextMonth} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(['flow', 'category'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'flow' ? '本月收支' : '類別分析'}
          </button>
        ))}
      </div>

      {activeTab === 'flow' && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <ArrowUpCircle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">本月總收入</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(monthTotalIncome)}</h2>
              {monthOneTimeIncomeTotal > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">含本月一次性收入 {formatCurrency(monthOneTimeIncomeTotal)}</p>
              )}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <ArrowDownCircle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">本月總支出</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(monthTotalExpense)}</h2>
              {monthOneTimeExpenseTotal > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">含本月一次性支出 {formatCurrency(monthOneTimeExpenseTotal)}</p>
              )}
            </div>
            <div className={`rounded-2xl p-6 shadow-lg text-white ${monthNet >= 0 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-rose-500 to-rose-700'}`}>
              <div className="flex items-center gap-2 mb-2 opacity-80">
                <Wallet className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">本月預計盈餘</span>
              </div>
              <h2 className="text-3xl font-bold">{formatCurrency(monthNet)}</h2>
              <p className="text-xs mt-2 opacity-70">
                儲蓄率: {monthTotalIncome > 0 ? ((monthNet / monthTotalIncome) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>

          {/* ── Section 1: Fixed monthly items ── */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-gray-900">每月固定收支</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">每月自動套用</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Fixed Income */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">固定收入</h3>
                <button onClick={() => setIsAddingIncome(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 新增
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-50">
                  {isAddingIncome && (
                    <AddFixedItemRow
                      type="income"
                      customCategories={customCategories}
                      onConfirm={handleAddFixedIncome}
                      onCancel={() => setIsAddingIncome(false)}
                    />
                  )}
                  {incomeItems.map(item => (
                    <CashFlowRow
                      key={item.id}
                      item={item}
                      type="income"
                      customCategories={customCategories}
                      onUpdate={(n, a, c) => handleUpdateFixedItem('income', item.id, n, a, c)}
                      onDelete={() => handleDeleteFixedItem('income', item.id)}
                      showValues={showValues}
                    />
                  ))}
                  <AutoStakingIncomeRow />
                  {incomeItems.length === 0 && !isAddingIncome && (
                    <div className="p-8 text-center text-gray-400 text-sm">尚無固定收入項目</div>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed Expense */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">固定支出</h3>
                <button onClick={() => setIsAddingExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 新增
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-50">
                  {isAddingExpense && (
                    <AddFixedItemRow
                      type="expense"
                      customCategories={customCategories}
                      onConfirm={handleAddFixedExpense}
                      onCancel={() => setIsAddingExpense(false)}
                    />
                  )}
                  {expenseItems.map(item => (
                    <CashFlowRow
                      key={item.id}
                      item={item}
                      type="expense"
                      customCategories={customCategories}
                      onUpdate={(n, a, c) => handleUpdateFixedItem('expense', item.id, n, a, c)}
                      onDelete={() => handleDeleteFixedItem('expense', item.id)}
                      showValues={showValues}
                    />
                  ))}
                  <AutoStakingExpenseRow />
                  <AutoLoanExpenseRow />
                  {expenseItems.length === 0 && !isAddingExpense && (
                    <div className="p-8 text-center text-gray-400 text-sm">尚無固定支出項目</div>
                  )}
                </div>
                <div className="border-t-2 border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
                  <span className="text-sm font-bold text-gray-600">固定支出合計</span>
                  <span className="text-base font-bold text-rose-600">{formatCurrency(totalMonthlyExpense)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: This month's one-time entries ── */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-gray-900">{selectedYear} 年 {selectedMonth} 月 — 一次性記錄</h2>
              <span className="text-xs text-gray-400 bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">本月限定</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* One-time Income */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">本月一次性收入</h3>
                <button onClick={() => setIsAddingOneTimeIncome(true)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 新增
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-50">
                  {isAddingOneTimeIncome && (
                    <AddOneTimeEntryRow
                      type="income"
                      onConfirm={(name, amount, category) => handleAddOneTimeEntry(category, name, amount)}
                      onCancel={() => setIsAddingOneTimeIncome(false)}
                    />
                  )}
                  {monthOneTimeIncome.map(entry => (
                    <OneTimeEntryRow
                      key={entry.id}
                      entry={entry}
                      onDelete={() => handleDeleteOneTimeEntry(entry.id)}
                      showValues={showValues}
                    />
                  ))}
                  {monthOneTimeIncome.length === 0 && !isAddingOneTimeIncome && (
                    <div className="p-8 text-center text-gray-400 text-sm">本月尚無一次性收入</div>
                  )}
                </div>
                {monthOneTimeIncomeTotal > 0 && (
                  <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-emerald-50/40">
                    <span className="text-xs font-bold text-gray-500">本月小計</span>
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(monthOneTimeIncomeTotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* One-time Expense */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">本月一次性支出</h3>
                <button onClick={() => setIsAddingOneTimeExpense(true)} className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 新增
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-50">
                  {isAddingOneTimeExpense && (
                    <AddOneTimeEntryRow
                      type="expense"
                      onConfirm={(name, amount, category) => handleAddOneTimeEntry(category, name, amount)}
                      onCancel={() => setIsAddingOneTimeExpense(false)}
                    />
                  )}
                  {monthOneTimeExpense.map(entry => (
                    <OneTimeEntryRow
                      key={entry.id}
                      entry={entry}
                      onDelete={() => handleDeleteOneTimeEntry(entry.id)}
                      showValues={showValues}
                    />
                  ))}
                  {monthOneTimeExpense.length === 0 && !isAddingOneTimeExpense && (
                    <div className="p-8 text-center text-gray-400 text-sm">本月尚無一次性支出</div>
                  )}
                </div>
                {monthOneTimeExpenseTotal > 0 && (
                  <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-rose-50/40">
                    <span className="text-xs font-bold text-gray-500">本月小計</span>
                    <span className="text-sm font-bold text-rose-700">{formatCurrency(monthOneTimeExpenseTotal)}</span>
                  </div>
                )}
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
              <BarChart
                data={monthTrend}
                margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                barCategoryGap="30%"
              >
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/user/Desktop/FinancialManagement && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 3: Run dev server and manually verify the UI**

```bash
npm run dev
```

Open http://localhost:3000/cashflow and verify:
1. Month navigator appears top-right, shows "YYYY 年 MM 月" with "本月" badge for current month
2. Tab label reads "本月收支" (not "收支管理")
3. KPI cards show "本月總收入 / 本月總支出 / 本月預計盈餘"
4. Section 1 header says "每月固定收支" with "每月自動套用" badge
5. Fixed income/expense items list without any "固定/單次" toggle badges
6. Adding a fixed income/expense item shows no recurring toggle — just name, amount, (category for expense), confirm/cancel
7. Section 2 header shows "YYYY 年 MM 月 — 一次性記錄" with amber badge
8. Adding a one-time income shows category dropdown: 其他收入/業績獎金/股利收入
9. Adding a one-time expense shows category dropdown: 其他支出/旅遊/醫療健康/設備購置
10. When one-time entries exist, KPI cards show the breakdown hint text
11. Navigate to a different month — one-time entries change, fixed items stay the same
12. "類別分析" tab still works
13. AnnualTracker still renders below the trend chart

- [ ] **Step 4: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat: rewrite cashflow page as month-aware view (Option C)

- Month navigator top-right: navigate by month, shows 本月 badge for current
- Two clear sections: 每月固定收支 and 本月一次性記錄
- Fixed items (incomeItems/expenseItems) shown without recurring toggle
- One-time entries stored in annualEntries by year+month, shown inline
- KPI row computes month-specific totals (fixed + this month's one-time)
- Category dropdown for one-time entries (income: 其他收入/獎金/股利; expense: 其他支出/旅遊/醫療/設備)
- isRecurring toggle removed from UI entirely; type kept for backward compat
- AnnualTracker and category analysis tab preserved"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Month selector at top — `MonthNavigator` component, top-right in header
- ✅ Fixed recurring items section — Section 1 "每月固定收支", uses `incomeItems`/`expenseItems`
- ✅ This month's one-time entries section — Section 2 "本月一次性記錄", uses `annualEntries` filtered by year+month
- ✅ One-time entries stored in `annualEntries` — `handleAddOneTimeEntry` writes to `setAnnualEntries`
- ✅ Income one-time → `other_income`/`bonus`/`dividend` categories — `INCOME_ENTRY_CATS`
- ✅ Expense one-time → `one_time_expense`/`travel`/`medical`/`equipment` — `EXPENSE_ENTRY_CATS`
- ✅ KPI includes one-time entries — `monthTotalIncome = totalMonthlyIncome + monthOneTimeIncomeTotal`
- ✅ No isRecurring toggle in UI — `AddFixedItemRow` has no toggle, `CashFlowRow` has no badge
- ✅ Category analysis tab preserved — `CategoryAnalysisTab` component kept intact
- ✅ AnnualTracker preserved — still rendered in flow tab
- ✅ 12-month trend chart — `monthTrend` useMemo, `BarChart`
- ✅ annual/page.tsx filter fixed — Task 1

**Placeholder scan:** No TBD, TODO, or incomplete sections found.

**Type consistency check:**
- `AnnualEntryCategory` — imported from AppContext, used correctly in `INCOME_ENTRY_CATS`, `EXPENSE_ENTRY_CATS`, `handleAddOneTimeEntry`
- `CashFlowItem` — imported, used in `CashFlowRow`, `AddFixedItemRow`, handlers
- `INCOME_ENTRY_KEYS` (Set) — used in `monthOneTimeIncome`/`monthOneTimeExpense` filter and `monthTrend` 
- `handleUpdateFixedItem` signature: `(type, id, name, amount, customCategory?)` → `CashFlowRow.onUpdate: (name, amount, customCategory?)` ✅ (type is captured in closure)
- `AddOneTimeEntryRow.onConfirm`: `(name, amount, category)` → matches call site `(name, amount, category) => handleAddOneTimeEntry(category, name, amount)` ✅

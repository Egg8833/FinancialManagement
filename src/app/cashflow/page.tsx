"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Wallet, Plus, Trash2,
  ArrowUpCircle, ArrowDownCircle,
  Search, Settings2, X,
} from 'lucide-react';
import {
  useAppContext,
  type CashFlowItem, type AnnualEntry, type AnnualEntryCategory,
} from '../../context/AppContext';
import { formatCurrency as _fmt, monthKey } from '../../lib/utils';
import { AnnualTracker } from '../../components/AnnualTracker';
import { useToast } from '../../context/ToastContext';
import { MonthNavigator } from '../../components/cashflow/MonthNavigator';
import { MonthlySummaryCard } from '../../components/cashflow/MonthlySummaryCard';
import { CashFlowRow } from '../../components/cashflow/CashFlowRow';
import { AddFixedItemRow } from '../../components/cashflow/AddFixedItemRow';
import { OneTimeEntryRow } from '../../components/cashflow/OneTimeEntryRow';
import { AddOneTimeEntryRow } from '../../components/cashflow/AddOneTimeEntryRow';
import { AutoStakingIncomeRow, AutoStakingExpenseRow, AutoLoanExpenseRows } from '../../components/cashflow/AutoItemRows';
import { CategoryAnalysisTab } from '../../components/cashflow/CategoryAnalysisTab';
import { MonthTrendChart } from '../../components/cashflow/MonthTrendChart';

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const {
    monthlyRecords, setMonthlyRecords,
    cashflowTemplate,
    annualEntries, setAnnualEntries,
    showValues,
    customCategories, setCustomCategories,
    stakingItems,
    loans,
  } = useAppContext();

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const selectedYear  = viewDate.year;
  const selectedMonth = viewDate.month;
  const viewKey = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}`;
  const viewRecord = monthlyRecords[viewKey] ?? {
    income: cashflowTemplate.income,
    expense: cashflowTemplate.expense,
  };
  const incomeItems  = viewRecord.income;
  const expenseItems = viewRecord.expense;

  const setViewIncome = (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => {
    setMonthlyRecords(prev => ({
      ...prev,
      [viewKey]: { income: fn(viewRecord.income), expense: viewRecord.expense },
    }));
  };
  const setViewExpense = (fn: (prev: CashFlowItem[]) => CashFlowItem[]) => {
    setMonthlyRecords(prev => ({
      ...prev,
      [viewKey]: { income: viewRecord.income, expense: fn(viewRecord.expense) },
    }));
  };
  const [activeTab, setActiveTab] = useState<'flow' | 'category' | 'annual'>('flow');
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingOneTimeIncome, setIsAddingOneTimeIncome] = useState(false);
  const [isAddingOneTimeExpense, setIsAddingOneTimeExpense] = useState(false);

  // Filter state for the flow tab
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  const formatCurrency = (amount: number) => _fmt(amount, showValues);
  const { toast } = useToast();

  const stakingEarnIncome = useMemo(() =>
    stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn')
      .reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0),
    [stakingItems]
  );
  const stakingBorrowCost = useMemo(() =>
    stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow')
      .reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0),
    [stakingItems]
  );
  const totalLoanPayments = useMemo(() =>
    loans.filter(l => l.principal > 0).reduce((s, l) => s + l.monthlyPayment, 0),
    [loans]
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(filterKeyword), 200);
    return () => clearTimeout(t);
  }, [filterKeyword]);

  // Auto-seed: when navigating to a month with no data, copy from most recent previous month
  useEffect(() => {
    if (monthlyRecords[viewKey]) return;

    let source: { income: CashFlowItem[]; expense: CashFlowItem[] } | null = null;
    for (let i = 1; i <= 24; i++) {
      const d = new Date(viewDate.year, viewDate.month - 1 - i, 1);
      const k = monthKey(d);
      if (monthlyRecords[k]) { source = monthlyRecords[k]; break; }
    }
    if (!source) source = { income: cashflowTemplate.income, expense: cashflowTemplate.expense };
    if (source.income.length === 0 && source.expense.length === 0) return;

    setMonthlyRecords(prev => ({
      ...prev,
      [viewKey]: {
        income:  source!.income.map( item => ({ ...item, id: `${viewKey}-inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })),
        expense: source!.expense.map(item => ({ ...item, id: `${viewKey}-exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })),
      },
    }));
    toast('已從上月複製收支項目，可直接編輯本月實際金額');
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Month navigation — compound state avoids stale-closure bugs at year boundaries
  const prevMonth = () => setViewDate(({ year, month }) =>
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  );
  const nextMonth = () => setViewDate(({ year, month }) =>
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  );

  // This month's one-time entries
  const monthEntries = useMemo(() =>
    annualEntries.filter(e => e.year === selectedYear && e.month === selectedMonth),
    [annualEntries, selectedYear, selectedMonth]
  );
  const monthOneTimeIncome  = useMemo(() => monthEntries.filter(e => INCOME_ENTRY_KEYS.has(e.category)), [monthEntries]);
  const monthOneTimeExpense = useMemo(() => monthEntries.filter(e => !INCOME_ENTRY_KEYS.has(e.category)), [monthEntries]);
  const monthOneTimeIncomeTotal  = useMemo(() => monthOneTimeIncome.reduce((s, e) => s + e.amount, 0),  [monthOneTimeIncome]);
  const monthOneTimeExpenseTotal = useMemo(() => monthOneTimeExpense.reduce((s, e) => s + e.amount, 0), [monthOneTimeExpense]);

  // KPI for selected month
  const viewBaseIncome  = incomeItems.reduce((s, i) => s + i.amount, 0) + Math.round(stakingEarnIncome);
  const viewBaseExpense = expenseItems.reduce((s, i) => s + i.amount, 0) + Math.round(stakingBorrowCost) + totalLoanPayments;
  const monthTotalIncome  = viewBaseIncome  + monthOneTimeIncomeTotal;
  const monthTotalExpense = viewBaseExpense + monthOneTimeExpenseTotal;
  const monthNet          = monthTotalIncome - monthTotalExpense;

  // Fixed item handlers
  const handleAddFixedIncome = (name: string, amount: number, customCategory?: string) => {
    setViewIncome(prev => [...prev, { id: `${viewKey}-inc-${Date.now()}`, name, amount, category: 'General', isRecurring: true, customCategory }]);
    setIsAddingIncome(false);
  };
  const handleAddFixedExpense = (name: string, amount: number, customCategory?: string) => {
    setViewExpense(prev => [...prev, { id: `${viewKey}-exp-${Date.now()}`, name, amount, category: 'General', isRecurring: true, customCategory }]);
    setIsAddingExpense(false);
  };
  const handleDeleteFixedItem = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') setViewIncome(prev => prev.filter(i => i.id !== id));
    else setViewExpense(prev => prev.filter(i => i.id !== id));
  };
  const handleUpdateFixedItem = (type: 'income' | 'expense', id: string, name: string, amount: number, customCategory?: string) => {
    const fn = (prev: CashFlowItem[]) => prev.map(i => i.id === id ? { ...i, name, amount, customCategory } : i);
    if (type === 'income') setViewIncome(fn);
    else setViewExpense(fn);
  };

  // One-time entry handlers
  const handleAddOneTimeEntry = (category: AnnualEntryCategory, name: string, amount: number) => {
    if (!name.trim() || !amount) {
      toast('請輸入名稱與金額', 'error');
      return;
    }
    setAnnualEntries(prev => [...prev, { id: Date.now().toString(), year: selectedYear, month: selectedMonth, name: name.trim(), amount, category }]);
    if (INCOME_ENTRY_KEYS.has(category)) setIsAddingOneTimeIncome(false);
    else setIsAddingOneTimeExpense(false);
  };
  const handleDeleteOneTimeEntry = (id: string) => {
    setAnnualEntries(prev => prev.filter(e => e.id !== id));
  };

  // 12-month trend
  const monthTrend = useMemo(() => {
    const base = new Date(selectedYear, selectedMonth - 1, 1);
    return Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1);
      const y   = d.getFullYear();
      const m   = d.getMonth() + 1;
      const key = monthKey(d);
      const rec = monthlyRecords[key] ?? { income: cashflowTemplate.income, expense: cashflowTemplate.expense };
      let inc = rec.income.reduce( (s, it) => s + it.amount, 0) + Math.round(stakingEarnIncome);
      let exp = rec.expense.reduce((s, it) => s + it.amount, 0) + Math.round(stakingBorrowCost) + totalLoanPayments;
      for (const entry of annualEntries) {
        if (entry.year === y && entry.month === m) {
          if (INCOME_ENTRY_KEYS.has(entry.category)) inc += entry.amount;
          else exp += entry.amount;
        }
      }
      return { label: `${m}月`, income: Math.round(inc), expense: Math.round(exp), net: Math.round(inc - exp) };
    });
  }, [monthlyRecords, cashflowTemplate, annualEntries, selectedYear, selectedMonth,
      stakingEarnIncome, stakingBorrowCost, totalLoanPayments]);

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

      {/* Monthly Summary Card */}
      <MonthlySummaryCard
        totalIncome={monthTotalIncome}
        totalExpense={monthTotalExpense}
        netAmount={monthNet}
        showValues={showValues}
      />

      {/* Tab bar + Category Manager button */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {(['flow', 'category', 'annual'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'flow' ? '本月收支' : tab === 'category' ? '類別分析' : '年度總覽'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setActiveTab('category')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors bg-white"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">管理類別</span>
        </button>
      </div>

      {activeTab === 'flow' && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl text-sm">
              {(['all', 'income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'all' ? '全部' : t === 'income' ? '收入' : '支出'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="搜尋項目名稱..."
                value={filterKeyword}
                onChange={e => setFilterKeyword(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
              />
              {filterKeyword && (
                <button onClick={() => setFilterKeyword('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

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

          {/* Section 1: Fixed monthly items */}
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-gray-900">本月收支項目</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">本月獨立記錄</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Fixed Income */}
            {filterType !== 'expense' && (
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
                        {incomeItems
                          .filter(item => !debouncedKeyword || item.name.toLowerCase().includes(debouncedKeyword.toLowerCase()))
                          .map(item => (
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
                )}

                {/* Fixed Expense */}
                {filterType !== 'income' && (
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
                        {expenseItems
                          .filter(item => !debouncedKeyword || item.name.toLowerCase().includes(debouncedKeyword.toLowerCase()))
                          .map(item => (
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
                        <AutoLoanExpenseRows />
                        {expenseItems.length === 0 && !isAddingExpense && (
                          <div className="p-8 text-center text-gray-400 text-sm">尚無固定支出項目</div>
                        )}
                      </div>
                      <div className="border-t-2 border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
                        <span className="text-sm font-bold text-gray-600">固定支出合計</span>
                        <span className="text-base font-bold text-rose-600">{formatCurrency(viewBaseExpense)}</span>
                      </div>
                    </div>
                  </div>
                )}
          </div>

          {/* Section 2: This month's one-time entries */}
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-gray-900">{selectedYear} 年 {selectedMonth} 月 — 一次性記錄</h2>
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">本月限定</span>
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
          <MonthTrendChart
            data={monthTrend}
            showValues={showValues}
            formatCurrency={formatCurrency}
          />

        </>
      )}

      {activeTab === 'annual' && (
        <AnnualTracker />
      )}

      {activeTab === 'category' && (
        <CategoryAnalysisTab
          expenseItems={expenseItems}
          customCategories={customCategories}
          setCustomCategories={setCustomCategories}
          setExpenseItems={(fn) => setViewExpense(fn)}
          showValues={showValues}
        />
      )}
    </>
  );
}

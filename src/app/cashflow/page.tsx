"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  useAppContext,
  type CashFlowItem, type AnnualEntryCategory,
} from '../../context/AppContext';
import { formatCurrency as _fmt, monthKey } from '../../lib/utils';
import { AnnualTracker } from '../../components/AnnualTracker';
import { useToast } from '../../context/ToastContext';
import { CategoryAnalysisTab } from '../../components/cashflow/CategoryAnalysisTab';
import { MonthTrendChart } from '../../components/cashflow/MonthTrendChart';
import { CashflowPageHeader } from '../../components/cashflow/CashflowPageHeader';
import { CashflowFilterBar } from '../../components/cashflow/CashflowFilterBar';
import { CashflowKPICards } from '../../components/cashflow/CashflowKPICards';
import { FixedItemsSection } from '../../components/cashflow/FixedItemsSection';
import { OneTimeEntriesSection } from '../../components/cashflow/OneTimeEntriesSection';

// ─── Constants ────────────────────────────────────────────────────────────────

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
      <CashflowPageHeader
        year={selectedYear} month={selectedMonth}
        onPrev={prevMonth} onNext={nextMonth}
        totalIncome={monthTotalIncome} totalExpense={monthTotalExpense}
        netAmount={monthNet} showValues={showValues}
        activeTab={activeTab} onTabChange={setActiveTab}
      />

      {activeTab === 'flow' && (
        <>
          <CashflowFilterBar
            filterType={filterType} onFilterType={setFilterType}
            filterKeyword={filterKeyword} onFilterKeyword={setFilterKeyword}
          />
          <CashflowKPICards
            totalIncome={monthTotalIncome} totalExpense={monthTotalExpense}
            netAmount={monthNet}
            oneTimeIncomeTotal={monthOneTimeIncomeTotal}
            oneTimeExpenseTotal={monthOneTimeExpenseTotal}
            formatCurrency={formatCurrency}
          />

          <FixedItemsSection
            filterType={filterType}
            incomeItems={incomeItems} expenseItems={expenseItems}
            isAddingIncome={isAddingIncome} setIsAddingIncome={setIsAddingIncome}
            isAddingExpense={isAddingExpense} setIsAddingExpense={setIsAddingExpense}
            debouncedKeyword={debouncedKeyword}
            customCategories={customCategories} showValues={showValues}
            viewBaseExpense={viewBaseExpense} formatCurrency={formatCurrency}
            onAddIncome={handleAddFixedIncome} onAddExpense={handleAddFixedExpense}
            onUpdate={handleUpdateFixedItem} onDelete={handleDeleteFixedItem}
          />

          <OneTimeEntriesSection
            selectedYear={selectedYear} selectedMonth={selectedMonth}
            monthOneTimeIncome={monthOneTimeIncome} monthOneTimeExpense={monthOneTimeExpense}
            monthOneTimeIncomeTotal={monthOneTimeIncomeTotal} monthOneTimeExpenseTotal={monthOneTimeExpenseTotal}
            isAddingOneTimeIncome={isAddingOneTimeIncome} setIsAddingOneTimeIncome={setIsAddingOneTimeIncome}
            isAddingOneTimeExpense={isAddingOneTimeExpense} setIsAddingOneTimeExpense={setIsAddingOneTimeExpense}
            showValues={showValues} formatCurrency={formatCurrency}
            onAddEntry={handleAddOneTimeEntry} onDeleteEntry={handleDeleteOneTimeEntry}
          />

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

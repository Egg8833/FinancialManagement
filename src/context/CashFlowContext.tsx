"use client";

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useSyncedState } from '../hooks/useSyncedState';
import { monthKey } from '../lib/utils';
import type { MonthRecord, CashflowTemplate, AnnualEntry, CashFlowItem } from '../types';

const DEFAULT_CATEGORIES = ['餐飲', '交通', '房租', '娛樂', '醫療', '購物', '其他'];
const DEFAULT_INCOME: CashFlowItem[] = [
  { id: 'in1', name: '薪資收入', amount: 80000, category: 'Salary', isRecurring: true },
];
const DEFAULT_EXPENSE: CashFlowItem[] = [
  { id: 'ex1', name: '房租', amount: 20000, category: 'Housing', isRecurring: true },
  { id: 'ex2', name: '伙食費', amount: 15000, category: 'Food', isRecurring: true },
];

interface CashFlowContextType {
  monthlyRecords: Record<string, MonthRecord>;
  setMonthlyRecords: (v: Record<string, MonthRecord> | ((p: Record<string, MonthRecord>) => Record<string, MonthRecord>)) => void;
  cashflowTemplate: CashflowTemplate;
  setCashflowTemplate: (v: CashflowTemplate | ((p: CashflowTemplate) => CashflowTemplate)) => void;
  annualEntries: AnnualEntry[];
  setAnnualEntries: (v: AnnualEntry[] | ((p: AnnualEntry[]) => AnnualEntry[])) => void;
  categoryBudgets: Record<string, number>;
  setCategoryBudgets: (v: Record<string, number> | ((p: Record<string, number>) => Record<string, number>)) => void;
  customCategories: string[];
  setCustomCategories: (v: string[] | ((p: string[]) => string[])) => void;
  currentMonthKey: string;
  clearCashFlowData: () => void;
}

const CashFlowContext = createContext<CashFlowContextType | undefined>(undefined);

export function useCashFlowContext() {
  const ctx = useContext(CashFlowContext);
  if (!ctx) throw new Error('useCashFlowContext must be used within a CashFlowProvider');
  return ctx;
}

export function CashFlowProvider({ children }: { children: ReactNode }) {
  const [monthlyRecords, setMonthlyRecords] = useSyncedState<Record<string, MonthRecord>>(
    'monthlyRecords', {}, 'app-monthly-records-v1'
  );
  const [cashflowTemplate, setCashflowTemplate] = useSyncedState<CashflowTemplate>(
    'cashflowTemplate', { income: DEFAULT_INCOME, expense: DEFAULT_EXPENSE },
    'app-cashflow-template-v1'
  );
  const [annualEntries, setAnnualEntries] = useSyncedState<AnnualEntry[]>('annualEntries', [], 'app-annual-v1');
  const [categoryBudgets, setCategoryBudgets] = useSyncedState<Record<string, number>>(
    'categoryBudgets', {}, 'assetdash-category-budgets'
  );
  const [customCategories, setCustomCategories] = useSyncedState<string[]>(
    'customCategories', DEFAULT_CATEGORIES, 'app-custom-categories-v1'
  );

  // 固定為當月 key，加上 useMemo 避免每次 render 重算
  const currentMonthKey = useMemo(() => monthKey(new Date()), []);

  // 一次性 migration：incomeItems/expenseItems → cashflowTemplate
  useEffect(() => {
    if (localStorage.getItem('app-cashflow-migrated-v1')) return;
    const rawIncome  = localStorage.getItem('app-income-v1');
    const rawExpense = localStorage.getItem('app-expense-v1');
    if (rawIncome || rawExpense) {
      try {
        const income  = rawIncome  ? JSON.parse(rawIncome)  : DEFAULT_INCOME;
        const expense = rawExpense ? JSON.parse(rawExpense) : DEFAULT_EXPENSE;
        setCashflowTemplate({ income, expense });
      } catch { /* fallback to default */ }
    }
    localStorage.setItem('app-cashflow-migrated-v1', '1');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearCashFlowData = () => {
    setMonthlyRecords({});
    setCashflowTemplate({ income: [], expense: [] });
    setAnnualEntries([]);
    setCustomCategories(DEFAULT_CATEGORIES);
  };

  return (
    <CashFlowContext.Provider value={{
      monthlyRecords, setMonthlyRecords,
      cashflowTemplate, setCashflowTemplate,
      annualEntries, setAnnualEntries,
      categoryBudgets, setCategoryBudgets,
      customCategories, setCustomCategories,
      currentMonthKey,
      clearCashFlowData,
    }}>
      {children}
    </CashFlowContext.Provider>
  );
}

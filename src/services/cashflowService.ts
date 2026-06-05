import type { MonthRecord, CashflowTemplate, AnnualEntry, CashFlowItem } from '../types';

const KEYS = {
  monthlyRecords: 'app-monthly-records-v1',
  cashflowTemplate: 'app-cashflow-template-v1',
  annualEntries: 'app-annual-v1',
  categoryBudgets: 'assetdash-category-budgets',
  customCategories: 'app-custom-categories-v1',
} as const;

const DEFAULT_CATEGORIES = ['餐飲', '交通', '房租', '娛樂', '醫療', '購物', '其他'];

const DEFAULT_INCOME: CashFlowItem[] = [
  { id: 'in1', name: '薪資收入', amount: 80000, category: 'Salary', isRecurring: true },
];
const DEFAULT_EXPENSE: CashFlowItem[] = [
  { id: 'ex1', name: '房租', amount: 20000, category: 'Housing', isRecurring: true },
  { id: 'ex2', name: '伙食費', amount: 15000, category: 'Food', isRecurring: true },
];

export function getMonthlyRecords(): Record<string, MonthRecord> {
  const stored = localStorage.getItem(KEYS.monthlyRecords);
  return stored ? JSON.parse(stored) : {};
}
export function saveMonthlyRecords(data: Record<string, MonthRecord>): void {
  localStorage.setItem(KEYS.monthlyRecords, JSON.stringify(data));
}

export function getCashflowTemplate(): CashflowTemplate {
  const stored = localStorage.getItem(KEYS.cashflowTemplate);
  return stored ? JSON.parse(stored) : { income: DEFAULT_INCOME, expense: DEFAULT_EXPENSE };
}
export function saveCashflowTemplate(data: CashflowTemplate): void {
  localStorage.setItem(KEYS.cashflowTemplate, JSON.stringify(data));
}

export function getAnnualEntries(): AnnualEntry[] {
  const stored = localStorage.getItem(KEYS.annualEntries);
  return stored ? JSON.parse(stored) : [];
}
export function saveAnnualEntries(data: AnnualEntry[]): void {
  localStorage.setItem(KEYS.annualEntries, JSON.stringify(data));
}

export function getCategoryBudgets(): Record<string, number> {
  const stored = localStorage.getItem(KEYS.categoryBudgets);
  return stored ? JSON.parse(stored) : {};
}
export function saveCategoryBudgets(data: Record<string, number>): void {
  localStorage.setItem(KEYS.categoryBudgets, JSON.stringify(data));
}

export function getCustomCategories(): string[] {
  const stored = localStorage.getItem(KEYS.customCategories);
  return stored ? JSON.parse(stored) : DEFAULT_CATEGORIES;
}
export function saveCustomCategories(data: string[]): void {
  localStorage.setItem(KEYS.customCategories, JSON.stringify(data));
}

# Monthly Cashflow Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace global `incomeItems`/`expenseItems` templates with per-month `monthlyRecords`, so each month's cashflow is an independent, editable actual record rather than a shared template.

**Architecture:** Add `monthlyRecords: Record<"YYYY-MM", MonthRecord>` to AppContext. Keep `cashflowTemplate` as the seed for new months (migrated from old `incomeItems`/`expenseItems`). Context-level `totalMonthlyIncome`/`totalMonthlyExpense` derive from current month's records. The cashflow page reads/writes `monthlyRecords[viewKey]` and auto-seeds empty months from the most recent previous month (or template). Old `incomeItems`/`expenseItems` state is removed.

**Tech Stack:** React Context, localStorage via `useStickyState`, TypeScript, Next.js 14

**Known limitation:** `AnnualTracker` (年度總覽 tab) uses context `totalMonthlyIncome`/`totalMonthlyExpense` for historical months — after this change it will always reflect *current* month's template for months with no records. Full AnnualTracker fix is out of scope here.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `monthKey(date: Date): string` helper |
| `src/context/AppContext.tsx` | Add `MonthRecord`/`CashflowTemplate` types; add `monthlyRecords`/`cashflowTemplate` state; migration useEffect; update `totalMonthlyIncome`/`totalMonthlyExpense`; remove `incomeItems`/`expenseItems`; update `clearAllData` and Provider value |
| `src/app/cashflow/page.tsx` | Derive `viewKey`; add auto-seed useEffect; replace all `incomeItems`/`expenseItems` CRUD with `monthlyRecords[viewKey]`; recompute view-month totals locally; update trend chart; update section label |
| `src/components/DataManager.tsx` | Export `monthlyRecords`/`cashflowTemplate`; import with backward-compat for old `incomeItems`/`expenseItems` keys |

---

### Task 1: Add `monthKey` helper to utils

**Files:**
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add helper at end of file**

```typescript
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(utils): add monthKey helper"
```

---

### Task 2: Add `MonthRecord` / `CashflowTemplate` types to AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: Add types after the `AnnualEntry` type block (after line 203)**

```typescript
export type MonthRecord = {
  income: CashFlowItem[];
  expense: CashFlowItem[];
};

export type CashflowTemplate = {
  income: CashFlowItem[];
  expense: CashFlowItem[];
};
```

- [ ] **Step 2: Add new state declarations in `AppProvider` body — insert after the `annualEntries` line (line 326)**

```typescript
const [monthlyRecords, setMonthlyRecords] = useStickyState<Record<string, MonthRecord>>(
  {}, 'app-monthly-records-v1'
);
const [cashflowTemplate, setCashflowTemplate] = useStickyState<CashflowTemplate>(
  { income: initialIncomeData, expense: initialExpenseData },
  'app-cashflow-template-v1'
);
```

- [ ] **Step 3: Add one-time migration `useEffect` — insert after the existing schema-version useEffect (after line 364)**

```typescript
// One-time migration: incomeItems/expenseItems → cashflowTemplate
useEffect(() => {
  if (localStorage.getItem('app-cashflow-migrated-v1')) return;
  const rawIncome  = localStorage.getItem('app-income-v1');
  const rawExpense = localStorage.getItem('app-expense-v1');
  if (rawIncome || rawExpense) {
    try {
      const income  = rawIncome  ? JSON.parse(rawIncome)  : initialIncomeData;
      const expense = rawExpense ? JSON.parse(rawExpense) : initialExpenseData;
      setCashflowTemplate({ income, expense });
    } catch { /* ignore parse errors, fall back to initialData */ }
  }
  localStorage.setItem('app-cashflow-migrated-v1', '1');
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Remove old state declarations (lines 324–325)**

Delete these two lines:
```typescript
const [incomeItems, setIncomeItems] = useStickyState<CashFlowItem[]>(initialIncomeData, 'app-income-v1');
const [expenseItems, setExpenseItems] = useStickyState<CashFlowItem[]>(initialExpenseData, 'app-expense-v1');
```

- [ ] **Step 5: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat(context): add MonthRecord type, monthlyRecords/cashflowTemplate state, migration"
```

---

### Task 3: Update `totalMonthlyIncome` / `totalMonthlyExpense` to use current month

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: Add `monthKey` import at top of file (add to existing import line)**

The file already imports from `'../lib/healthScore'`. Add:
```typescript
import { monthKey } from '../lib/utils';
```

- [ ] **Step 2: Replace `totalMonthlyIncome` useMemo (around line 501)**

Replace:
```typescript
const totalMonthlyIncome = useMemo(() => {
  const manual = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  return manual + Math.round(stakingEarnIncome);
}, [incomeItems, stakingEarnIncome]);
```

With:
```typescript
const currentMonthKey = monthKey(new Date());

const totalMonthlyIncome = useMemo(() => {
  const record = monthlyRecords[currentMonthKey];
  const items  = record?.income ?? cashflowTemplate.income;
  return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(stakingEarnIncome);
}, [monthlyRecords, currentMonthKey, cashflowTemplate.income, stakingEarnIncome]);
```

- [ ] **Step 3: Replace `totalMonthlyExpense` useMemo (around line 506)**

Replace:
```typescript
const totalMonthlyExpense = useMemo(() => {
  const manualExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  return manualExpense + Math.round(stakingBorrowInterest) + totalLoanMonthlyPayments;
}, [expenseItems, stakingBorrowInterest, totalLoanMonthlyPayments]);
```

With:
```typescript
const totalMonthlyExpense = useMemo(() => {
  const record = monthlyRecords[currentMonthKey];
  const items  = record?.expense ?? cashflowTemplate.expense;
  return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(stakingBorrowInterest) + totalLoanMonthlyPayments;
}, [monthlyRecords, currentMonthKey, cashflowTemplate.expense, stakingBorrowInterest, totalLoanMonthlyPayments]);
```

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat(context): totalMonthlyIncome/Expense now derive from current month records"
```

---

### Task 4: Update `AppContextType` interface and Provider value

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: Update `AppContextType` interface — remove old 4 lines, add new 4 lines**

REMOVE (around line 232–236):
```typescript
incomeItems: CashFlowItem[];
setIncomeItems: (items: CashFlowItem[] | ((prev: CashFlowItem[]) => CashFlowItem[])) => void;
expenseItems: CashFlowItem[];
setExpenseItems: (items: CashFlowItem[] | ((prev: CashFlowItem[]) => CashFlowItem[])) => void;
```

ADD in their place:
```typescript
monthlyRecords: Record<string, MonthRecord>;
setMonthlyRecords: (v: Record<string, MonthRecord> | ((prev: Record<string, MonthRecord>) => Record<string, MonthRecord>)) => void;
cashflowTemplate: CashflowTemplate;
setCashflowTemplate: (v: CashflowTemplate | ((prev: CashflowTemplate) => CashflowTemplate)) => void;
```

- [ ] **Step 2: Update `clearAllData` function (around line 558) — replace old setters**

REMOVE:
```typescript
setIncomeItems([]);
setExpenseItems([]);
```

ADD:
```typescript
setMonthlyRecords({});
setCashflowTemplate({ income: [], expense: [] });
```

- [ ] **Step 3: Update Provider `value` object (around line 610–620) — remove old, add new**

REMOVE:
```typescript
incomeItems,
setIncomeItems,
expenseItems,
setExpenseItems,
```

ADD:
```typescript
monthlyRecords,
setMonthlyRecords,
cashflowTemplate,
setCashflowTemplate,
```

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat(context): replace incomeItems/expenseItems API with monthlyRecords/cashflowTemplate"
```

---

### Task 5: Update DataManager export/import

**Files:**
- Modify: `src/components/DataManager.tsx`

- [ ] **Step 1: Update `handleExport` data object (around line 17)**

Replace:
```typescript
incomeItems: ctx.incomeItems,
expenseItems: ctx.expenseItems,
```

With:
```typescript
monthlyRecords: ctx.monthlyRecords,
cashflowTemplate: ctx.cashflowTemplate,
// Backward-compat keys so old restore scripts still work
incomeItems: ctx.cashflowTemplate.income,
expenseItems: ctx.cashflowTemplate.expense,
```

- [ ] **Step 2: Update `handleImport` (around line 55)**

Replace:
```typescript
if (data.incomeItems)      ctx.setIncomeItems(data.incomeItems);
if (data.expenseItems)     ctx.setExpenseItems(data.expenseItems);
```

With:
```typescript
if (data.monthlyRecords)    ctx.setMonthlyRecords(data.monthlyRecords);
if (data.cashflowTemplate)  ctx.setCashflowTemplate(data.cashflowTemplate);
// Backward compat: old backups stored global templates as incomeItems/expenseItems
if (!data.cashflowTemplate && data.incomeItems && data.expenseItems) {
  ctx.setCashflowTemplate({ income: data.incomeItems, expense: data.expenseItems });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DataManager.tsx
git commit -m "feat(data-manager): export/import monthly records schema with backward compat"
```

---

### Task 6: Rewrite cashflow page — context imports + viewKey + auto-seed

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: Update context destructuring at the top of `CashFlowPage` (around line 643)**

Replace:
```typescript
const {
  incomeItems, setIncomeItems,
  expenseItems, setExpenseItems,
  annualEntries, setAnnualEntries,
  totalMonthlyIncome, totalMonthlyExpense,
  showValues,
  customCategories, setCustomCategories,
} = useAppContext();
```

With:
```typescript
const {
  monthlyRecords, setMonthlyRecords,
  cashflowTemplate,
  annualEntries, setAnnualEntries,
  showValues,
  customCategories, setCustomCategories,
  stakingItems,
  loans,
} = useAppContext();
```

- [ ] **Step 2: Add `monthKey` import at top of file**

```typescript
import { monthKey } from '../../lib/utils';
```

- [ ] **Step 3: Add viewKey derivation + record access + helpers — insert after `const selectedMonth = viewDate.month;` (line 656)**

```typescript
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
```

- [ ] **Step 4: Add auto-seed useEffect — insert after the `debouncedKeyword` useEffect (after line 671)**

```typescript
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
      income:  source!.income.map( (item, idx) => ({ ...item, id: `${viewKey}-inc-${idx}` })),
      expense: source!.expense.map((item, idx) => ({ ...item, id: `${viewKey}-exp-${idx}` })),
    },
  }));
  toast('已從上月複製收支項目，可直接編輯本月實際金額');
}, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Add staking/loan local computations — insert after the `debouncedKeyword` state (around line 667)**

```typescript
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
```

- [ ] **Step 6: Replace the `monthTotalIncome`/`monthTotalExpense` computation (around line 695)**

Replace:
```typescript
const monthTotalIncome  = totalMonthlyIncome  + monthOneTimeIncomeTotal;
const monthTotalExpense = totalMonthlyExpense + monthOneTimeExpenseTotal;
const monthNet          = monthTotalIncome - monthTotalExpense;
```

With:
```typescript
const viewBaseIncome  = incomeItems.reduce((s, i) => s + i.amount, 0) + Math.round(stakingEarnIncome);
const viewBaseExpense = expenseItems.reduce((s, i) => s + i.amount, 0) + Math.round(stakingBorrowCost) + totalLoanPayments;
const monthTotalIncome  = viewBaseIncome  + monthOneTimeIncomeTotal;
const monthTotalExpense = viewBaseExpense + monthOneTimeExpenseTotal;
const monthNet          = monthTotalIncome - monthTotalExpense;
```

- [ ] **Step 7: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): viewKey derivation, auto-seed, local staking/loan totals"
```

---

### Task 7: Update cashflow CRUD handlers

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: Replace all four fixed-item CRUD handlers (around line 700–716)**

Replace the entire block:
```typescript
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
```

With:
```typescript
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
```

- [ ] **Step 2: Update section label (around line 900) — change "每月固定收支" to reflect per-month records**

Replace:
```tsx
<h2 className="text-base font-bold text-gray-900">每月固定收支</h2>
<span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">每月自動套用</span>
```

With:
```tsx
<h2 className="text-base font-bold text-gray-900">本月收支項目</h2>
<span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">本月獨立記錄</span>
```

- [ ] **Step 3: Update `CategoryAnalysisTab` call site — wire `setExpenseItems` to `setViewExpense` (around line 1119)**

Replace:
```tsx
<CategoryAnalysisTab
  expenseItems={expenseItems}
  customCategories={customCategories}
  setCustomCategories={setCustomCategories}
  setExpenseItems={setExpenseItems}
  showValues={showValues}
/>
```

With:
```tsx
<CategoryAnalysisTab
  expenseItems={expenseItems}
  customCategories={customCategories}
  setCustomCategories={setCustomCategories}
  setExpenseItems={(fn) => setViewExpense(fn)}
  showValues={showValues}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): CRUD handlers use setViewIncome/setViewExpense, update labels"
```

---

### Task 8: Update 12-month trend chart

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: Replace entire `monthTrend` useMemo (around line 733)**

Replace:
```typescript
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
```

With:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): trend chart reads per-month records for accurate history"
```

---

## Self-Review

### Spec coverage
| Requirement | Covered by |
|---|---|
| Per-month independent records | Task 2 (state) + Task 6 (viewKey) |
| Auto-seed from previous month | Task 6 step 4 |
| Migrate old incomeItems/expenseItems | Task 2 step 3 |
| Context totals use current month | Task 3 |
| clearAllData updated | Task 4 step 2 |
| DataManager export/import | Task 5 |
| CRUD handlers write to correct month | Task 7 step 1 |
| Trend chart reflects per-month history | Task 8 |

### Placeholder scan
None found. All code blocks contain complete implementations.

### Type consistency
- `MonthRecord` defined in Task 2, used in Tasks 3, 4, 6, 7, 8 — consistent.
- `CashflowTemplate` defined in Task 2, used in Tasks 3, 4, 5, 6, 8 — consistent.
- `setViewIncome` / `setViewExpense` defined in Task 6 step 3, used in Task 7 — consistent.
- `stakingEarnIncome`, `stakingBorrowCost`, `totalLoanPayments` defined in Task 6 step 5, used in Tasks 6 step 6 and Task 8 — consistent.
- `monthKey` added to utils in Task 1, imported in AppContext in Task 3 and cashflow page in Task 6 step 2 — consistent.

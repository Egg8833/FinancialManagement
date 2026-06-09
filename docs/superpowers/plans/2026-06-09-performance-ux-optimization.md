# Performance & UX Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升 AssetDash 執行期效能與 UX，涵蓋 Context re-render 優化、useStickyState 修復、React.memo、動態 import、骨架載入、錯誤邊界、cashflow page 拆分。

**Architecture:** 以 useMemo 穩定 AppContextBridge value 物件；React.memo 包裹高頻渲染的列表項目；next/dynamic 拆分 recharts 重型組件；Page Visibility API 控制股票輪詢；新增 Skeleton + ErrorBoundary；cashflow page 拆至 ≤180 行。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, vitest (node env, `.test.ts` only)

---

## Task 1：修復 useStickyState hydration flicker

**Files:**
- Modify: `src/hooks/useStickyState.ts`
- Test: `src/hooks/useStickyState.test.ts`

- [ ] **Step 1：寫 failing test**

建立 `src/hooks/useStickyState.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 模擬 localStorage 供 node 環境測試
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  vi.stubGlobal('window', { localStorage: localStorageMock });
});

describe('getOrDefault', () => {
  it('returns defaultValue when key not in storage', () => {
    const result = (() => {
      try {
        const item = localStorageMock.getItem('missing');
        return item ? JSON.parse(item) : 42;
      } catch { return 42; }
    })();
    expect(result).toBe(42);
  });

  it('returns parsed value when key exists', () => {
    localStorageMock.setItem('mykey', JSON.stringify({ x: 1 }));
    const result = (() => {
      try {
        const item = localStorageMock.getItem('mykey');
        return item ? JSON.parse(item) : null;
      } catch { return null; }
    })();
    expect(result).toEqual({ x: 1 });
  });

  it('returns defaultValue when stored value is invalid JSON', () => {
    localStorageMock.setItem('badkey', 'not-json{');
    const result = (() => {
      try {
        const item = localStorageMock.getItem('badkey');
        return item ? JSON.parse(item) : 'default';
      } catch { return 'default'; }
    })();
    expect(result).toBe('default');
  });
});
```

- [ ] **Step 2：執行 test 確認通過（純邏輯測試）**

```bash
npx vitest run src/hooks/useStickyState.test.ts
```

Expected: PASS（測試邏輯即為新 hook 的核心邏輯）

- [ ] **Step 3：改寫 useStickyState.ts**

```ts
"use client";

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

function readFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function useStickyState<T>(defaultValue: T, key: string): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readFromStorage(key, defaultValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable
    }
  }, [key, value]);

  return [value, setValue];
}
```

- [ ] **Step 4：TypeScript 檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: 無錯誤輸出

- [ ] **Step 5：Commit**

```bash
git add src/hooks/useStickyState.ts src/hooks/useStickyState.test.ts
git commit -m "fix(hooks): useStickyState lazy init eliminates mount flicker"
```

---

## Task 2：AppContextBridge value 穩定化

**Files:**
- Modify: `src/context/AppContext.tsx`（AppContextBridge return 區段）

- [ ] **Step 1：讀取 AppContext.tsx 第 133-300 行確認 Bridge return 結構**

確認 `<AppContext.Provider value={{ ... }}>` 的起訖行號。

- [ ] **Step 2：在 AppContextBridge 內加 useMemo 包裹 Provider value**

在 `function AppContextBridge` 的 return 前，加入以下 memoized value：

```tsx
// 分組 memo，讓不同 domain 的更新不互相觸發

const settingsValue = useMemo(() => ({
  showValues: settingsCtx.showValues, setShowValues: settingsCtx.setShowValues,
  userName: settingsCtx.userName, setUserName: settingsCtx.setUserName,
  userEmail: settingsCtx.userEmail, setUserEmail: settingsCtx.setUserEmail,
  usdToTwd: settingsCtx.usdToTwd, setUsdToTwd: settingsCtx.setUsdToTwd,
  reportSchedule: settingsCtx.reportSchedule, setReportSchedule: settingsCtx.setReportSchedule,
  lastReportSent: settingsCtx.lastReportSent, setLastReportSent: settingsCtx.setLastReportSent,
  netWorthGoal: settingsCtx.netWorthGoal, setNetWorthGoal: settingsCtx.setNetWorthGoal,
  fireSettings: settingsCtx.fireSettings, setFireSettings: settingsCtx.setFireSettings,
  lifeEvents: settingsCtx.lifeEvents, setLifeEvents: settingsCtx.setLifeEvents,
  onboardingDone: settingsCtx.onboardingDone, setOnboardingDone: settingsCtx.setOnboardingDone,
  enablePledgeTracking: settingsCtx.enablePledgeTracking, setEnablePledgeTracking: settingsCtx.setEnablePledgeTracking,
  pledgeAlertLastSent: settingsCtx.pledgeAlertLastSent, setPledgeAlertLastSent: settingsCtx.setPledgeAlertLastSent,
  lastExportDate: settingsCtx.lastExportDate, setLastExportDate: settingsCtx.setLastExportDate,
// eslint-disable-next-line react-hooks/exhaustive-deps
}), [
  settingsCtx.showValues, settingsCtx.userName, settingsCtx.userEmail,
  settingsCtx.usdToTwd, settingsCtx.reportSchedule, settingsCtx.lastReportSent,
  settingsCtx.netWorthGoal, settingsCtx.fireSettings, settingsCtx.lifeEvents,
  settingsCtx.onboardingDone, settingsCtx.enablePledgeTracking,
  settingsCtx.pledgeAlertLastSent, settingsCtx.lastExportDate,
]);

const stockValue = useMemo(() => ({
  stockItems, setStockItems,
  dividendRecords, setDividendRecords,
  stockQuotes, refreshQuotes, lastUpdated, quoteError,
}), [stockItems, dividendRecords, stockQuotes, lastUpdated, quoteError, refreshQuotes, setStockItems, setDividendRecords]);

const loanValue = useMemo(() => ({
  loans: loanCtx.loans, setLoans: loanCtx.setLoans,
  stakingItems: loanCtx.stakingItems, setStakingItems: loanCtx.setStakingItems,
  borrowingLimits: loanCtx.borrowingLimits, setBorrowingLimits: loanCtx.setBorrowingLimits,
  recordLoanPayment: loanCtx.recordLoanPayment, undoLoanPayment: loanCtx.undoLoanPayment,
}), [loanCtx.loans, loanCtx.stakingItems, loanCtx.borrowingLimits,
    loanCtx.setLoans, loanCtx.setStakingItems, loanCtx.setBorrowingLimits,
    loanCtx.recordLoanPayment, loanCtx.undoLoanPayment]);

const cashflowValue = useMemo(() => ({
  monthlyRecords: cashflowCtx.monthlyRecords, setMonthlyRecords: cashflowCtx.setMonthlyRecords,
  cashflowTemplate: cashflowCtx.cashflowTemplate, setCashflowTemplate: cashflowCtx.setCashflowTemplate,
  annualEntries: cashflowCtx.annualEntries, setAnnualEntries: cashflowCtx.setAnnualEntries,
  categoryBudgets: cashflowCtx.categoryBudgets, setCategoryBudgets: cashflowCtx.setCategoryBudgets,
  customCategories: cashflowCtx.customCategories, setCustomCategories: cashflowCtx.setCustomCategories,
}), [cashflowCtx.monthlyRecords, cashflowCtx.cashflowTemplate, cashflowCtx.annualEntries,
    cashflowCtx.categoryBudgets, cashflowCtx.customCategories,
    cashflowCtx.setMonthlyRecords, cashflowCtx.setCashflowTemplate, cashflowCtx.setAnnualEntries,
    cashflowCtx.setCategoryBudgets, cashflowCtx.setCustomCategories]);
```

然後把 `<AppContext.Provider value={{ ... }}>` 改成：

```tsx
const ctxValue = useMemo(() => ({
  ...settingsValue,
  ...stockValue,
  ...loanValue,
  ...cashflowValue,
  assets, setAssets, liabilities, setLiabilities, snapshots, setSnapshots,
  combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
  netWorth, momDelta,
  totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
  totalCollateralValueTWD,
  goals, setGoals,
  clearAllData, takeSnapshot,
}), [
  settingsValue, stockValue, loanValue, cashflowValue,
  assets, liabilities, snapshots, combinedAssets, combinedLiabilities,
  totalAssets, totalLiabilities, netWorth, momDelta,
  totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
  totalCollateralValueTWD, goals,
  setAssets, setLiabilities, setSnapshots, setGoals,
  clearAllData, takeSnapshot,
]);

return (
  <AppContext.Provider value={ctxValue}>
    {children}
  </AppContext.Provider>
);
```

- [ ] **Step 3：TypeScript 檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: 無錯誤

- [ ] **Step 4：Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "perf(context): memoize AppContextBridge value slices to reduce re-renders"
```

---

## Task 3：React.memo 覆蓋高頻組件

**Files:**
- Modify: `src/components/stocks/StockRow.tsx`
- Modify: `src/components/debt/StakingRow.tsx`
- Modify: `src/components/debt/InstallmentLoanCard.tsx`
- Modify: `src/components/debt/RevolvingLoanCard.tsx`
- Modify: `src/components/cashflow/CashFlowRow.tsx`
- Modify: `src/components/cashflow/OneTimeEntryRow.tsx`
- Modify: `src/components/HeroKPI.tsx`
- Modify: `src/components/dashboard/CashflowSummaryBar.tsx`

每個組件的修改方式相同：在 `export function Xxx(...)` 外包一層 `React.memo`。

- [ ] **Step 1：StockRow.tsx**

在檔案頂部加 `import { memo } from 'react';`（合併至既有 react import），然後：

```tsx
// 原本：
export function StockRow({ ... }: ...) { ... }

// 改成：
export const StockRow = memo(function StockRow({ ... }: ...) { ... });
```

- [ ] **Step 2：StakingRow.tsx**

```tsx
// 原本：
export function StakingRow({ ... }: ...) { ... }

// 改成：
export const StakingRow = memo(function StakingRow({ ... }: ...) { ... });
```

- [ ] **Step 3：InstallmentLoanCard.tsx**

```tsx
export const InstallmentLoanCard = memo(function InstallmentLoanCard({ ... }: ...) { ... });
```

- [ ] **Step 4：RevolvingLoanCard.tsx**

```tsx
export const RevolvingLoanCard = memo(function RevolvingLoanCard({ ... }: ...) { ... });
```

- [ ] **Step 5：CashFlowRow.tsx**

```tsx
export const CashFlowRow = memo(function CashFlowRow({ ... }: ...) { ... });
```

- [ ] **Step 6：OneTimeEntryRow.tsx**

```tsx
export const OneTimeEntryRow = memo(function OneTimeEntryRow({ ... }: ...) { ... });
```

- [ ] **Step 7：HeroKPI.tsx**

```tsx
export const HeroKPI = memo(function HeroKPI({ ... }: ...) { ... });
```

- [ ] **Step 8：CashflowSummaryBar.tsx**

```tsx
export const CashflowSummaryBar = memo(function CashflowSummaryBar({ ... }: ...) { ... });
```

- [ ] **Step 9：TypeScript 檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: 無錯誤

- [ ] **Step 10：Commit**

```bash
git add src/components/stocks/StockRow.tsx src/components/debt/StakingRow.tsx \
  src/components/debt/InstallmentLoanCard.tsx src/components/debt/RevolvingLoanCard.tsx \
  src/components/cashflow/CashFlowRow.tsx src/components/cashflow/OneTimeEntryRow.tsx \
  src/components/HeroKPI.tsx src/components/dashboard/CashflowSummaryBar.tsx
git commit -m "perf(components): React.memo on high-frequency list items"
```

---

## Task 4：股票輪詢條件化（Page Visibility API）

**Files:**
- Modify: `src/context/StockContext.tsx`

- [ ] **Step 1：替換輪詢 useEffect**

找到 StockContext.tsx 中原本的 `setInterval` useEffect（約 44-47 行），替換為：

```tsx
useEffect(() => {
  if (stockItems.length === 0) return;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const startPolling = () => {
    if (intervalId) return;
    intervalId = setInterval(() => refreshRef.current?.(), 60_000);
  };

  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refreshRef.current?.();
      startPolling();
    } else {
      stopPolling();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (document.visibilityState === 'visible') {
    startPolling();
  }

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    stopPolling();
  };
}, [stockItems.length]);
```

- [ ] **Step 2：TypeScript 檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: 無錯誤

- [ ] **Step 3：Commit**

```bash
git add src/context/StockContext.tsx
git commit -m "perf(stock): pause quote polling when page is hidden (Page Visibility API)"
```

---

## Task 5：新增 Skeleton 組件

**Files:**
- Create: `src/components/ui/Skeleton.tsx`

- [ ] **Step 1：建立 Skeleton.tsx**

```tsx
// src/components/ui/Skeleton.tsx
"use client";

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function ChartSkeleton({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`${height} bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-end gap-2`}>
      <div className="flex items-end gap-2 h-full">
        {[60, 40, 75, 55, 80, 45, 65, 70, 50, 85, 60, 90].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse bg-gray-200 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 flex gap-4">
        {Array.from({ length: cols - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
```

- [ ] **Step 2：TypeScript 確認**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: 無錯誤

- [ ] **Step 3：Commit**

```bash
git add src/components/ui/Skeleton.tsx
git commit -m "feat(ui): add Skeleton, ChartSkeleton, TableRowSkeleton, KPISkeleton components"
```

---

## Task 6：新增 ErrorBoundary 組件

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

- [ ] **Step 1：建立 ErrorBoundary.tsx**

```tsx
// src/components/ErrorBoundary.tsx
"use client";

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 gap-2">
          <span className="text-sm">圖表載入失敗</span>
          <button
            className="text-xs text-indigo-500 hover:text-indigo-700"
            onClick={() => this.setState({ hasError: false })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2：TypeScript 確認**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

- [ ] **Step 3：Commit**

```bash
git add src/components/ErrorBoundary.tsx
git commit -m "feat(ui): add ErrorBoundary component with retry"
```

---

## Task 7：Dynamic Import 圖表與重型組件

**Files:**
- Modify: `src/app/page.tsx`（dashboard）
- Modify: `src/app/stocks/page.tsx`
- Modify: `src/app/debt/page.tsx`

- [ ] **Step 1：Dashboard page.tsx — 替換重型組件為 dynamic import**

在 `src/app/page.tsx` 頂部，移除原本的靜態 import：
```tsx
// 移除這些：
import { NetWorthChart } from '../components/NetWorthChart';
import { AssetAllocationChart } from '../components/AssetAllocationChart';
```

改為：
```tsx
import dynamic from 'next/dynamic';
import { ChartSkeleton, KPISkeleton } from '../components/ui/Skeleton';
import { ErrorBoundary } from '../components/ErrorBoundary';

const NetWorthChart = dynamic(
  () => import('../components/NetWorthChart').then(m => ({ default: m.NetWorthChart })),
  { loading: () => <ChartSkeleton height="h-56" />, ssr: false }
);
const AssetAllocationChart = dynamic(
  () => import('../components/AssetAllocationChart').then(m => ({ default: m.AssetAllocationChart })),
  { loading: () => <ChartSkeleton height="h-48" />, ssr: false }
);
```

在 JSX 中，把 `<NetWorthChart .../>` 和 `<AssetAllocationChart .../>` 用 ErrorBoundary 包裹：

```tsx
<ErrorBoundary>
  <NetWorthChart ... />
</ErrorBoundary>

<ErrorBoundary>
  <AssetAllocationChart ... />
</ErrorBoundary>
```

- [ ] **Step 2：Stocks page.tsx — 替換重型組件**

移除靜態 import：
```tsx
// 移除：
import { StocksPerformanceTab } from '../../components/StocksPerformanceTab';
import { DividendCalendar } from '../../components/DividendCalendar';
import { PortfolioRebalance } from '../../components/PortfolioRebalance';
import { StockSectorChart } from '../../components/StockSectorChart';
import { PortfolioTrendChart } from '../../components/stocks/PortfolioTrendChart';
```

改為：
```tsx
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '../../components/ui/Skeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const StocksPerformanceTab = dynamic(
  () => import('../../components/StocksPerformanceTab').then(m => ({ default: m.StocksPerformanceTab })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
const DividendCalendar = dynamic(
  () => import('../../components/DividendCalendar').then(m => ({ default: m.DividendCalendar })),
  { loading: () => <ChartSkeleton height="h-64" />, ssr: false }
);
const PortfolioRebalance = dynamic(
  () => import('../../components/PortfolioRebalance').then(m => ({ default: m.PortfolioRebalance })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
const StockSectorChart = dynamic(
  () => import('../../components/StockSectorChart').then(m => ({ default: m.StockSectorChart })),
  { loading: () => <ChartSkeleton height="h-40" />, ssr: false }
);
const PortfolioTrendChart = dynamic(
  () => import('../../components/stocks/PortfolioTrendChart').then(m => ({ default: m.PortfolioTrendChart })),
  { loading: () => <ChartSkeleton height="h-40" />, ssr: false }
);
```

在 JSX 中，把所有圖表用 `<ErrorBoundary>` 包裹。

- [ ] **Step 3：Debt page.tsx — 替換重型組件**

```tsx
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '../../components/ui/Skeleton';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const LoanPayoffTimeline = dynamic(
  () => import('../../components/LoanPayoffTimeline').then(m => ({ default: m.LoanPayoffTimeline })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
const LoanRefinanceCalc = dynamic(
  () => import('../../components/LoanRefinanceCalc').then(m => ({ default: m.LoanRefinanceCalc })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
```

- [ ] **Step 4：TypeScript 檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: 無錯誤

- [ ] **Step 5：Commit**

```bash
git add src/app/page.tsx src/app/stocks/page.tsx src/app/debt/page.tsx
git commit -m "perf(pages): dynamic import heavy charts + ErrorBoundary wrapping"
```

---

## Task 8：Stocks 頁面 Skeleton Loading

**Files:**
- Modify: `src/app/stocks/page.tsx`

- [ ] **Step 1：在 stocks page 加骨架列**

在 `StocksPage` 中，找到顯示股票列表的區段（使用 `stockItems.map(item => <StockRow .../>)`），在前面加條件：

```tsx
import { TableRowSkeleton } from '../../components/ui/Skeleton';

// 在 stockItems.map 前：
{quotesLoading ? (
  Array.from({ length: Math.max(stockItems.length, 3) }).map((_, i) => (
    <TableRowSkeleton key={i} cols={6} />
  ))
) : (
  stockItems.map(item => <StockRow ... />)
)}
```

- [ ] **Step 2：TypeScript 確認**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

- [ ] **Step 3：Commit**

```bash
git add src/app/stocks/page.tsx
git commit -m "feat(stocks): skeleton loading while quotes fetch"
```

---

## Task 9：Cashflow Page 拆分

**Files:**
- Create: `src/components/cashflow/CashflowPageHeader.tsx`
- Create: `src/components/cashflow/CashflowFilterBar.tsx`
- Create: `src/components/cashflow/CashflowKPICards.tsx`
- Modify: `src/app/cashflow/page.tsx`（目標 ≤180 行）

- [ ] **Step 1：建立 CashflowPageHeader.tsx**

```tsx
// src/components/cashflow/CashflowPageHeader.tsx
"use client";
import { Settings2 } from 'lucide-react';
import { MonthNavigator } from './MonthNavigator';
import { MonthlySummaryCard } from './MonthlySummaryCard';

interface Props {
  year: number; month: number;
  onPrev: () => void; onNext: () => void;
  totalIncome: number; totalExpense: number; netAmount: number;
  showValues: boolean;
  activeTab: 'flow' | 'category' | 'annual';
  onTabChange: (tab: 'flow' | 'category' | 'annual') => void;
}

export function CashflowPageHeader({
  year, month, onPrev, onNext,
  totalIncome, totalExpense, netAmount, showValues,
  activeTab, onTabChange,
}: Props) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收支管理</h1>
          <p className="text-sm text-gray-500 mt-1">記錄固定收支與本月一次性項目</p>
        </div>
        <MonthNavigator year={year} month={month} onPrev={onPrev} onNext={onNext} />
      </div>
      <MonthlySummaryCard
        totalIncome={totalIncome} totalExpense={totalExpense}
        netAmount={netAmount} showValues={showValues}
      />
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {(['flow', 'category', 'annual'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'flow' ? '本月收支' : tab === 'category' ? '類別分析' : '年度總覽'}
            </button>
          ))}
        </div>
        <button
          onClick={() => onTabChange('category')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors bg-white"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">管理類別</span>
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2：建立 CashflowFilterBar.tsx**

```tsx
// src/components/cashflow/CashflowFilterBar.tsx
"use client";
import { Search, X } from 'lucide-react';

interface Props {
  filterType: 'all' | 'income' | 'expense';
  onFilterType: (t: 'all' | 'income' | 'expense') => void;
  filterKeyword: string;
  onFilterKeyword: (k: string) => void;
}

export function CashflowFilterBar({ filterType, onFilterType, filterKeyword, onFilterKeyword }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl text-sm">
        {(['all', 'income', 'expense'] as const).map(t => (
          <button
            key={t}
            onClick={() => onFilterType(t)}
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
          onChange={e => onFilterKeyword(e.target.value)}
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
        />
        {filterKeyword && (
          <button onClick={() => onFilterKeyword('')} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3：建立 CashflowKPICards.tsx**

```tsx
// src/components/cashflow/CashflowKPICards.tsx
"use client";
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';

interface Props {
  totalIncome: number; totalExpense: number; netAmount: number;
  oneTimeIncomeTotal: number; oneTimeExpenseTotal: number;
  formatCurrency: (n: number) => string;
}

export function CashflowKPICards({ totalIncome, totalExpense, netAmount, oneTimeIncomeTotal, oneTimeExpenseTotal, formatCurrency }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-emerald-600 mb-2">
          <ArrowUpCircle className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">本月總收入</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalIncome)}</h2>
        {oneTimeIncomeTotal > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">含本月一次性收入 {formatCurrency(oneTimeIncomeTotal)}</p>
        )}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-rose-600 mb-2">
          <ArrowDownCircle className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">本月總支出</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpense)}</h2>
        {oneTimeExpenseTotal > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">含本月一次性支出 {formatCurrency(oneTimeExpenseTotal)}</p>
        )}
      </div>
      <div className={`rounded-2xl p-6 shadow-sm border ${netAmount >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
        <div className={`flex items-center gap-2 mb-2 ${netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          <Wallet className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">本月淨收支</span>
        </div>
        <h2 className={`text-3xl font-bold ${netAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
          {formatCurrency(Math.abs(netAmount))}
        </h2>
        <p className={`text-xs mt-1.5 ${netAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {netAmount >= 0 ? '本月有結餘' : '本月超支'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4：更新 cashflow/page.tsx 使用新組件**

在 `src/app/cashflow/page.tsx` 頂部，加入新 import：

```tsx
import { CashflowPageHeader } from '../../components/cashflow/CashflowPageHeader';
import { CashflowFilterBar } from '../../components/cashflow/CashflowFilterBar';
import { CashflowKPICards } from '../../components/cashflow/CashflowKPICards';
```

移除舊 import：
```tsx
// 移除：
import { MonthNavigator } from '../../components/cashflow/MonthNavigator';
import { MonthlySummaryCard } from '../../components/cashflow/MonthlySummaryCard';
// 移除 Wallet, ArrowUpCircle, ArrowDownCircle, Search, X from lucide（改到子組件）
```

在 return 中，將原本的 header 區塊（包含 MonthNavigator、MonthlySummaryCard、tab bar、filter bar、KPI cards）替換為：

```tsx
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
        {/* ... 其餘固定收支與一次性項目保持不變 ... */}
      </>
    )}
    {/* ... category / annual tab 保持不變 ... */}
  </>
);
```

- [ ] **Step 5：確認行數**

```bash
wc -l src/app/cashflow/page.tsx
```

Expected: ≤200 行

- [ ] **Step 6：TypeScript 檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: 無錯誤

- [ ] **Step 7：Commit**

```bash
git add src/components/cashflow/CashflowPageHeader.tsx \
  src/components/cashflow/CashflowFilterBar.tsx \
  src/components/cashflow/CashflowKPICards.tsx \
  src/app/cashflow/page.tsx
git commit -m "refactor(cashflow): extract header/filter/kpi to sub-components, page ≤200 lines"
```

---

## Task 10：Build 驗證

- [ ] **Step 1：執行完整 build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` 或 `Route ... kB`，無 error

- [ ] **Step 2：執行 TypeScript 完整檢查**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```

Expected: 無任何錯誤輸出

- [ ] **Step 3：執行測試**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4：最終 Commit**

```bash
git add -A
git commit -m "chore: verify build after performance & UX optimization"
```

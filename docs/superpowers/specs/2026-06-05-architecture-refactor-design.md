# Architecture Refactor & UI Optimization Design

**Date:** 2026-06-05  
**Branch:** feat/cashflow-category → new branch from master  
**Scope:** Code architecture refactoring + UI/UX fixes, API-ready foundation

---

## Goals

1. Break the God Context into domain-specific contexts
2. Add a thin service layer to abstract localStorage (API-ready)
3. Consolidate type definitions
4. Fix UI patterns and extract oversized page components
5. All changes must leave the app functionally identical — no feature changes

---

## Section 1: Service Layer

**Location:** `src/services/`

Each service is a plain TypeScript module exporting async functions. No classes, no interfaces. Contexts call these functions and do not touch localStorage keys directly.

```
src/services/
  assetService.ts       ← assets, liabilities, snapshots
  cashflowService.ts    ← monthlyRecords, cashflowTemplate, annualEntries, categoryBudgets, customCategories
  loanService.ts        ← loans, stakingItems, borrowingLimits
  settingsService.ts    ← userName, userEmail, usdToTwd, reportSchedule, netWorthGoal,
                          fireSettings, lifeEvents, onboardingDone, enablePledgeTracking,
                          showValues, lastExportDate, lastReportSent, pledgeAlertLastSent
```

**Pattern (each service):**
```ts
// src/services/assetService.ts
export async function getAssets(): Promise<AssetCategory[]> {
  const stored = localStorage.getItem('app-assets-v1');
  return stored ? JSON.parse(stored) : initialAssets;
}
export async function saveAssets(assets: AssetCategory[]): Promise<void> {
  localStorage.setItem('app-assets-v1', JSON.stringify(assets));
}
```

**API migration path:** Replace function body only. Context and components untouched.

---

## Section 2: Context Split

**Current:** `AppContext.tsx` (707 lines) — one God Context  
**Target:** 5 focused contexts + thin orchestrator

### New contexts

| File | Owns |
|---|---|
| `AssetContext.tsx` | assets, liabilities, snapshots, combinedAssets, combinedLiabilities, totalAssets, totalLiabilities, netWorth, takeSnapshot, clearAssetData |
| `CashFlowContext.tsx` | monthlyRecords, cashflowTemplate, annualEntries, categoryBudgets, customCategories, totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow |
| `LoanContext.tsx` | loans, stakingItems, borrowingLimits, recordLoanPayment, undoLoanPayment, totalLoanMonthlyPayments, stakingBorrowInterest, stakingEarnTotal, stakingEarnIncome |
| `StockContext.tsx` | already exists — no changes |
| `SettingsContext.tsx` | showValues, userName, userEmail, usdToTwd, reportSchedule, netWorthGoal, fireSettings, lifeEvents, onboardingDone, enablePledgeTracking, pledgeAlertLastSent, lastExportDate, lastReportSent |

### Orchestrator (AppContext.tsx after refactor)

Becomes a thin shell that:
- Composes contexts via a single `AppProvider` wrapper
- Exposes cross-domain derived values: `netWorth`, `momDelta`, `totalCollateralValueTWD`, `clearAllData`
- Calls `useAssetContext()`, `useCashFlowContext()`, `useLoanContext()`, `useSettingsContext()` internally

### Provider nesting order (ClientLayout)
```
StockProvider
  └─ SettingsProvider
      └─ LoanProvider
          └─ AssetProvider
              └─ CashFlowProvider
                  └─ ToastProvider
                      └─ ClientLayoutContent
```

---

## Section 3: Type Consolidation

**Problem:** Types split between `src/types.ts` and `src/context/AppContext.tsx`

**Fix:** Move all shared types to `src/types.ts`:
- `StakingItem`, `StakingType`
- `LoanItem`, `LoanType`  
- `StockItem`, `StockSector`, `StockQuote`
- `DividendRecord`
- `CashFlowItem`, `AnnualEntry`, `AnnualEntryCategory`
- `MonthRecord`, `CashflowTemplate`
- `AssetSnapshot`
- `FinancialGoal`

`AppContext.tsx` imports from `types.ts` only — no type definitions remain there.

---

## Section 4: UI & Component Fixes

### 4a. Cashflow page extraction
`src/app/cashflow/page.tsx` (1195 lines, 10+ inline components) →

```
src/components/cashflow/
  MonthNavigator.tsx
  MonthlySummaryCard.tsx        ← replaces IIFE pattern
  CashFlowRow.tsx
  AddFixedItemRow.tsx
  OneTimeEntryRow.tsx
  AddOneTimeEntryRow.tsx
  AutoItemRows.tsx              ← merges AutoStakingIncomeRow, AutoStakingExpenseRow, AutoLoanExpenseRow
  CategoryManager.tsx
  CategoryAnalysisTab.tsx
  MonthTrendChart.tsx
```

`cashflow/page.tsx` drops to ~150 lines orchestrating these components.

### 4b. Shared snapshot builder
**Problem:** `takeSnapshot()` and the auto-snapshot `useEffect` in AppContext have near-identical logic (~25 lines duplicated).

**Fix:** Extract `buildSnapshot(params): AssetSnapshot` pure function to `src/lib/snapshotUtils.ts`. Both call this function.

### 4c. ConfirmDialog in snapshot manager
**Problem:** `page.tsx` snapshot table uses `confirm()` native browser dialog.  
**Fix:** Replace with existing `<ConfirmDialog>` component.

### 4d. BottomTabBar — add `/debt`
**Problem:** Navbar has 6 links including `/debt`; BottomTabBar only has 5 (missing `/debt`).  
**Fix:** Add `{ href: '/debt', icon: Coins, label: '負債' }` to BottomTabBar tabs array. Adjust layout if needed (6 tabs on mobile).

### 4e. Navbar active class helpers
**Problem:** 3 separate functions (`getNavClass`, `getIconNavClass`, `getMobileNavClass`) doing the same active check.  
**Fix:** Single helper `navClass(path, variant: 'desktop' | 'icon' | 'mobile')` or inline the 2-line logic at call site.

### 4f. currentMonthKey memoization
**Problem:** In AppContext, `monthKey(new Date())` is called at module evaluation on every render.  
**Fix:** Wrap in `useMemo(() => monthKey(new Date()), [])`.

---

## File Structure After Refactor

```
src/
  types.ts                      ← all shared types (consolidated)
  services/
    assetService.ts
    cashflowService.ts
    loanService.ts
    settingsService.ts
  context/
    AppContext.tsx               ← thin orchestrator
    AssetContext.tsx             ← new
    CashFlowContext.tsx          ← new
    LoanContext.tsx              ← new
    SettingsContext.tsx          ← new
    StockContext.tsx             ← unchanged
    ToastContext.tsx             ← unchanged
  components/
    cashflow/                   ← new directory
      MonthNavigator.tsx
      MonthlySummaryCard.tsx
      CashFlowRow.tsx
      AddFixedItemRow.tsx
      OneTimeEntryRow.tsx
      AddOneTimeEntryRow.tsx
      AutoItemRows.tsx
      CategoryManager.tsx
      CategoryAnalysisTab.tsx
      MonthTrendChart.tsx
  lib/
    snapshotUtils.ts            ← new: buildSnapshot() pure function
    (existing files unchanged)
```

---

## Constraints

- No feature changes — purely structural
- All existing localStorage keys preserved (no migration needed)
- `useStickyState` hook kept for now inside each context until service layer is wired
- TypeScript strict mode must pass throughout
- Existing tests (`*.test.ts`) must continue to pass

---

## Implementation Order (Incremental)

1. **Type consolidation** — move types to `types.ts` (safe, no logic change)
2. **Service layer** — create `src/services/` with localStorage implementations
3. **Context split** — one context at a time: Settings → CashFlow → Loan → Asset
4. **AppContext orchestrator** — thin shell composing all contexts
5. **Cashflow component extraction** — extract inline components to `src/components/cashflow/`
6. **UI fixes** — BottomTabBar, ConfirmDialog, Navbar helpers, currentMonthKey, snapshotUtils

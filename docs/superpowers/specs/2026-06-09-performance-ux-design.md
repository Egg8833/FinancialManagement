# Performance & UX Optimization Design

**Date:** 2026-06-09  
**Status:** Approved

## Goal

提升 AssetDash 的執行期效能與使用者體驗，涵蓋 Context re-render 優化、bundle 拆分、骨架載入動畫、錯誤邊界，以及 cashflow page 最終拆分。

---

## Section 1：Context 架構重構

### 問題

`AppContext` 把所有 state 放在單一 `value` 物件（381 行、30+ 個 state）。股票報價每 60 秒更新，導致所有 consumer（Dashboard、Cashflow、Debt 等頁面）無差別 re-render。

### 設計

不新增 Provider，在 `AppContext.tsx` 內把 `value` 用 `useMemo` 拆成穩定的 slice：

| Slice | 內容 | 更新頻率 |
|-------|------|----------|
| `settingsSlice` | `showValues`, `userName`, `userEmail`, `reportSchedule` 等設定 | 幾乎不變 |
| `assetsSlice` | `assets`, `snapshots`, `totalAssets`, `totalLiabilities`, `netWorth` 等 | 低頻（手動操作） |
| `cashflowSlice` | `monthlyRecords`, `annualEntries`, `cashflowTemplate`, `customCategories`, `categoryBudgets` | 低頻 |
| `stockSlice` | `stockItems`, `stockQuotes`, `lastUpdated`, `quoteError`, `dividendRecords` | 高頻（每分鐘） |
| `loanSlice` | `loans`, `stakingItems`, `borrowingLimits` | 低頻 |
| `actionsSlice` | 所有 setter 與 action 函式 | 永遠穩定（useCallback） |

**各 slice 用獨立 `useMemo` 包裹**，consumer 透過 `useAppContext()` 取值時，只有所訂閱的 slice 改變才會 re-render。

```ts
// 範例
const stockSlice = useMemo(() => ({
  stockItems, stockQuotes, lastUpdated, quoteError,
  refreshQuotes, usdToTwd, setUsdToTwd,
}), [stockItems, stockQuotes, lastUpdated, quoteError, usdToTwd]);
```

### 影響範圍

- 修改：`src/context/AppContext.tsx`
- 不新增任何檔案，不改變 `useAppContext()` 的使用方式

---

## Section 2：效能優化

### 2a. useStickyState Hydration Flicker 修復

**問題：** 先用 `defaultValue` render，`useEffect` 才讀 localStorage，導致每次 mount 都多一次 re-render，畫面閃爍。

**修法：** 改用 `useState(() => { ... })` lazy initializer。在 SSR 環境（`typeof window === 'undefined'`）fallback 到 `defaultValue`；Client 端直接讀 localStorage 作為初始值，不再需要 `isInitialized` 狀態。

```ts
const [value, setValue] = useState<T>(() => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
});
```

- 修改：`src/hooks/useStickyState.ts`

### 2b. React.memo 覆蓋

以下組件 props 穩定但父層頻繁 re-render，加 `React.memo` 避免無謂重繪：

| 組件 | 原因 |
|------|------|
| `StockRow` | stocks page 每次報價更新都重繪整個列表 |
| `StakingRow` | debt page 列表項目 |
| `InstallmentLoanCard` | loan section 項目 |
| `RevolvingLoanCard` | loan section 項目 |
| `CashFlowRow` | cashflow 列表項目 |
| `OneTimeEntryRow` | cashflow 一次性項目 |
| `HeroKPI` | dashboard 頂部 KPI，數值不常變 |
| `CashflowSummaryBar` | dashboard cashflow 摘要列 |

### 2c. Dynamic Import（Lazy Load）

以下組件首屏用不到且體積大（含 recharts），改用 `next/dynamic` + Skeleton placeholder：

**圖表類（recharts）：**
- `NetWorthChart`
- `AssetAllocationChart`
- `StockSectorChart`
- `PortfolioTrendChart`

**功能類（按需展開）：**
- `DividendCalendar`
- `LoanPayoffTimeline`
- `LoanRefinanceCalc`
- `PortfolioRebalance`
- `StocksPerformanceTab`

實作方式：
```ts
const NetWorthChart = dynamic(() => import('../components/NetWorthChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

### 2d. 股票輪詢條件化

**問題：** `StockProvider` 掛載後每 60 秒無條件打 `/api/quote`，即使使用者在 cashflow/debt 頁面。

**修法：** 加入 Page Visibility API，只有 `document.visibilityState === 'visible'` 且 `stockItems.length > 0` 時才輪詢：

```ts
useEffect(() => {
  const start = () => {
    if (document.visibilityState === 'visible' && stockItems.length > 0) {
      interval = setInterval(() => refreshRef.current?.(), 60_000);
    }
  };
  document.addEventListener('visibilitychange', () => {
    clearInterval(interval);
    if (document.visibilityState === 'visible') start();
  });
  start();
  return () => clearInterval(interval);
}, [stockItems.length]);
```

- 修改：`src/context/StockContext.tsx`

---

## Section 3：UX 改善

### 3a. Skeleton Loading

新增 `src/components/ui/Skeleton.tsx`，提供：
- `Skeleton`：基礎動畫骨架 block（`animate-pulse bg-gray-200 rounded`）
- `ChartSkeleton`：圖表佔位（h-48，帶假軸線）
- `TableRowSkeleton`：表格列佔位
- `KPISkeleton`：KPI 卡佔位

使用位置：
- Stocks 頁：報價載入時每個 `StockRow` 顯示 `TableRowSkeleton`（3~5 列）
- Dashboard：圖表 lazy load 期間顯示 `ChartSkeleton`
- 所有 recharts lazy load 的 `loading` prop

### 3b. Error Boundary

新增 `src/components/ErrorBoundary.tsx`（class component，React 規範）：
- 包裹各頁面圖表區塊
- catch 到錯誤時顯示：「圖表載入失敗，請重新整理頁面」+ retry 按鈕
- 不影響頁面其他部分

使用位置：
- `NetWorthChart`、`AssetAllocationChart`、`PortfolioTrendChart`、`StockSectorChart` 的外層

---

## Section 4：Cashflow Page 拆分

### 問題

`src/app/cashflow/page.tsx` 目前 521 行，超過架構目標 ≤300 行。

### 拆分方案

新增以下組件（與現有 cashflow 組件資料夾對齊）：

| 新檔案 | 內容 | 預估行數 |
|--------|------|----------|
| `src/components/cashflow/CashflowPageHeader.tsx` | 月份導航 + MonthlySummaryCard | ~60 行 |
| `src/components/cashflow/FixedItemsSection.tsx` | 固定收支列表（CashFlowRow + AddFixedItemRow） | ~80 行 |
| `src/components/cashflow/OneTimeEntriesSection.tsx` | 一次性項目（OneTimeEntryRow + AddOneTimeEntryRow） | ~70 行 |

**修改後：**
- `src/app/cashflow/page.tsx`：~180 行（只保留 state、計算邏輯、組合組件）

---

## 新增 / 修改檔案總覽

**新增：**
```
src/components/ui/Skeleton.tsx
src/components/ErrorBoundary.tsx
src/components/cashflow/CashflowPageHeader.tsx
src/components/cashflow/FixedItemsSection.tsx
src/components/cashflow/OneTimeEntriesSection.tsx
```

**修改：**
```
src/hooks/useStickyState.ts          hydration flicker 修復
src/context/AppContext.tsx           Context slice 拆分
src/context/StockContext.tsx         輪詢條件化
src/components/stocks/StockRow.tsx   React.memo
src/components/debt/StakingRow.tsx   React.memo
src/components/debt/InstallmentLoanCard.tsx   React.memo
src/components/debt/RevolvingLoanCard.tsx     React.memo
src/components/cashflow/CashFlowRow.tsx       React.memo
src/components/cashflow/OneTimeEntryRow.tsx   React.memo
src/components/HeroKPI.tsx           React.memo
src/components/dashboard/CashflowSummaryBar.tsx   React.memo
src/app/page.tsx                     dynamic import 圖表
src/app/stocks/page.tsx              dynamic import 圖表/功能組件
src/app/cashflow/page.tsx            拆分至 ≤180 行
src/app/debt/page.tsx                dynamic import LoanPayoffTimeline 等
```

---

## 預期成效

| 指標 | 改善前 | 改善後 |
|------|--------|--------|
| 股票報價更新觸發的 re-render 範圍 | 全頁所有組件 | 僅 stocks page 相關組件 |
| 首屏 JS bundle（recharts） | 同步載入 | 按需載入 |
| useStickyState mount flicker | 每次都有 | 消除 |
| 背景分頁 API 呼叫 | 每分鐘 | 分頁可見時才觸發 |
| Cashflow page 行數 | 521 行 | ≤180 行 |
| 圖表錯誤影響範圍 | 整頁白屏 | 僅圖表區塊 |

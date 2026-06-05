# 架構重構與 UI 優化設計文件

**日期：** 2026-06-05  
**分支：** feat/cashflow-category → 從 master 開新分支  
**範圍：** 程式碼架構重構 + UI/UX 修正，為未來後端 API 打好基礎

---

## 目標

1. 將 God Context 拆分成各自負責的 domain Context
2. 建立薄薄的 Service Layer，讓 localStorage 可隨時換成後端 API
3. 統一型別定義位置
4. 修正 UI 模式問題，提取過大的頁面組件
5. 所有修改保持功能完全不變 — 純粹結構性重構

---

## 第一節：Service Layer（資料抽象層）

**位置：** `src/services/`

每個 service 都是純 TypeScript 模組，只匯出 async 函式，不用 class 也不用 interface。Context 只呼叫這些函式，不直接碰 localStorage key 字串。

```
src/services/
  assetService.ts       ← 資產、負債、快照
  cashflowService.ts    ← 月收支記錄、範本、年度記錄、類別預算、自訂類別
  loanService.ts        ← 貸款、質押項目、借貸上限
  settingsService.ts    ← 用戶資訊、FIRE 設定、UI 偏好、各種開關
```

**每個 service 的寫法：**
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

**未來接 API：** 只改函式的實作內容，Context 和 Component 完全不動。

---

## 第二節：Context 拆分

**現況：** `AppContext.tsx`（707 行）— 所有狀態塞在同一個 Context  
**目標：** 5 個專注的 domain Context + 薄薄的 orchestrator

### 新增 Context

| 檔案 | 負責管理 |
|---|---|
| `AssetContext.tsx` | 資產、負債、快照、combinedAssets、combinedLiabilities、totalAssets、totalLiabilities、netWorth、takeSnapshot、clearAssetData |
| `CashFlowContext.tsx` | monthlyRecords、cashflowTemplate、annualEntries、categoryBudgets、customCategories、totalMonthlyIncome、totalMonthlyExpense、monthlyNetCashFlow |
| `LoanContext.tsx` | loans、stakingItems、borrowingLimits、recordLoanPayment、undoLoanPayment、totalLoanMonthlyPayments、stakingBorrowInterest、stakingEarnTotal、stakingEarnIncome |
| `StockContext.tsx` | 已存在，維持不動 |
| `SettingsContext.tsx` | showValues、userName、userEmail、usdToTwd、reportSchedule、netWorthGoal、fireSettings、lifeEvents、onboardingDone、enablePledgeTracking、pledgeAlertLastSent、lastExportDate、lastReportSent |

### Orchestrator（重構後的 AppContext.tsx）

變成薄殼，負責：
- 把所有 Provider 包在一起，對外提供單一 `AppProvider`
- 暴露跨 domain 的衍生計算值：`netWorth`、`momDelta`、`totalCollateralValueTWD`、`clearAllData`
- 內部呼叫 `useAssetContext()`、`useCashFlowContext()`、`useLoanContext()`、`useSettingsContext()` 再組合

### Provider 巢狀順序（ClientLayout）
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

## 第三節：型別統一

**問題：** 型別定義分散在 `src/types.ts` 和 `src/context/AppContext.tsx` 兩處

**修正：** 把所有共用型別移進 `src/types.ts`：
- `StakingItem`、`StakingType`
- `LoanItem`、`LoanType`
- `StockItem`、`StockSector`、`StockQuote`
- `DividendRecord`
- `CashFlowItem`、`AnnualEntry`、`AnnualEntryCategory`
- `MonthRecord`、`CashflowTemplate`
- `AssetSnapshot`
- `FinancialGoal`

重構後 `AppContext.tsx` 只從 `types.ts` import，自身不再定義任何共用型別。

---

## 第四節：UI 與組件修正

### 4a. Cashflow 頁面組件提取
`src/app/cashflow/page.tsx`（1195 行，10+ 個內嵌組件）拆分為：

```
src/components/cashflow/
  MonthNavigator.tsx          ← 月份切換器
  MonthlySummaryCard.tsx      ← 取代原本的 IIFE 寫法
  CashFlowRow.tsx             ← 固定收支項目列
  AddFixedItemRow.tsx         ← 新增固定項目的輸入列
  OneTimeEntryRow.tsx         ← 一次性記錄列
  AddOneTimeEntryRow.tsx      ← 新增一次性記錄的輸入列
  AutoItemRows.tsx            ← 合併 AutoStakingIncomeRow、AutoStakingExpenseRow、AutoLoanExpenseRow
  CategoryManager.tsx         ← 類別管理
  CategoryAnalysisTab.tsx     ← 類別分析頁籤
  MonthTrendChart.tsx         ← 近 12 個月收支趨勢圖
```

拆分後 `cashflow/page.tsx` 只剩約 150 行，負責組裝這些組件。

### 4b. 快照建構邏輯去重複
**問題：** `takeSnapshot()` 和 auto-snapshot `useEffect` 幾乎有相同的 25 行程式碼。  
**修正：** 提取 `buildSnapshot(params): AssetSnapshot` 純函式到 `src/lib/snapshotUtils.ts`，兩處共用。

### 4c. 快照管理器改用 ConfirmDialog
**問題：** `page.tsx` 快照列表用的是瀏覽器原生 `confirm()` 對話框，風格不一致。  
**修正：** 換成已有的 `<ConfirmDialog>` 組件。

### 4d. BottomTabBar 補上 `/debt`
**問題：** Navbar 有 6 個連結（含 `/debt`）；BottomTabBar 只有 5 個（缺 `/debt`）。  
**修正：** 在 tabs 陣列加入 `{ href: '/debt', icon: Coins, label: '負債' }`。

### 4e. Navbar active class helper 合併
**問題：** 3 個幾乎一樣的函式 `getNavClass`、`getIconNavClass`、`getMobileNavClass`，只差 class 字串。  
**修正：** 合併成單一 `navClass(path, variant: 'desktop' | 'icon' | 'mobile')` 函式。

### 4f. currentMonthKey 加上 useMemo
**問題：** AppContext 裡的 `monthKey(new Date())` 每次 render 都重算。  
**修正：** 用 `useMemo(() => monthKey(new Date()), [])` 包起來。

---

## 重構後的檔案結構

```
src/
  types.ts                      ← 所有共用型別（統一）
  services/
    assetService.ts
    cashflowService.ts
    loanService.ts
    settingsService.ts
  context/
    AppContext.tsx               ← 薄薄的 orchestrator
    AssetContext.tsx             ← 新增
    CashFlowContext.tsx          ← 新增
    LoanContext.tsx              ← 新增
    SettingsContext.tsx          ← 新增
    StockContext.tsx             ← 不動
    ToastContext.tsx             ← 不動
  components/
    cashflow/                   ← 新增目錄
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
    snapshotUtils.ts            ← 新增：buildSnapshot() 純函式
    （現有檔案不動）
```

---

## 限制條件

- 功能完全不變 — 純粹結構重構
- 所有現有的 localStorage key 保持不動（不需要資料遷移）
- `useStickyState` hook 在各 Context 內暫時保留，service layer 接上後再移除
- 整個過程 TypeScript 嚴格模式必須通過
- 現有測試（`*.test.ts`）必須繼續通過

---

## 實作順序（漸進式）

1. **型別統一** — 將型別移至 `types.ts`（安全，無邏輯變動）
2. **Service Layer** — 建立 `src/services/`，以 localStorage 實作
3. **Context 拆分** — 逐一進行：SettingsContext → CashFlowContext → LoanContext → AssetContext
4. **AppContext orchestrator** — 改成薄殼組合所有 Context
5. **Cashflow 組件提取** — 將內嵌組件移至 `src/components/cashflow/`
6. **UI 修正** — BottomTabBar、ConfirmDialog、Navbar helpers、currentMonthKey、snapshotUtils

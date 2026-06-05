# 架構重構與 UI 優化 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 707 行的 God Context 拆分成多個 domain Context、建立 Service Layer 為後端 API 接軌打基礎，並修正 UI 模式問題。

**Architecture:** 採用漸進式重構——先移型別、建 service layer，再逐一拆分 Context（SettingsContext → LoanContext → CashFlowContext → AssetContext），最後 AppContext 改成薄薄的 orchestrator 組合所有子 Context，對外維持相同的 `useAppContext()` 介面，27 個消費端檔案完全不需修改。

**Tech Stack:** Next.js 14, React 18, TypeScript, Vitest, Tailwind CSS, useStickyState（localStorage hook）

---

## 檔案結構總覽

| 動作 | 路徑 |
|---|---|
| **修改** | `src/types.ts` |
| **修改** | `src/context/AppContext.tsx` |
| **修改** | `src/context/StockContext.tsx` |
| **修改** | `src/app/debt/page.tsx`（import 路徑） |
| **修改** | `src/app/cashflow/page.tsx`（import 路徑） |
| **新增** | `src/services/assetService.ts` |
| **新增** | `src/services/cashflowService.ts` |
| **新增** | `src/services/loanService.ts` |
| **新增** | `src/services/settingsService.ts` |
| **新增** | `src/context/SettingsContext.tsx` |
| **新增** | `src/context/LoanContext.tsx` |
| **新增** | `src/context/CashFlowContext.tsx` |
| **新增** | `src/context/AssetContext.tsx` |
| **新增** | `src/lib/snapshotUtils.ts` |
| **新增** | `src/components/cashflow/MonthNavigator.tsx` |
| **新增** | `src/components/cashflow/MonthlySummaryCard.tsx` |
| **新增** | `src/components/cashflow/CashFlowRow.tsx` |
| **新增** | `src/components/cashflow/AddFixedItemRow.tsx` |
| **新增** | `src/components/cashflow/OneTimeEntryRow.tsx` |
| **新增** | `src/components/cashflow/AddOneTimeEntryRow.tsx` |
| **新增** | `src/components/cashflow/AutoItemRows.tsx` |
| **新增** | `src/components/cashflow/CategoryManager.tsx` |
| **新增** | `src/components/cashflow/CategoryAnalysisTab.tsx` |
| **新增** | `src/components/cashflow/MonthTrendChart.tsx` |
| **修改** | `src/app/cashflow/page.tsx`（主體） |
| **修改** | `src/components/Navbar.tsx` |
| **修改** | `src/components/BottomTabBar.tsx` |
| **修改** | `src/app/page.tsx`（快照刪除 confirm） |

---

## Task 1：型別統一（移至 types.ts）

**Files:**
- Modify: `src/types.ts`
- Modify: `src/context/AppContext.tsx`（移除型別定義，改 import）
- Modify: `src/context/StockContext.tsx`（import 路徑從 AppContext → types）
- Modify: `src/app/debt/page.tsx`（import 路徑）
- Modify: `src/app/cashflow/page.tsx`（import 路徑）

- [ ] **步驟 1：在 `src/types.ts` 末尾新增以下型別**

```ts
// ─── 以下從 AppContext.tsx 移入 ────────────────────────────────────────────────

export type StakingType = 'borrow' | 'earn';

export type StakingItem = {
  id: string;
  name: string;
  protocol: string;
  amount: number;
  value: number;
  apy: number;
  stakingType: StakingType;
  borrowDate?: string;
  repayDate?: string;
};

export type LoanType = 'installment' | 'revolving';

export type LoanItem = {
  id: string;
  name: string;
  bank: string;
  principal: number;
  initialPrincipal?: number;
  interestRate: number;
  monthlyPayment: number;
  paymentDay: number;
  remainingPeriods: number;
  loanType: LoanType;
  originalPeriods: number;
  nextPaymentDate?: string;
};

export type AssetSnapshot = {
  id: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  healthScore?: number;
  liquid?: number;
  investment?: number;
  fixed?: number;
  receivable?: number;
};

export type FinancialGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  color: string;
  icon: 'home' | 'car' | 'travel' | 'emergency' | 'retirement' | 'education' | 'other';
  linkedAssetItemIds?: string[];
};

export type StockSector =
  | '科技' | '金融' | '醫療' | '消費' | '工業'
  | '能源' | '原物料' | '房地產' | '公用事業' | '通訊' | '其他';

export type StockItem = {
  id: string;
  symbol: string;
  platform?: string;
  shares: number;
  avgCost: number;
  collateralShares?: number;
  notes?: string;
  purchaseDate?: string;
  sector?: StockSector;
};

export type StockQuote = {
  price: number;
  changePercent: number;
  currency: string;
  shortName?: string;
};

export type DividendRecord = {
  id: string;
  symbol: string;
  date: string;
  dividendPerShare: number;
  shares: number;
  currency: 'TWD' | 'USD';
  source: 'auto' | 'manual';
};

export type CashFlowItem = {
  id: string;
  name: string;
  amount: number;
  category: string;
  isRecurring: boolean;
  customCategory?: string;
};

export type AnnualEntryCategory =
  | 'dividend' | 'bonus' | 'other_income'
  | 'one_time_expense' | 'travel' | 'medical' | 'equipment';

export type AnnualEntry = {
  id: string;
  year: number;
  month: number;
  name: string;
  amount: number;
  category: AnnualEntryCategory;
};

export type MonthRecord = {
  income: CashFlowItem[];
  expense: CashFlowItem[];
};

export type CashflowTemplate = {
  income: CashFlowItem[];
  expense: CashFlowItem[];
};
```

- [ ] **步驟 2：更新 `src/context/AppContext.tsx` 頂部 import，並移除重複型別定義**

在 `AppContext.tsx` import 區塊最上方加入：
```ts
import type {
  StakingType, StakingItem, LoanType, LoanItem,
  AssetSnapshot, FinancialGoal, StockSector, StockItem,
  StockQuote, DividendRecord, CashFlowItem,
  AnnualEntryCategory, AnnualEntry, MonthRecord, CashflowTemplate,
} from '../types';
```

然後刪除 `AppContext.tsx` 中以下所有 `export type` 定義（已移至 types.ts）：
`StakingType`, `StakingItem`, `LoanType`, `LoanItem`, `AssetSnapshot`, `FinancialGoal`, `StockSector`, `StockItem`, `StockQuote`, `DividendRecord`, `CashFlowItem`, `AnnualEntryCategory`, `AnnualEntry`, `MonthRecord`, `CashflowTemplate`

在這些型別被外部 import 的地方（例如 `debt/page.tsx`），為維持向後相容，在 AppContext.tsx 底部加上 re-export：
```ts
// 向後相容 re-export（讓現有 consumer 不需改動 import 路徑）
export type {
  StakingType, StakingItem, LoanType, LoanItem,
  AssetSnapshot, FinancialGoal, StockSector, StockItem,
  StockQuote, DividendRecord, CashFlowItem,
  AnnualEntryCategory, AnnualEntry, MonthRecord, CashflowTemplate,
} from '../types';
```

- [ ] **步驟 3：更新 `src/context/StockContext.tsx` 第 5 行的 import**

```ts
// 原本
import type { StockItem, StockQuote, DividendRecord } from './AppContext';

// 改成
import type { StockItem, StockQuote, DividendRecord } from '../types';
```

- [ ] **步驟 4：執行 TypeScript 檢查**

```bash
npx tsc --noEmit
```

預期：零錯誤。如有錯誤，確認是否有遺漏的型別 import。

- [ ] **步驟 5：執行測試**

```bash
npm run test
```

預期：所有測試通過（goalUtils, healthScore, fireCalc, categoryUtils）。

- [ ] **步驟 6：Commit**

```bash
git add src/types.ts src/context/AppContext.tsx src/context/StockContext.tsx
git commit -m "refactor(types): 將所有共用型別移至 types.ts，AppContext 改用 re-export"
```

---

## Task 2：建立 Service Layer

**Files:**
- Create: `src/services/assetService.ts`
- Create: `src/services/cashflowService.ts`
- Create: `src/services/loanService.ts`
- Create: `src/services/settingsService.ts`

此 task 只新增檔案，不修改任何現有程式碼。

- [ ] **步驟 1：建立 `src/services/assetService.ts`**

```ts
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';

const KEYS = {
  assets: 'app-assets-v1',
  liabilities: 'app-liabilities-v1',
  snapshots: 'app-snapshots-v1',
} as const;

export function getAssets(): AssetCategory[] {
  const stored = localStorage.getItem(KEYS.assets);
  return stored ? JSON.parse(stored) : [];
}
export function saveAssets(data: AssetCategory[]): void {
  localStorage.setItem(KEYS.assets, JSON.stringify(data));
}

export function getLiabilities(): LiabilityItem[] {
  const stored = localStorage.getItem(KEYS.liabilities);
  return stored ? JSON.parse(stored) : [];
}
export function saveLiabilities(data: LiabilityItem[]): void {
  localStorage.setItem(KEYS.liabilities, JSON.stringify(data));
}

export function getSnapshots(): AssetSnapshot[] {
  const stored = localStorage.getItem(KEYS.snapshots);
  return stored ? JSON.parse(stored) : [];
}
export function saveSnapshots(data: AssetSnapshot[]): void {
  localStorage.setItem(KEYS.snapshots, JSON.stringify(data));
}
```

- [ ] **步驟 2：建立 `src/services/cashflowService.ts`**

```ts
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
```

- [ ] **步驟 3：建立 `src/services/loanService.ts`**

```ts
import type { LoanItem, StakingItem } from '../types';

const KEYS = {
  loans: 'app-loans-v5',
  stakingItems: 'app-staking-v5',
  borrowingLimits: 'app-borrowing-limits-v1',
} as const;

const DEFAULT_LOANS: LoanItem[] = [
  { id: 'loan1', name: '信貸A', bank: '樂天', principal: 800000, initialPrincipal: 800000, interestRate: 2.08, monthlyPayment: 10242, paymentDay: 11, remainingPeriods: 68, loanType: 'installment', originalPeriods: 84, nextPaymentDate: '2026-05-11' },
  { id: 'loan2', name: '信貸B', bank: '王道', principal: 550000, initialPrincipal: 550000, interestRate: 3.20, monthlyPayment: 7274, paymentDay: 15, remainingPeriods: 70, loanType: 'installment', originalPeriods: 70 },
];
const DEFAULT_STAKING: StakingItem[] = [
  { id: 's1', name: 'ETH 2.0 質押', protocol: 'Lido', amount: 15.5, value: 1550000, apy: 3.4, stakingType: 'borrow', borrowDate: '2024-01-15', repayDate: '2025-01-15' },
  { id: 's2', name: 'USDT 活存', protocol: 'Binance Earn', amount: 20000, value: 640000, apy: 6.5, stakingType: 'earn', borrowDate: '2024-02-01' },
  { id: 's3', name: '質押借款A', protocol: '元大', amount: 3734000, value: 3734000, apy: 2.58, stakingType: 'borrow' },
  { id: 's4', name: '質押借款B', protocol: '元大', amount: 126000, value: 126000, apy: 2.85, stakingType: 'borrow' },
];

export function getLoans(): LoanItem[] {
  const stored = localStorage.getItem(KEYS.loans);
  return stored ? JSON.parse(stored) : DEFAULT_LOANS;
}
export function saveLoans(data: LoanItem[]): void {
  localStorage.setItem(KEYS.loans, JSON.stringify(data));
}

export function getStakingItems(): StakingItem[] {
  const stored = localStorage.getItem(KEYS.stakingItems);
  return stored ? JSON.parse(stored) : DEFAULT_STAKING;
}
export function saveStakingItems(data: StakingItem[]): void {
  localStorage.setItem(KEYS.stakingItems, JSON.stringify(data));
}

export function getBorrowingLimits(): Record<string, number> {
  const stored = localStorage.getItem(KEYS.borrowingLimits);
  return stored ? JSON.parse(stored) : {};
}
export function saveBorrowingLimits(data: Record<string, number>): void {
  localStorage.setItem(KEYS.borrowingLimits, JSON.stringify(data));
}
```

- [ ] **步驟 4：建立 `src/services/settingsService.ts`**

```ts
import type { FireSettings, LifeEvent } from '../types';

const KEYS = {
  showValues:           'app-show-values',
  userName:             'app-user-name-v1',
  userEmail:            'app-user-email-v1',
  usdToTwd:             'app-usd-twd-v1',
  reportSchedule:       'app-report-schedule-v1',
  netWorthGoal:         'app-net-worth-goal-v1',
  fireSettings:         'app-fire-settings-v1',
  lifeEvents:           'app-life-events-v1',
  onboardingDone:       'assetdash-onboarding-done',
  enablePledgeTracking: 'app-enable-pledge-tracking-v1',
  pledgeAlertLastSent:  'app-pledge-alert-v1',
  lastExportDate:       'app-last-export-v1',
  lastReportSent:       'app-last-report-sent-v1',
} as const;

const DEFAULT_FIRE: FireSettings = {
  currentAge: 30, targetRetirementAge: 55,
  annualReturnRate: 6, inflationRate: 2, swr: 4, taxRate: 0,
};

function read<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key);
  return stored !== null ? JSON.parse(stored) : fallback;
}
function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const settingsService = {
  getShowValues:           () => read<boolean>(KEYS.showValues, true),
  saveShowValues:          (v: boolean) => write(KEYS.showValues, v),
  getUserName:             () => read<string>(KEYS.userName, ''),
  saveUserName:            (v: string) => write(KEYS.userName, v),
  getUserEmail:            () => read<string>(KEYS.userEmail, ''),
  saveUserEmail:           (v: string) => write(KEYS.userEmail, v),
  getUsdToTwd:             () => read<number>(KEYS.usdToTwd, 32),
  saveUsdToTwd:            (v: number) => write(KEYS.usdToTwd, v),
  getReportSchedule:       () => read<'none' | 'weekly' | 'monthly'>(KEYS.reportSchedule, 'none'),
  saveReportSchedule:      (v: 'none' | 'weekly' | 'monthly') => write(KEYS.reportSchedule, v),
  getNetWorthGoal:         () => read<number>(KEYS.netWorthGoal, 0),
  saveNetWorthGoal:        (v: number) => write(KEYS.netWorthGoal, v),
  getFireSettings:         () => read<FireSettings>(KEYS.fireSettings, DEFAULT_FIRE),
  saveFireSettings:        (v: FireSettings) => write(KEYS.fireSettings, v),
  getLifeEvents:           () => read<LifeEvent[]>(KEYS.lifeEvents, []),
  saveLifeEvents:          (v: LifeEvent[]) => write(KEYS.lifeEvents, v),
  getOnboardingDone:       () => read<boolean>(KEYS.onboardingDone, false),
  saveOnboardingDone:      (v: boolean) => write(KEYS.onboardingDone, v),
  getEnablePledgeTracking: () => read<boolean>(KEYS.enablePledgeTracking, false),
  saveEnablePledgeTracking:(v: boolean) => write(KEYS.enablePledgeTracking, v),
  getPledgeAlertLastSent:  () => read<Record<'warning'|'danger', string>>(KEYS.pledgeAlertLastSent, { warning: '', danger: '' }),
  savePledgeAlertLastSent: (v: Record<'warning'|'danger', string>) => write(KEYS.pledgeAlertLastSent, v),
  getLastExportDate:       () => read<string>(KEYS.lastExportDate, ''),
  saveLastExportDate:      (v: string) => write(KEYS.lastExportDate, v),
  getLastReportSent:       () => read<string>(KEYS.lastReportSent, ''),
  saveLastReportSent:      (v: string) => write(KEYS.lastReportSent, v),
};
```

- [ ] **步驟 5：TypeScript 檢查**

```bash
npx tsc --noEmit
```

預期：零錯誤。

- [ ] **步驟 6：Commit**

```bash
git add src/services/
git commit -m "feat(services): 建立 Service Layer（asset / cashflow / loan / settings）"
```

---

## Task 3：建立 SettingsContext

**Files:**
- Create: `src/context/SettingsContext.tsx`
- Modify: `src/context/AppContext.tsx`（將 settings 狀態委派給 SettingsContext）

- [ ] **步驟 1：建立 `src/context/SettingsContext.tsx`**

```tsx
"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type { FireSettings, LifeEvent } from '../types';

interface SettingsContextType {
  showValues: boolean;
  setShowValues: (v: boolean | ((p: boolean) => boolean)) => void;
  userName: string;
  setUserName: (v: string | ((p: string) => string)) => void;
  userEmail: string;
  setUserEmail: (v: string | ((p: string) => string)) => void;
  usdToTwd: number;
  setUsdToTwd: (v: number | ((p: number) => number)) => void;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  setReportSchedule: (v: 'none' | 'weekly' | 'monthly') => void;
  lastReportSent: string;
  setLastReportSent: (v: string) => void;
  netWorthGoal: number;
  setNetWorthGoal: (v: number | ((p: number) => number)) => void;
  fireSettings: FireSettings;
  setFireSettings: (v: FireSettings | ((p: FireSettings) => FireSettings)) => void;
  lifeEvents: LifeEvent[];
  setLifeEvents: (v: LifeEvent[] | ((p: LifeEvent[]) => LifeEvent[])) => void;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;
  enablePledgeTracking: boolean;
  setEnablePledgeTracking: (v: boolean) => void;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
  setPledgeAlertLastSent: (v: Record<'warning' | 'danger', string> | ((p: Record<'warning' | 'danger', string>) => Record<'warning' | 'danger', string>)) => void;
  lastExportDate: string;
  setLastExportDate: (v: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within a SettingsProvider');
  return ctx;
}

const DEFAULT_FIRE: FireSettings = {
  currentAge: 30, targetRetirementAge: 55,
  annualReturnRate: 6, inflationRate: 2, swr: 4, taxRate: 0,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [showValues, setShowValues] = useStickyState<boolean>(true, 'app-show-values');
  const [userName, setUserName] = useStickyState<string>('', 'app-user-name-v1');
  const [userEmail, setUserEmail] = useStickyState<string>('', 'app-user-email-v1');
  const [usdToTwd, setUsdToTwd] = useStickyState<number>(32, 'app-usd-twd-v1');
  const [reportSchedule, setReportSchedule] = useStickyState<'none' | 'weekly' | 'monthly'>('none', 'app-report-schedule-v1');
  const [lastReportSent, setLastReportSent] = useStickyState('', 'app-last-report-sent-v1');
  const [netWorthGoal, setNetWorthGoal] = useStickyState<number>(0, 'app-net-worth-goal-v1');
  const [fireSettings, setFireSettings] = useStickyState<FireSettings>(DEFAULT_FIRE, 'app-fire-settings-v1');
  const [lifeEvents, setLifeEvents] = useStickyState<LifeEvent[]>([], 'app-life-events-v1');
  const [onboardingDone, setOnboardingDone] = useStickyState<boolean>(false, 'assetdash-onboarding-done');
  const [enablePledgeTracking, setEnablePledgeTracking] = useStickyState<boolean>(false, 'app-enable-pledge-tracking-v1');
  const [pledgeAlertLastSent, setPledgeAlertLastSent] = useStickyState<Record<'warning' | 'danger', string>>(
    { warning: '', danger: '' }, 'app-pledge-alert-v1'
  );
  const [lastExportDate, setLastExportDate] = useStickyState<string>('', 'app-last-export-v1');

  return (
    <SettingsContext.Provider value={{
      showValues, setShowValues,
      userName, setUserName,
      userEmail, setUserEmail,
      usdToTwd, setUsdToTwd,
      reportSchedule, setReportSchedule,
      lastReportSent, setLastReportSent,
      netWorthGoal, setNetWorthGoal,
      fireSettings, setFireSettings,
      lifeEvents, setLifeEvents,
      onboardingDone, setOnboardingDone,
      enablePledgeTracking, setEnablePledgeTracking,
      pledgeAlertLastSent, setPledgeAlertLastSent,
      lastExportDate, setLastExportDate,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

- [ ] **步驟 2：修改 `AppContext.tsx` — 把所有 settings 狀態改為從 SettingsContext 取用**

在 `AppContext.tsx` 最上方 import 加入：
```ts
import { useSettingsContext, SettingsProvider } from './SettingsContext';
```

在 `AppProvider` function 裡，刪除以下所有 `useStickyState` 呼叫（已移到 SettingsContext）：
- `showValues` / `setShowValues`
- `userName` / `setUserName`
- `userEmail` / `setUserEmail`
- `usdToTwd` / `setUsdToTwd`
- `reportSchedule` / `setReportSchedule`
- `lastReportSent` / `setLastReportSent`
- `netWorthGoal` / `setNetWorthGoal`
- `fireSettings` / `setFireSettings`
- `lifeEvents` / `setLifeEvents`
- `onboardingDone` / `setOnboardingDone`
- `enablePledgeTracking` / `setEnablePledgeTracking`
- `pledgeAlertLastSent` / `setPledgeAlertLastSent`
- `lastExportDate` / `setLastExportDate`

在 `AppProvider` function body 頂部加入（取代上述刪除的 useStickyState）：
```ts
const {
  showValues, setShowValues, userName, setUserName, userEmail, setUserEmail,
  usdToTwd, setUsdToTwd, reportSchedule, setReportSchedule,
  lastReportSent, setLastReportSent, netWorthGoal, setNetWorthGoal,
  fireSettings, setFireSettings, lifeEvents, setLifeEvents,
  onboardingDone, setOnboardingDone, enablePledgeTracking, setEnablePledgeTracking,
  pledgeAlertLastSent, setPledgeAlertLastSent, lastExportDate, setLastExportDate,
} = useSettingsContext();
```

把 `AppProvider` 的 return 包上 `SettingsProvider`：
```tsx
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <AppProviderInner>{children}</AppProviderInner>
    </SettingsProvider>
  );
}

// 原本的 AppProvider function body 改名為 AppProviderInner
function AppProviderInner({ children }: { children: ReactNode }) {
  // ... 原本所有的邏輯（現在從 useSettingsContext 取 settings 值）
}
```

- [ ] **步驟 3：TypeScript 檢查**

```bash
npx tsc --noEmit
```

預期：零錯誤。

- [ ] **步驟 4：啟動 dev server 手動驗證**

```bash
npm run dev
```

開啟瀏覽器確認：設定頁面（userName/userEmail 欄位）、隱私模式切換、FIRE 設定頁，功能全部正常。

- [ ] **步驟 5：Commit**

```bash
git add src/context/SettingsContext.tsx src/context/AppContext.tsx
git commit -m "refactor(context): 提取 SettingsContext，AppContext 改委派"
```

---

## Task 4：建立 LoanContext

**Files:**
- Create: `src/context/LoanContext.tsx`
- Modify: `src/context/AppContext.tsx`

- [ ] **步驟 1：建立 `src/context/LoanContext.tsx`**

```tsx
"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type { LoanItem, StakingItem } from '../types';

interface LoanContextType {
  loans: LoanItem[];
  setLoans: (v: LoanItem[] | ((p: LoanItem[]) => LoanItem[])) => void;
  stakingItems: StakingItem[];
  setStakingItems: (v: StakingItem[] | ((p: StakingItem[]) => StakingItem[])) => void;
  borrowingLimits: Record<string, number>;
  setBorrowingLimits: (v: Record<string, number> | ((p: Record<string, number>) => Record<string, number>)) => void;
  recordLoanPayment: (id: string) => void;
  undoLoanPayment: (id: string) => void;
  totalLoanMonthlyPayments: number;
  stakingBorrowInterest: number;
  stakingEarnTotal: number;
  stakingEarnIncome: number;
  clearLoanData: () => void;
}

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export function useLoanContext() {
  const ctx = useContext(LoanContext);
  if (!ctx) throw new Error('useLoanContext must be used within a LoanProvider');
  return ctx;
}

const DEFAULT_LOANS: LoanItem[] = [
  { id: 'loan1', name: '信貸A', bank: '樂天', principal: 800000, initialPrincipal: 800000, interestRate: 2.08, monthlyPayment: 10242, paymentDay: 11, remainingPeriods: 68, loanType: 'installment', originalPeriods: 84, nextPaymentDate: '2026-05-11' },
  { id: 'loan2', name: '信貸B', bank: '王道', principal: 550000, initialPrincipal: 550000, interestRate: 3.20, monthlyPayment: 7274, paymentDay: 15, remainingPeriods: 70, loanType: 'installment', originalPeriods: 70 },
];
const DEFAULT_STAKING: StakingItem[] = [
  { id: 's1', name: 'ETH 2.0 質押', protocol: 'Lido', amount: 15.5, value: 1550000, apy: 3.4, stakingType: 'borrow', borrowDate: '2024-01-15', repayDate: '2025-01-15' },
  { id: 's2', name: 'USDT 活存', protocol: 'Binance Earn', amount: 20000, value: 640000, apy: 6.5, stakingType: 'earn', borrowDate: '2024-02-01' },
  { id: 's3', name: '質押借款A', protocol: '元大', amount: 3734000, value: 3734000, apy: 2.58, stakingType: 'borrow' },
  { id: 's4', name: '質押借款B', protocol: '元大', amount: 126000, value: 126000, apy: 2.85, stakingType: 'borrow' },
];

export function LoanProvider({ children }: { children: ReactNode }) {
  const [loans, setLoans] = useStickyState<LoanItem[]>(DEFAULT_LOANS, 'app-loans-v5');
  const [stakingItems, setStakingItems] = useStickyState<StakingItem[]>(DEFAULT_STAKING, 'app-staking-v5');
  const [borrowingLimits, setBorrowingLimits] = useStickyState<Record<string, number>>({}, 'app-borrowing-limits-v1');

  const borrowItems = useMemo(() => stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow'), [stakingItems]);
  const earnItems   = useMemo(() => stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn'),  [stakingItems]);

  const stakingBorrowInterest = useMemo(() => borrowItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [borrowItems]);
  const stakingEarnTotal      = useMemo(() => earnItems.reduce((s, i) => s + i.value, 0), [earnItems]);
  const stakingEarnIncome     = useMemo(() => earnItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [earnItems]);
  const totalLoanMonthlyPayments = useMemo(() => loans.reduce((s, l) => s + l.monthlyPayment, 0), [loans]);

  const recordLoanPayment = (id: string) => {
    setLoans(prev => prev.map(loan => {
      if (loan.id !== id || loan.loanType !== 'installment' || loan.remainingPeriods <= 0) return loan;
      let nextDate: string | undefined;
      if (loan.nextPaymentDate) {
        const d = new Date(loan.nextPaymentDate);
        d.setMonth(d.getMonth() + 1);
        nextDate = d.toISOString().split('T')[0];
      }
      const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
      const principalReduction = loan.monthlyPayment - interest;
      return { ...loan, principal: Math.max(0, Math.round(loan.principal - principalReduction)), remainingPeriods: loan.remainingPeriods - 1, nextPaymentDate: nextDate };
    }));
  };

  const undoLoanPayment = (id: string) => {
    setLoans(prev => prev.map(loan => {
      if (loan.id !== id || loan.loanType !== 'installment') return loan;
      let prevDate: string | undefined;
      if (loan.nextPaymentDate) {
        const d = new Date(loan.nextPaymentDate);
        d.setMonth(d.getMonth() - 1);
        prevDate = d.toISOString().split('T')[0];
      }
      const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
      const principalReduction = loan.monthlyPayment - interest;
      return { ...loan, principal: Math.round(loan.principal + principalReduction), remainingPeriods: loan.remainingPeriods + 1, nextPaymentDate: prevDate };
    }));
  };

  const clearLoanData = () => {
    setLoans([]);
    setStakingItems([]);
  };

  return (
    <LoanContext.Provider value={{
      loans, setLoans, stakingItems, setStakingItems,
      borrowingLimits, setBorrowingLimits,
      recordLoanPayment, undoLoanPayment,
      totalLoanMonthlyPayments, stakingBorrowInterest,
      stakingEarnTotal, stakingEarnIncome,
      clearLoanData,
    }}>
      {children}
    </LoanContext.Provider>
  );
}
```

- [ ] **步驟 2：修改 `AppContext.tsx` — 委派 loan 狀態給 LoanContext**

在 `AppContext.tsx` import 加入：
```ts
import { useLoanContext, LoanProvider } from './LoanContext';
```

在 `AppProviderInner` function body 刪除以下 useStickyState 和 useMemo（已移到 LoanContext）：
- `loans` / `setLoans`
- `stakingItems` / `setStakingItems`
- `borrowingLimits` / `setBorrowingLimits`
- `borrowItems` / `earnItems` useMemo
- `stakingBorrowInterest` / `stakingEarnTotal` / `stakingEarnIncome` useMemo
- `totalLoanMonthlyPayments` useMemo
- `recordLoanPayment` function
- `undoLoanPayment` function

在 `AppProviderInner` body 加入（取代上述）：
```ts
const {
  loans, setLoans, stakingItems, setStakingItems,
  borrowingLimits, setBorrowingLimits,
  recordLoanPayment, undoLoanPayment,
  totalLoanMonthlyPayments, stakingBorrowInterest,
  stakingEarnTotal, stakingEarnIncome,
  clearLoanData,
} = useLoanContext();
```

在 `AppProvider` return 中用 `LoanProvider` 包裝：
```tsx
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LoanProvider>
        <AppProviderInner>{children}</AppProviderInner>
      </LoanProvider>
    </SettingsProvider>
  );
}
```

在 `clearAllData` 中把 `setStakingItems([])` 和 `setLoans([])` 改為 `clearLoanData()`。

- [ ] **步驟 3：TypeScript 檢查 + 手動驗證**

```bash
npx tsc --noEmit
npm run dev
```

開啟負債管理頁，確認貸款列表、還款按鈕、質押項目顯示正常。

- [ ] **步驟 4：Commit**

```bash
git add src/context/LoanContext.tsx src/context/AppContext.tsx
git commit -m "refactor(context): 提取 LoanContext，AppContext 改委派"
```

---

## Task 5：建立 CashFlowContext

**Files:**
- Create: `src/context/CashFlowContext.tsx`
- Modify: `src/context/AppContext.tsx`

- [ ] **步驟 1：建立 `src/context/CashFlowContext.tsx`**

```tsx
"use client";

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useStickyState } from '../hooks/useStickyState';
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
  const [monthlyRecords, setMonthlyRecords] = useStickyState<Record<string, MonthRecord>>({}, 'app-monthly-records-v1');
  const [cashflowTemplate, setCashflowTemplate] = useStickyState<CashflowTemplate>(
    { income: DEFAULT_INCOME, expense: DEFAULT_EXPENSE }, 'app-cashflow-template-v1'
  );
  const [annualEntries, setAnnualEntries] = useStickyState<AnnualEntry[]>([], 'app-annual-v1');
  const [categoryBudgets, setCategoryBudgets] = useStickyState<Record<string, number>>({}, 'assetdash-category-budgets');
  const [customCategories, setCustomCategories] = useStickyState<string[]>(DEFAULT_CATEGORIES, 'app-custom-categories-v1');

  // 固定為當月 key，不隨 render 重算
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
```

- [ ] **步驟 2：修改 `AppContext.tsx` — 委派 cashflow 狀態給 CashFlowContext**

在 import 加入：
```ts
import { useCashFlowContext, CashFlowProvider } from './CashFlowContext';
```

刪除 `AppProviderInner` 中以下 useStickyState 和 useEffect（已移到 CashFlowContext）：
- `monthlyRecords` / `setMonthlyRecords`
- `cashflowTemplate` / `setCashflowTemplate`
- `annualEntries` / `setAnnualEntries`
- `categoryBudgets` / `setCategoryBudgets`
- `customCategories` / `setCustomCategories`
- migration useEffect（`app-cashflow-migrated-v1`）

加入取代：
```ts
const {
  monthlyRecords, setMonthlyRecords, cashflowTemplate, setCashflowTemplate,
  annualEntries, setAnnualEntries, categoryBudgets, setCategoryBudgets,
  customCategories, setCustomCategories, currentMonthKey, clearCashFlowData,
} = useCashFlowContext();
```

`currentMonthKey` 的 `useMemo` 包裝也從 AppContext 移除（已在 CashFlowContext 裡）。

更新 `AppProvider` 包裝：
```tsx
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LoanProvider>
        <CashFlowProvider>
          <AppProviderInner>{children}</AppProviderInner>
        </CashFlowProvider>
      </LoanProvider>
    </SettingsProvider>
  );
}
```

在 `clearAllData` 中，把 cashflow 相關的清除改為 `clearCashFlowData()`。

- [ ] **步驟 3：TypeScript 檢查 + 手動驗證**

```bash
npx tsc --noEmit
npm run dev
```

開啟收支管理頁，確認本月收支、月份切換、類別分析正常。

- [ ] **步驟 4：Commit**

```bash
git add src/context/CashFlowContext.tsx src/context/AppContext.tsx
git commit -m "refactor(context): 提取 CashFlowContext，currentMonthKey 加入 useMemo"
```

---

## Task 6：建立 AssetContext

**Files:**
- Create: `src/context/AssetContext.tsx`
- Create: `src/lib/snapshotUtils.ts`
- Modify: `src/context/AppContext.tsx`

- [ ] **步驟 1：建立 `src/lib/snapshotUtils.ts`**（提取重複的快照建構邏輯）

```ts
import type { AssetSnapshot, AssetCategory } from '../types';
import type { LiabilityItem } from '../types';
import { calculateHealthScore } from './healthScore';

interface BuildSnapshotParams {
  assets: AssetCategory[];
  combinedAssets: AssetCategory[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  snapshots: AssetSnapshot[];
}

export function buildSnapshot(params: BuildSnapshotParams): AssetSnapshot {
  const { assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots } = params;

  const today = new Date().toISOString().split('T')[0];
  const liquidAmt = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAmt = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const fixedAmt = assets.find(c => c.id === 'fixed')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const receivableAmt = assets.find(c => c.id === 'receivable')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const healthResult = calculateHealthScore({
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalAssets, totalLiabilities, liquidAssets: liquidAmt,
    investmentAssets: investmentAmt, snapshots,
  });

  return {
    id: `snap-${Date.now()}`,
    date: today,
    totalAssets,
    totalLiabilities,
    netWorth,
    healthScore: healthResult.totalScore,
    liquid: liquidAmt,
    investment: investmentAmt,
    fixed: fixedAmt,
    receivable: receivableAmt,
  };
}
```

- [ ] **步驟 2：建立 `src/context/AssetContext.tsx`**

```tsx
"use client";

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import { buildSnapshot } from '../lib/snapshotUtils';
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';

const initialAssets: AssetCategory[] = [
  { id: 'liquid', title: '流動資金', description: '現金、存款與數位支付', colorClass: 'bg-emerald-400', bgClass: 'bg-emerald-50', updatedAt: '剛剛', items: [{ id: 'l1', name: '銀行活存', amount: 300000 }, { id: 'l2', name: '支付寶', amount: 150000 }, { id: 'l3', name: 'Paypal', amount: 124000 }] },
  { id: 'investment', title: '投資', description: '股票、加密貨幣、基金', colorClass: 'bg-indigo-500', bgClass: 'bg-indigo-50', updatedAt: '剛剛', items: [{ id: 'i1', name: '加密貨幣', amount: 150000 }, { id: 'i2', name: '台股基金', amount: 100000 }, { id: 'i3', name: '海外股票', amount: 88200 }] },
  { id: 'fixed', title: '固定資產', description: '房地產與車輛', colorClass: 'bg-blue-500', bgClass: 'bg-blue-50', updatedAt: '剛剛', items: [{ id: 'f1', name: '自用住宅', amount: 1200000 }, { id: 'f2', name: 'Honda Civic', amount: 320000 }] },
  { id: 'receivable', title: '應收款', description: '借款等應收帳款', colorClass: 'bg-sky-400', bgClass: 'bg-sky-50', updatedAt: '剛剛', items: [{ id: 'r1', name: '朋友借款', amount: 120000 }] },
];
const initialLiabilities: LiabilityItem[] = [
  { id: 'li1', name: '房貸', description: '剩餘本金', amount: 1000000, updatedAt: '剛剛', icon: 'building' },
  { id: 'li2', name: '信用卡款', description: '本月未出帳', amount: 80000, updatedAt: '剛剛', icon: 'creditCard' },
];

interface AssetContextType {
  assets: AssetCategory[];
  setAssets: (v: AssetCategory[] | ((p: AssetCategory[]) => AssetCategory[])) => void;
  liabilities: LiabilityItem[];
  setLiabilities: (v: LiabilityItem[] | ((p: LiabilityItem[]) => LiabilityItem[])) => void;
  snapshots: AssetSnapshot[];
  setSnapshots: (v: AssetSnapshot[] | ((p: AssetSnapshot[]) => AssetSnapshot[])) => void;
  combinedAssets: AssetCategory[];
  combinedLiabilities: LiabilityItem[];
  totalAssets: number;
  totalLiabilities: number;
  takeSnapshot: (params: { totalMonthlyIncome: number; totalMonthlyExpense: number; monthlyNetCashFlow: number }) => void;
  clearAssetData: () => void;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function useAssetContext() {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error('useAssetContext must be used within an AssetProvider');
  return ctx;
}

interface AssetProviderProps {
  children: ReactNode;
  stakingEarnTotal: number;
  totalStockValueTWD: number;
  borrowItems: { id: string; name: string; protocol: string; value: number; apy: number }[];
  loans: { id: string; name: string; bank: string; principal: number; interestRate: number; remainingPeriods: number; loanType: string; monthlyPayment: number }[];
}

export function AssetProvider({ children, stakingEarnTotal, totalStockValueTWD, borrowItems, loans }: AssetProviderProps) {
  const [assets, setAssets] = useStickyState<AssetCategory[]>(initialAssets, 'app-assets-v1');
  const [liabilities, setLiabilities] = useStickyState<LiabilityItem[]>(initialLiabilities, 'app-liabilities-v1');
  const [snapshots, setSnapshots] = useStickyState<AssetSnapshot[]>([], 'app-snapshots-v1');

  const combinedAssets = useMemo(() => {
    return assets.map(cat => {
      if (cat.id !== 'investment') return cat;
      const extra: { id: string; name: string; amount: number }[] = [];
      if (totalStockValueTWD > 0) extra.push({ id: 'auto-stocks', name: '自動化股票投資', amount: Math.round(totalStockValueTWD) });
      if (stakingEarnTotal > 0)   extra.push({ id: 'auto-earn', name: '活存/Earn 收益資產', amount: stakingEarnTotal });
      if (extra.length === 0) return cat;
      return { ...cat, items: [...cat.items, ...extra] };
    });
  }, [assets, totalStockValueTWD, stakingEarnTotal]);

  const combinedLiabilities = useMemo<LiabilityItem[]>(() => {
    const list = [...liabilities];
    for (const item of borrowItems) {
      list.push({ id: `auto-staking-${item.id}`, name: item.name, description: `${item.protocol} · 質押借款 · ${item.apy}% 年利率`, amount: item.value, updatedAt: '自動同步', icon: 'building' as const });
    }
    for (const loan of loans) {
      if (loan.principal > 0) {
        list.push({ id: `auto-loan-${loan.id}`, name: `${loan.name}（${loan.bank}）`, description: loan.loanType === 'installment' ? `分期還款 · ${loan.interestRate}% · 剩餘${loan.remainingPeriods}期` : `循環借款 · ${loan.interestRate}% 年利率`, amount: loan.principal, updatedAt: '自動同步', icon: 'creditCard' as const });
      }
    }
    return list;
  }, [liabilities, borrowItems, loans]);

  const totalAssets = useMemo(() =>
    combinedAssets.reduce((s, cat) => s + cat.items.reduce((is, i) => is + i.amount, 0), 0),
  [combinedAssets]);

  const totalLiabilities = useMemo(() =>
    combinedLiabilities.reduce((s, i) => s + i.amount, 0),
  [combinedLiabilities]);

  const takeSnapshot = ({ totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow }: { totalMonthlyIncome: number; totalMonthlyExpense: number; monthlyNetCashFlow: number }) => {
    if (totalAssets === 0 && (totalAssets - totalLiabilities) === 0) return;
    const snap = buildSnapshot({ assets, combinedAssets, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots });
    setSnapshots(prev => {
      const withoutToday = prev.filter(s => s.date !== snap.date);
      return [...withoutToday.slice(-364), snap];
    });
  };

  const clearAssetData = () => {
    setAssets([]);
    setLiabilities([]);
    setSnapshots([]);
  };

  return (
    <AssetContext.Provider value={{
      assets, setAssets, liabilities, setLiabilities, snapshots, setSnapshots,
      combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
      takeSnapshot, clearAssetData,
    }}>
      {children}
    </AssetContext.Provider>
  );
}
```

- [ ] **步驟 3：修改 `AppContext.tsx` — 將 AssetProvider 整合進來**

`AssetProvider` 需要從 LoanContext 和 StockContext 傳入 props（`stakingEarnTotal`、`totalStockValueTWD`、`borrowItems`、`loans`），所以在 `AppProviderInner` 裡建立 `AssetProvider`：

```tsx
import { useAssetContext, AssetProvider } from './AssetContext';

// AppProviderInner 負責傳 props 給 AssetProvider
function AppProviderInner({ children }: { children: ReactNode }) {
  const { stakingItems, loans, stakingEarnTotal, totalLoanMonthlyPayments,
    stakingBorrowInterest, stakingEarnIncome, borrowingLimits, setBorrowingLimits,
    recordLoanPayment, undoLoanPayment, clearLoanData, setStakingItems, setLoans } = useLoanContext();
  const { stockItems, setStockItems, dividendRecords, setDividendRecords,
    stockQuotes, lastUpdated, quoteError, refreshQuotes, clearStockData } = useStockContext();
  // ... settings, cashflow

  const borrowItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const totalStockValueTWD = useMemo(() => {
    return stockItems.reduce((total, item) => {
      const quote = stockQuotes[item.symbol];
      if (!quote) return total;
      const value = quote.price * item.shares;
      return total + (quote.currency === 'USD' ? value * usdToTwd : value);
    }, 0);
  }, [stockItems, stockQuotes, usdToTwd]);

  return (
    <AssetProvider
      stakingEarnTotal={stakingEarnTotal}
      totalStockValueTWD={totalStockValueTWD}
      borrowItems={borrowItems}
      loans={loans}
    >
      <AppContextBridge>{children}</AppContextBridge>
    </AssetProvider>
  );
}
```

`AppContextBridge` 是一個新的內部 component，呼叫 `useAssetContext()` 並組合所有子 Context 的值，提供最終的 `AppContext.Provider`（維持向後相容介面）。

刪除 `AppProviderInner` 中已移到 AssetContext 的：
- `assets` / `setAssets` / `liabilities` / `setLiabilities` / `snapshots` / `setSnapshots`
- `combinedAssets` / `combinedLiabilities` useMemo
- `totalAssets` / `totalLiabilities` useMemo
- `takeSnapshot` function
- auto-snapshot useEffect

把 `clearAllData` 中對應的清除改為呼叫 `clearAssetData()`。

更新 `AppProvider` provider 堆疊：
```tsx
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LoanProvider>
        <CashFlowProvider>
          <AppProviderInner>{children}</AppProviderInner>
        </CashFlowProvider>
      </LoanProvider>
    </SettingsProvider>
  );
}
```

- [ ] **步驟 4：在 `AppContext.tsx` 中建立 auto-snapshot useEffect（位移後）**

auto-snapshot 邏輯在 AssetContext 的 `takeSnapshot` 裡已有基礎，但自動觸發（監看 `lastUpdated`）仍需保留。在 `AppContextBridge` 裡：

```ts
const { totalAssets, totalLiabilities, combinedAssets, assets, snapshots, setSnapshots } = useAssetContext();
const netWorth = totalAssets - totalLiabilities;

useEffect(() => {
  if (stockItems.length > 0 && !lastUpdated) return;
  const today = new Date().toISOString().split('T')[0];
  setSnapshots(prev => {
    const last = prev[prev.length - 1];
    if (last?.date === today) return prev;
    if (totalAssets === 0 && netWorth === 0) return prev;
    const snap = buildSnapshot({ assets, combinedAssets, totalAssets, totalLiabilities, netWorth, totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots: prev });
    return [...prev.slice(-364), snap];
  });
}, [lastUpdated, totalAssets, totalLiabilities, netWorth]); // eslint-disable-line
```

- [ ] **步驟 5：TypeScript 檢查 + 手動驗證**

```bash
npx tsc --noEmit
npm run dev
```

確認總覽頁（Dashboard）資產卡片、負債、淨資產圖表、快照都正常。

- [ ] **步驟 6：Commit**

```bash
git add src/context/AssetContext.tsx src/lib/snapshotUtils.ts src/context/AppContext.tsx
git commit -m "refactor(context): 提取 AssetContext + snapshotUtils，消除 takeSnapshot 重複邏輯"
```

---

## Task 7：清理 AppContext 成薄薄的 orchestrator

此時 `AppContext.tsx` 應已大幅縮減。確認它只做以下事情：

1. 組合所有子 Context 的值，暴露統一的 `useAppContext()` 介面（向後相容）
2. 計算跨 domain 的衍生值：`netWorth`、`momDelta`、`totalCollateralValueTWD`
3. 提供 `clearAllData`（呼叫各子 Context 的 clear 函式）
4. 匯出 `AppProvider`（包含所有子 Provider 的巢狀結構）

- [ ] **步驟 1：確認 AppContext.tsx 最終結構**

AppContext.tsx 應只剩：
- import 所有子 context hook
- `AppContextType` interface（與之前相同，向後相容）
- `AppContext` createContext
- `useAppContext` hook
- `AppContextBridge` 組合所有子 context 值 + 計算跨 domain 衍生值 + 提供 `AppContext.Provider`
- `AppProviderInner`（設定 props 並 render `AssetProvider` + `AppContextBridge`）
- `AppProvider`（最外層 Provider 巢狀）
- re-export types from types.ts

目標行數：約 150-200 行（從 707 行縮減）

- [ ] **步驟 2：TypeScript 檢查**

```bash
npx tsc --noEmit
```

預期：零錯誤。

- [ ] **步驟 3：執行完整測試**

```bash
npm run test
```

預期：所有測試通過。

- [ ] **步驟 4：手動驗證所有頁面**

啟動 dev server，逐一確認：
- `/` 總覽：KPI、資產卡片、負債、圖表、快照
- `/cashflow`：收支記錄、月份切換、類別分析
- `/debt`：貸款、質押、還款按鈕
- `/stocks`：股票列表、報價
- `/health`：健康評分
- `/fire`：FIRE 計算機
- `/settings`：個人資訊儲存

- [ ] **步驟 5：Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "refactor(context): AppContext 縮減為薄薄的 orchestrator，組合所有子 Context"
```

---

## Task 8：Cashflow 組件提取

**Files:**
- Create: `src/components/cashflow/MonthNavigator.tsx`
- Create: `src/components/cashflow/MonthlySummaryCard.tsx`
- Create: `src/components/cashflow/CashFlowRow.tsx`
- Create: `src/components/cashflow/AddFixedItemRow.tsx`
- Create: `src/components/cashflow/OneTimeEntryRow.tsx`
- Create: `src/components/cashflow/AddOneTimeEntryRow.tsx`
- Create: `src/components/cashflow/AutoItemRows.tsx`
- Create: `src/components/cashflow/CategoryManager.tsx`
- Create: `src/components/cashflow/CategoryAnalysisTab.tsx`
- Create: `src/components/cashflow/MonthTrendChart.tsx`
- Modify: `src/app/cashflow/page.tsx`

- [ ] **步驟 1：建立 `src/components/cashflow/MonthNavigator.tsx`**

從 `cashflow/page.tsx` 中剪出 `MonthNavigator` function（第 45-64 行），貼入新檔：

```tsx
"use client";
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthNavigator({ year, month, onPrev, onNext }: Props) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm shrink-0">
      <button onClick={onPrev} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>
      <div className="text-center min-w-[88px]">
        <p className="font-bold text-gray-900 text-sm leading-tight"><span className="hidden md:inline">{year} 年 </span>{month} 月</p>
        {isCurrent && <p className="text-[10px] text-indigo-500 leading-tight">本月</p>}
      </div>
      <button onClick={onNext} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}
```

- [ ] **步驟 2：建立 `src/components/cashflow/MonthlySummaryCard.tsx`**

把 cashflow page 的 Monthly Summary Card IIFE 提取出來：

```tsx
"use client";

interface Props {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  showValues: boolean;
}

export function MonthlySummaryCard({ totalIncome, totalExpense, netAmount, showValues }: Props) {
  const savingsRate = totalIncome > 0 ? Math.round((netAmount / totalIncome) * 100) : 0;
  return (
    <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">收入</p>
            <p className="text-lg font-bold text-green-700">
              {showValues ? `+NT$${totalIncome.toLocaleString()}` : '●●●●'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">支出</p>
            <p className="text-lg font-bold text-red-600">
              {showValues ? `-NT$${totalExpense.toLocaleString()}` : '●●●●'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">結餘</p>
            <p className={`text-lg font-bold ${netAmount >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
              {showValues ? `${netAmount >= 0 ? '+' : ''}NT$${netAmount.toLocaleString()}` : '●●●●'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">儲蓄率</p>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${savingsRate >= 30 ? 'bg-green-500' : savingsRate >= 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${savingsRate >= 30 ? 'text-green-700' : savingsRate >= 15 ? 'text-yellow-700' : 'text-red-700'}`}>
              {savingsRate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步驟 3：建立 `src/components/cashflow/AutoItemRows.tsx`**

合併原本的 `AutoStakingIncomeRow`、`AutoStakingExpenseRow`、`AutoLoanExpenseRow` 成單一組件：

```tsx
"use client";
import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { LoanItem } from '../../types';

export function AutoStakingIncomeRow() {
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

export function AutoStakingExpenseRow() {
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

export function AutoLoanExpenseRows() {
  const { loans, showValues } = useAppContext();
  const active = loans.filter((l: LoanItem) => l.principal > 0);
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
```

- [ ] **步驟 4：把 `CashFlowRow`、`AddFixedItemRow`、`OneTimeEntryRow`、`AddOneTimeEntryRow` 從 `cashflow/page.tsx` 剪貼到各自的新檔案**

每個檔案加上 `"use client";` 和必要的 import。從 `cashflow/page.tsx` 中把對應的 function 移除，改為從 `../../components/cashflow/` import。

- `src/components/cashflow/CashFlowRow.tsx` ← 剪貼第 167-280 行
- `src/components/cashflow/AddFixedItemRow.tsx` ← 剪貼第 282-336 行
- `src/components/cashflow/OneTimeEntryRow.tsx` ← 剪貼第 68-107 行
- `src/components/cashflow/AddOneTimeEntryRow.tsx` ← 剪貼第 110-163 行

每個檔案 import 所需的型別從 `../../types` 或 `../../context/AppContext`。

- [ ] **步驟 5：把 `CategoryManager`、`CategoryAnalysisTab`、`MonthTrendChart` 提取到各自新檔案**

- `src/components/cashflow/CategoryManager.tsx` ← 剪貼第 399-498 行
- `src/components/cashflow/CategoryAnalysisTab.tsx` ← 剪貼第 500-637 行
- `src/components/cashflow/MonthTrendChart.tsx` ← 提取 trend chart JSX（第 1142-1174 行）成獨立組件

`MonthTrendChart` 的 props interface：
```ts
interface Props {
  data: { label: string; income: number; expense: number; net: number }[];
  showValues: boolean;
  formatCurrency: (v: number) => string;
}
```

- [ ] **步驟 6：更新 `src/app/cashflow/page.tsx`**

移除所有已提取的 function 定義，在頂部改為 import：
```ts
import { MonthNavigator } from '../../components/cashflow/MonthNavigator';
import { MonthlySummaryCard } from '../../components/cashflow/MonthlySummaryCard';
import { CashFlowRow } from '../../components/cashflow/CashFlowRow';
import { AddFixedItemRow } from '../../components/cashflow/AddFixedItemRow';
import { OneTimeEntryRow } from '../../components/cashflow/OneTimeEntryRow';
import { AddOneTimeEntryRow } from '../../components/cashflow/AddOneTimeEntryRow';
import { AutoStakingIncomeRow, AutoStakingExpenseRow, AutoLoanExpenseRows } from '../../components/cashflow/AutoItemRows';
import { CategoryManager } from '../../components/cashflow/CategoryManager';
import { CategoryAnalysisTab } from '../../components/cashflow/CategoryAnalysisTab';
import { MonthTrendChart } from '../../components/cashflow/MonthTrendChart';
```

把 JSX 中 `{(() => { ... })()}` 月摘要卡改為：
```tsx
<MonthlySummaryCard
  totalIncome={monthTotalIncome}
  totalExpense={monthTotalExpense}
  netAmount={monthNet}
  showValues={showValues}
/>
```

- [ ] **步驟 7：TypeScript 檢查 + 手動驗證**

```bash
npx tsc --noEmit
npm run dev
```

完整測試收支頁所有功能：月份切換、新增/編輯/刪除項目、類別分析、年度總覽。

- [ ] **步驟 8：Commit**

```bash
git add src/components/cashflow/ src/app/cashflow/page.tsx
git commit -m "refactor(cashflow): 提取 10 個子組件至 components/cashflow/，消除 IIFE 模式"
```

---

## Task 9：UI 修正

**Files:**
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **步驟 1：在 `BottomTabBar.tsx` 補上 `/debt` tab**

```tsx
// 原本
const tabs = [
  { href: '/', icon: LayoutDashboard, label: '總覽' },
  { href: '/cashflow', icon: Wallet, label: '現金流' },
  { href: '/fire', icon: Flame, label: 'FIRE' },
  { href: '/stocks', icon: TrendingUp, label: '股票' },
  { href: '/health', icon: Heart, label: '健康' },
]

// 改成（新增 debt，共 6 個 tabs）
import { LayoutDashboard, Wallet, Flame, TrendingUp, Heart, Coins } from 'lucide-react'

const tabs = [
  { href: '/', icon: LayoutDashboard, label: '總覽' },
  { href: '/cashflow', icon: Wallet, label: '現金流' },
  { href: '/debt', icon: Coins, label: '負債' },
  { href: '/fire', icon: Flame, label: 'FIRE' },
  { href: '/stocks', icon: TrendingUp, label: '股票' },
  { href: '/health', icon: Heart, label: '健康' },
]
```

- [ ] **步驟 2：合併 `Navbar.tsx` 的 3 個 active class helpers**

```tsx
// 刪除
const getNavClass = (path: string) => { ... }
const getIconNavClass = (path: string) => { ... }
const getMobileNavClass = (path: string) => { ... }

// 改成單一函式
const navClass = (path: string, variant: 'desktop' | 'icon' | 'mobile') => {
  const isActive = pathname === path;
  if (variant === 'desktop') {
    return `flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`;
  }
  if (variant === 'icon') {
    return `flex items-center justify-center p-2 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`;
  }
  return `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`;
};
```

把 JSX 中的 `getNavClass(href)` → `navClass(href, 'desktop')`，
`getIconNavClass(href)` → `navClass(href, 'icon')`，
`getMobileNavClass(href)` → `navClass(href, 'mobile')`。

- [ ] **步驟 3：修改 `src/app/page.tsx` — 快照刪除改用 ConfirmDialog**

在 `DashboardPage` 加入 state：
```tsx
const [snapshotToDelete, setSnapshotToDelete] = useState<string | null>(null);
```

把快照列表中的刪除按鈕從：
```tsx
onClick={() => {
  if (confirm(`確定刪除 ${snap.date} 的快照？`)) {
    setSnapshots(prev => prev.filter(s => s.id !== snap.id));
  }
}}
```
改成：
```tsx
onClick={() => setSnapshotToDelete(snap.id)}
```

在頁面底部加入 ConfirmDialog：
```tsx
import { ConfirmDialog } from '../components/ConfirmDialog';

// JSX 底部
{snapshotToDelete && (
  <ConfirmDialog
    message={`確定刪除 ${snapshots.find(s => s.id === snapshotToDelete)?.date} 的快照？`}
    onConfirm={() => {
      setSnapshots(prev => prev.filter(s => s.id !== snapshotToDelete));
      setSnapshotToDelete(null);
    }}
    onCancel={() => setSnapshotToDelete(null)}
  />
)}
```

- [ ] **步驟 4：TypeScript 檢查 + 最終手動驗證**

```bash
npx tsc --noEmit
npm run test
npm run dev
```

確認：
- 手機版 BottomTabBar 有 6 個 tabs 且 `/debt` 可正常跳頁
- Navbar 樣式行為不變
- 快照刪除使用 ConfirmDialog 風格一致的對話框

- [ ] **步驟 5：最終 Commit**

```bash
git add src/components/BottomTabBar.tsx src/components/Navbar.tsx src/app/page.tsx
git commit -m "fix(ui): 補上 BottomTabBar /debt tab、合併 Navbar active helper、快照刪除改用 ConfirmDialog"
```

---

## 完成確認清單

重構完成後，確認以下所有條件成立：

- [ ] `npx tsc --noEmit` 零錯誤
- [ ] `npm run test` 所有測試通過
- [ ] AppContext.tsx 從 707 行縮減至 ≤ 200 行
- [ ] `src/context/` 有 5 個各自負責的 Context 檔案
- [ ] `src/services/` 有 4 個 service 模組（localStorage 實作）
- [ ] `cashflow/page.tsx` 從 1195 行縮減至 ≤ 200 行
- [ ] `src/components/cashflow/` 有 10 個子組件
- [ ] `src/lib/snapshotUtils.ts` 存在且被 AssetContext 使用
- [ ] BottomTabBar 有 `/debt` tab
- [ ] 快照刪除使用 ConfirmDialog
- [ ] 所有 7 個頁面功能正常（手動驗證）

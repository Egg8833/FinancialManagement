"use client";

import { createContext, useContext, ReactNode, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSyncedState } from '../hooks/useSyncedState';
import type {
  AssetCategory, AssetItem, LiabilityItem, LifeEvent, FireSettings,
  StakingItem, LoanItem,
  AssetSnapshot, FinancialGoal, StockItem,
  StockQuote, DividendRecord,
  AnnualEntry, MonthRecord, CashflowTemplate,
} from '../types';
import { useStockContext } from './StockContext';
import { useSettingsContext, SettingsProvider } from './SettingsContext';
import { useLoanContext, LoanProvider } from './LoanContext';
import { useCashFlowContext, CashFlowProvider } from './CashFlowContext';
import { useAssetContext, AssetProvider } from './AssetContext';
import { useRepositories } from './RepositoryContext';
import { useAppStateContext } from './AppStateContext';
import { buildSnapshot } from '../lib/snapshotUtils';

const STORAGE_SCHEMA_VERSION = 1;

interface AppContextType {
  showValues: boolean;
  setShowValues: (val: boolean) => void;
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  assetsLoading: boolean;
  addCategory(input: { title: string; description: string; colorClass: string; bgClass: string }): void;
  updateCategory(id: string, patch: Partial<Omit<AssetCategory, 'id'>>): void;
  removeCategory(id: string): void;
  addAssetItem(categoryId: string, name: string, amount: number): void;
  updateAssetItem(categoryId: string, itemId: string, patch: Partial<Omit<AssetItem, 'id'>>): void;
  removeAssetItem(categoryId: string, itemId: string): void;
  addLiability(input: { name: string; amount: number; description?: string; icon?: 'building' | 'creditCard' }): void;
  updateLiability(id: string, patch: Partial<Omit<LiabilityItem, 'id'>>): void;
  removeLiability(id: string): void;
  replaceAssets(data: AssetCategory[]): Promise<void>;
  replaceLiabilities(data: LiabilityItem[]): Promise<void>;
  replaceSnapshots(data: AssetSnapshot[]): Promise<void>;
  stakingItems: StakingItem[];
  setStakingItems: (items: StakingItem[] | ((prev: StakingItem[]) => StakingItem[])) => void;
  stockItems: StockItem[];
  setStockItems: (items: StockItem[] | ((prev: StockItem[]) => StockItem[])) => void;
  dividendRecords: DividendRecord[];
  setDividendRecords: (records: DividendRecord[] | ((prev: DividendRecord[]) => DividendRecord[])) => void;
  stockQuotes: Record<string, StockQuote>;
  refreshQuotes: () => Promise<void>;
  lastUpdated: string;
  quoteError: boolean;
  monthlyRecords: Record<string, MonthRecord>;
  setMonthlyRecords: (v: Record<string, MonthRecord> | ((prev: Record<string, MonthRecord>) => Record<string, MonthRecord>)) => void;
  cashflowTemplate: CashflowTemplate;
  setCashflowTemplate: (v: CashflowTemplate | ((prev: CashflowTemplate) => CashflowTemplate)) => void;
  annualEntries: AnnualEntry[];
  setAnnualEntries: (entries: AnnualEntry[] | ((prev: AnnualEntry[]) => AnnualEntry[])) => void;
  borrowingLimits: Record<string, number>;
  setBorrowingLimits: (limits: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  snapshots: AssetSnapshot[];
  saveSnapshot(snap: AssetSnapshot): void;
  removeSnapshot(id: string): void;
  loans: LoanItem[];
  setLoans: (items: LoanItem[] | ((prev: LoanItem[]) => LoanItem[])) => void;
  recordLoanPayment: (id: string) => void;
  undoLoanPayment: (id: string) => void;
  totalAssets: number;
  totalLiabilities: number;
  combinedLiabilities: LiabilityItem[];
  combinedAssets: AssetCategory[];
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  netWorth: number;
  momDelta: number | null;
  clearAllData: () => void;
  takeSnapshot: () => void;
  // 備份提醒
  lastExportDate: string;
  setLastExportDate: (date: string) => void;
  // 淨資產目標
  netWorthGoal: number;
  setNetWorthGoal: (goal: number | ((prev: number) => number)) => void;
  // 質押擔保品市值
  totalCollateralValueTWD: number;
  usdToTwd: number;
  setUsdToTwd: (v: number | ((prev: number) => number)) => void;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
  setPledgeAlertLastSent: (v: Record<'warning' | 'danger', string> | ((prev: Record<'warning' | 'danger', string>) => Record<'warning' | 'danger', string>)) => void;
  // 個人資訊
  userName: string;
  setUserName: (name: string | ((prev: string) => string)) => void;
  userEmail: string;
  setUserEmail: (email: string | ((prev: string) => string)) => void;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  setReportSchedule: (s: 'none' | 'weekly' | 'monthly') => void;
  lastReportSent: string;
  setLastReportSent: (d: string) => void;
  // 財務目標
  goals: FinancialGoal[];
  setGoals: (g: FinancialGoal[] | ((prev: FinancialGoal[]) => FinancialGoal[])) => void;
  // 自訂類別
  customCategories: string[];
  setCustomCategories: (cats: string[] | ((prev: string[]) => string[])) => void;
  // 類別月預算
  categoryBudgets: Record<string, number>;
  setCategoryBudgets: (v: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  // FIRE 相關
  fireSettings: FireSettings;
  setFireSettings: (s: FireSettings | ((prev: FireSettings) => FireSettings)) => void;
  lifeEvents: LifeEvent[];
  setLifeEvents: (e: LifeEvent[] | ((prev: LifeEvent[]) => LifeEvent[])) => void;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;
  enablePledgeTracking: boolean;
  setEnablePledgeTracking: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// ─── AppContextBridge ────────────────────────────────────────────────────────
// Lives inside AssetProvider so it can call useAssetContext()

interface AppContextBridgeProps {
  children: ReactNode;
  settingsCtx: ReturnType<typeof useSettingsContext>;
  loanCtx: ReturnType<typeof useLoanContext>;
  cashflowCtx: ReturnType<typeof useCashFlowContext>;
  stockItems: StockItem[];
  setStockItems: (v: StockItem[] | ((p: StockItem[]) => StockItem[])) => void;
  dividendRecords: DividendRecord[];
  setDividendRecords: (v: DividendRecord[] | ((p: DividendRecord[]) => DividendRecord[])) => void;
  stockQuotes: Record<string, StockQuote>;
  lastUpdated: string;
  quoteError: boolean;
  refreshQuotes: () => Promise<void>;
  clearStockData: () => void;
}

function AppContextBridge({
  children,
  settingsCtx, loanCtx, cashflowCtx,
  stockItems, setStockItems, dividendRecords, setDividendRecords,
  stockQuotes, lastUpdated, quoteError, refreshQuotes, clearStockData,
}: AppContextBridgeProps) {
  const {
    assets, liabilities, snapshots, assetsLoading: assetsDomainLoading,
    combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
    addCategory, updateCategory, removeCategory,
    addAssetItem, updateAssetItem, removeAssetItem,
    addLiability, updateLiability, removeLiability,
    saveSnapshot, removeSnapshot,
    replaceAssets, replaceLiabilities, replaceSnapshots,
    clearAssetData,
  } = useAssetContext();
  const { sessionStatus } = useRepositories();
  const appState = useAppStateContext();
  // 統一雲端載入旗標：資產網域（assetsDomainLoading）與其餘 19 個網域共用的
  // app_state 批次拉取（appState.ready）是兩條獨立的網路請求，任一尚未完成
  // 都視為「雲端資料載入中」，讓既有的 assetsLoading 消費點（dashboard 警示、
  // HealthScoreCard、/health、NetWorthChart、SnapshotTable、EmailReportSender、
  // FIRE 起始淨資產回補等）一併涵蓋新網域，不必逐一為 19 個網域各自穿線 loading。
  const assetsLoading = assetsDomainLoading || !appState.ready;

  const [goals, setGoals] = useSyncedState<FinancialGoal[]>('goals', [], 'app-goals-v1');

  const netWorth = totalAssets - totalLiabilities;

  // totalCollateralValueTWD（質押擔保品市值）
  const totalCollateralValueTWD = useMemo(() => {
    return stockItems.reduce((sum, item) => {
      if (!item.collateralShares) return sum;
      const quote = stockQuotes[item.symbol];
      if (!quote) return sum;
      const value = quote.price * item.collateralShares;
      return sum + (quote.currency === 'USD' ? value * settingsCtx.usdToTwd : value);
    }, 0);
  }, [stockItems, stockQuotes, settingsCtx.usdToTwd]);

  // totalMonthlyIncome / totalMonthlyExpense（跨 domain 計算）
  const totalMonthlyIncome = useMemo(() => {
    const record = cashflowCtx.monthlyRecords[cashflowCtx.currentMonthKey];
    const items = record?.income ?? cashflowCtx.cashflowTemplate.income;
    return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(loanCtx.stakingEarnIncome);
  }, [cashflowCtx.monthlyRecords, cashflowCtx.currentMonthKey, cashflowCtx.cashflowTemplate.income, loanCtx.stakingEarnIncome]);

  const totalMonthlyExpense = useMemo(() => {
    const record = cashflowCtx.monthlyRecords[cashflowCtx.currentMonthKey];
    const items = record?.expense ?? cashflowCtx.cashflowTemplate.expense;
    return items.reduce((sum, item) => sum + item.amount, 0)
      + Math.round(loanCtx.stakingBorrowInterest)
      + loanCtx.totalLoanMonthlyPayments;
  }, [cashflowCtx.monthlyRecords, cashflowCtx.currentMonthKey, cashflowCtx.cashflowTemplate.expense, loanCtx.stakingBorrowInterest, loanCtx.totalLoanMonthlyPayments]);

  const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyExpense;

  // momDelta（與上月淨資產差）
  const momDelta = useMemo(() => {
    if (snapshots.length < 2) return null;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthSnap = [...snapshots].reverse().find(s => {
      const d = new Date(s.date);
      if (thisMonth === 0) return d.getFullYear() === thisYear - 1 && d.getMonth() === 11;
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth - 1;
    });
    if (!lastMonthSnap) return null;
    return netWorth - lastMonthSnap.netWorth;
  }, [snapshots, netWorth]);

  // takeSnapshot（使用 buildSnapshot 純函式）
  const takeSnapshot = useCallback(() => {
    if (totalAssets === 0 && netWorth === 0) return;
    const snap = buildSnapshot({
      assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
      totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots,
    });
    saveSnapshot(snap);
  }, [assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
      totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots, saveSnapshot]);

  // 登入 Google 後，姓名/Email 全站一律以 Google 帳號為準（不依賴使用者是否造訪過設定頁）；
  // 登出後 Google 帶入的資料不留存——還原成登入前本機 localStorage 原有的值（沒有就清空）
  const { data: session } = useSession();
  const prevSessionStatusRef = useRef(sessionStatus);
  const preLoginNameRef = useRef<string | null>(null);
  const preLoginEmailRef = useRef<string | null>(null);
  useEffect(() => {
    const prevSessionStatus = prevSessionStatusRef.current;
    prevSessionStatusRef.current = sessionStatus;

    if (sessionStatus === 'authenticated' && session) {
      // 只在「這次登入」第一次同步前記錄本機原有值，之後的重跑（因 userName 已被同步而觸發）不再覆蓋
      if (preLoginNameRef.current === null) preLoginNameRef.current = settingsCtx.userName;
      if (preLoginEmailRef.current === null) preLoginEmailRef.current = settingsCtx.userEmail;

      const googleName = session.user?.name ?? '';
      const googleEmail = session.user?.email ?? '';
      if (googleName && googleName !== settingsCtx.userName) settingsCtx.setUserName(googleName);
      if (googleEmail && googleEmail !== settingsCtx.userEmail) settingsCtx.setUserEmail(googleEmail);
      return;
    }

    if (prevSessionStatus === 'authenticated' && sessionStatus === 'unauthenticated') {
      settingsCtx.setUserName(preLoginNameRef.current ?? '');
      settingsCtx.setUserEmail(preLoginEmailRef.current ?? '');
      preLoginNameRef.current = null;
      preLoginEmailRef.current = null;
    }
  }, [sessionStatus, session, settingsCtx.userName, settingsCtx.userEmail, settingsCtx.setUserName, settingsCtx.setUserEmail]);

  // Auto daily snapshot
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (assetsLoading) return;
    if (stockItems.length > 0 && !lastUpdated) return;
    const today = new Date().toISOString().split('T')[0];
    const last = snapshots[snapshots.length - 1];
    if (last?.date === today) return;
    if (totalAssets === 0 && netWorth === 0) return;
    const snap = buildSnapshot({
      assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
      totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots,
    });
    saveSnapshot(snap);
  }, [lastUpdated, totalAssets, totalLiabilities, netWorth, assetsLoading, sessionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // clearAllData
  const clearAllData = useCallback(() => {
    clearAssetData();
    cashflowCtx.clearCashFlowData();
    loanCtx.clearLoanData();
    clearStockData();
    setGoals([]);
    // 個人資訊設定（姓名／信箱／匯率）一併回到初始預設值；
    // 若當下仍是 Google 登入狀態，這三個欄位會被全域同步 effect 立刻補回帳號資料，
    // 屬預期行為（登入狀態下身分本就以 Google 帳號為準，需先登出才能真正清空）。
    settingsCtx.setUserName('');
    settingsCtx.setUserEmail('');
    settingsCtx.setUsdToTwd(32);
  }, [clearAssetData, cashflowCtx.clearCashFlowData, loanCtx.clearLoanData, clearStockData, setGoals,
      settingsCtx.setUserName, settingsCtx.setUserEmail, settingsCtx.setUsdToTwd]);

  // Schema version migration（runs once on mount）
  useEffect(() => {
    const stored = localStorage.getItem('app-schema-version');
    const version = stored ? parseInt(stored) : 0;
    if (version < STORAGE_SCHEMA_VERSION) {
      localStorage.setItem('app-schema-version', String(STORAGE_SCHEMA_VERSION));
    }
  }, []);

  // Memoize each domain slice so only the affected consumers re-render
  const settingsSlice = useMemo(() => ({
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
  }), [
    settingsCtx.showValues, settingsCtx.userName, settingsCtx.userEmail, settingsCtx.usdToTwd,
    settingsCtx.reportSchedule, settingsCtx.lastReportSent, settingsCtx.netWorthGoal,
    settingsCtx.fireSettings, settingsCtx.lifeEvents, settingsCtx.onboardingDone,
    settingsCtx.enablePledgeTracking, settingsCtx.pledgeAlertLastSent, settingsCtx.lastExportDate,
    settingsCtx.setShowValues, settingsCtx.setUserName, settingsCtx.setUserEmail,
    settingsCtx.setUsdToTwd, settingsCtx.setReportSchedule, settingsCtx.setLastReportSent,
    settingsCtx.setNetWorthGoal, settingsCtx.setFireSettings, settingsCtx.setLifeEvents,
    settingsCtx.setOnboardingDone, settingsCtx.setEnablePledgeTracking,
    settingsCtx.setPledgeAlertLastSent, settingsCtx.setLastExportDate,
  ]);

  const stockSlice = useMemo(() => ({
    stockItems, setStockItems,
    dividendRecords, setDividendRecords,
    stockQuotes, refreshQuotes, lastUpdated, quoteError,
  }), [stockItems, dividendRecords, stockQuotes, lastUpdated, quoteError,
      refreshQuotes, setStockItems, setDividendRecords]);

  const loanSlice = useMemo(() => ({
    loans: loanCtx.loans, setLoans: loanCtx.setLoans,
    stakingItems: loanCtx.stakingItems, setStakingItems: loanCtx.setStakingItems,
    borrowingLimits: loanCtx.borrowingLimits, setBorrowingLimits: loanCtx.setBorrowingLimits,
    recordLoanPayment: loanCtx.recordLoanPayment, undoLoanPayment: loanCtx.undoLoanPayment,
  }), [loanCtx.loans, loanCtx.stakingItems, loanCtx.borrowingLimits,
      loanCtx.setLoans, loanCtx.setStakingItems, loanCtx.setBorrowingLimits,
      loanCtx.recordLoanPayment, loanCtx.undoLoanPayment]);

  const cashflowSlice = useMemo(() => ({
    monthlyRecords: cashflowCtx.monthlyRecords, setMonthlyRecords: cashflowCtx.setMonthlyRecords,
    cashflowTemplate: cashflowCtx.cashflowTemplate, setCashflowTemplate: cashflowCtx.setCashflowTemplate,
    annualEntries: cashflowCtx.annualEntries, setAnnualEntries: cashflowCtx.setAnnualEntries,
    categoryBudgets: cashflowCtx.categoryBudgets, setCategoryBudgets: cashflowCtx.setCategoryBudgets,
    customCategories: cashflowCtx.customCategories, setCustomCategories: cashflowCtx.setCustomCategories,
  }), [cashflowCtx.monthlyRecords, cashflowCtx.cashflowTemplate, cashflowCtx.annualEntries,
      cashflowCtx.categoryBudgets, cashflowCtx.customCategories,
      cashflowCtx.setMonthlyRecords, cashflowCtx.setCashflowTemplate, cashflowCtx.setAnnualEntries,
      cashflowCtx.setCategoryBudgets, cashflowCtx.setCustomCategories]);

  const ctxValue = useMemo(() => ({
    ...settingsSlice,
    ...stockSlice,
    ...loanSlice,
    ...cashflowSlice,
    assets, liabilities, snapshots, assetsLoading,
    combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
    addCategory, updateCategory, removeCategory,
    addAssetItem, updateAssetItem, removeAssetItem,
    addLiability, updateLiability, removeLiability,
    saveSnapshot, removeSnapshot,
    replaceAssets, replaceLiabilities, replaceSnapshots,
    netWorth, momDelta,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalCollateralValueTWD,
    goals, setGoals,
    clearAllData, takeSnapshot,
  }), [
    settingsSlice, stockSlice, loanSlice, cashflowSlice,
    assets, liabilities, snapshots, assetsLoading, combinedAssets, combinedLiabilities,
    totalAssets, totalLiabilities, netWorth, momDelta,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    totalCollateralValueTWD, goals,
    addCategory, updateCategory, removeCategory,
    addAssetItem, updateAssetItem, removeAssetItem,
    addLiability, updateLiability, removeLiability,
    saveSnapshot, removeSnapshot,
    replaceAssets, replaceLiabilities, replaceSnapshots,
    setGoals, clearAllData, takeSnapshot,
  ]);

  return (
    <AppContext.Provider value={ctxValue}>
      {children}
    </AppContext.Provider>
  );
}

// ─── AppProviderInner ────────────────────────────────────────────────────────

function AppProviderInner({ children }: { children: ReactNode }) {
  // 1. 從各子 Context 取值
  const settingsCtx = useSettingsContext();
  const loanCtx = useLoanContext();
  const cashflowCtx = useCashFlowContext();
  const { stockItems, setStockItems, dividendRecords, setDividendRecords,
          stockQuotes, lastUpdated, quoteError, refreshQuotes, clearStockData } = useStockContext();

  // 2. 跨 domain 計算（需要 stockQuotes + usdToTwd + stakingItems）
  const totalStockValueTWD = useMemo(() => {
    return stockItems.reduce((total, item) => {
      const quote = stockQuotes[item.symbol];
      if (!quote) return total;
      const value = quote.price * item.shares;
      return total + (quote.currency === 'USD' ? value * settingsCtx.usdToTwd : value);
    }, 0);
  }, [stockItems, stockQuotes, settingsCtx.usdToTwd]);

  const borrowItems = useMemo(
    () => loanCtx.stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow'),
    [loanCtx.stakingItems]
  );

  return (
    <AssetProvider
      stakingEarnTotal={loanCtx.stakingEarnTotal}
      totalStockValueTWD={totalStockValueTWD}
      borrowItems={borrowItems}
      loans={loanCtx.loans}
    >
      <AppContextBridge
        settingsCtx={settingsCtx}
        loanCtx={loanCtx}
        cashflowCtx={cashflowCtx}
        stockItems={stockItems}
        setStockItems={setStockItems}
        dividendRecords={dividendRecords}
        setDividendRecords={setDividendRecords}
        stockQuotes={stockQuotes}
        lastUpdated={lastUpdated}
        quoteError={quoteError}
        refreshQuotes={refreshQuotes}
        clearStockData={clearStockData}
      >
        {children}
      </AppContextBridge>
    </AssetProvider>
  );
}

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

// 向後相容 re-export（讓現有 consumer 不需改動 import 路徑）
export type {
  StakingType, StakingItem, LoanType, LoanItem,
  AssetSnapshot, FinancialGoal, StockSector, StockItem,
  StockQuote, DividendRecord, CashFlowItem,
  AnnualEntryCategory, AnnualEntry, MonthRecord, CashflowTemplate,
} from '../types';

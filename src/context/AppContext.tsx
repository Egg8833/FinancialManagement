"use client";

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type {
  AssetCategory, LiabilityItem, LifeEvent, FireSettings,
  StakingType, StakingItem, LoanType, LoanItem,
  AssetSnapshot, FinancialGoal, StockSector, StockItem,
  StockQuote, DividendRecord, CashFlowItem,
  AnnualEntryCategory, AnnualEntry, MonthRecord, CashflowTemplate,
} from '../types';
import { calculateHealthScore } from '../lib/healthScore';
import { monthKey } from '../lib/utils';
import { useStockContext } from './StockContext';
import { useSettingsContext, SettingsProvider } from './SettingsContext';
import { useLoanContext, LoanProvider } from './LoanContext';

const STORAGE_SCHEMA_VERSION = 1;

// --- Initial Dummy Data ---
const initialAssets: AssetCategory[] = [
  {
    id: 'liquid',
    title: '流動資金',
    description: '現金、存款與數位支付',
    colorClass: 'bg-emerald-400',
    bgClass: 'bg-emerald-50',
    updatedAt: '剛剛',
    items: [
      { id: 'l1', name: '銀行活存', amount: 300000 },
      { id: 'l2', name: '支付寶', amount: 150000 },
      { id: 'l3', name: 'Paypal', amount: 124000 },
    ],
  },
  {
    id: 'investment',
    title: '投資',
    description: '股票、加密貨幣、基金',
    colorClass: 'bg-indigo-500',
    bgClass: 'bg-indigo-50',
    updatedAt: '剛剛',
    items: [
      { id: 'i1', name: '加密貨幣', amount: 150000 },
      { id: 'i2', name: '台股基金', amount: 100000 },
      { id: 'i3', name: '海外股票', amount: 88200 },
    ],
  },
  {
    id: 'fixed',
    title: '固定資產',
    description: '房地產與車輛',
    colorClass: 'bg-blue-500',
    bgClass: 'bg-blue-50',
    updatedAt: '剛剛',
    items: [
      { id: 'f1', name: '自用住宅', amount: 1200000 },
      { id: 'f2', name: 'Honda Civic', amount: 320000 },
    ],
  },
  {
    id: 'receivable',
    title: '應收款',
    description: '借款等應收帳款',
    colorClass: 'bg-sky-400',
    bgClass: 'bg-sky-50',
    updatedAt: '剛剛',
    items: [
      { id: 'r1', name: '朋友借款', amount: 120000 },
    ],
  },
];

const initialLiabilities: LiabilityItem[] = [
  {
    id: 'li1',
    name: '房貸',
    description: '剩餘本金',
    amount: 1000000,
    updatedAt: '剛剛',
    icon: 'building',
  },
  {
    id: 'li2',
    name: '信用卡款',
    description: '本月未出帳',
    amount: 80000,
    updatedAt: '剛剛',
    icon: 'creditCard',
  },
];


const initialIncomeData: CashFlowItem[] = [
  { id: 'in1', name: '薪資收入', amount: 80000, category: 'Salary', isRecurring: true },
];

const initialExpenseData: CashFlowItem[] = [
  { id: 'ex1', name: '房租', amount: 20000, category: 'Housing', isRecurring: true },
  { id: 'ex2', name: '伙食費', amount: 15000, category: 'Food', isRecurring: true },
];

interface AppContextType {
  showValues: boolean;
  setShowValues: (val: boolean) => void;
  assets: AssetCategory[];
  setAssets: (assets: AssetCategory[] | ((prev: AssetCategory[]) => AssetCategory[])) => void;
  liabilities: LiabilityItem[];
  setLiabilities: (liabilities: LiabilityItem[] | ((prev: LiabilityItem[]) => LiabilityItem[])) => void;
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
  setSnapshots: (s: AssetSnapshot[] | ((prev: AssetSnapshot[]) => AssetSnapshot[])) => void;
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

const DEFAULT_CATEGORIES = ['餐飲', '交通', '房租', '娛樂', '醫療', '購物', '其他'];

function AppProviderInner({ children }: { children: ReactNode }) {
  const {
    stockItems, setStockItems,
    dividendRecords, setDividendRecords,
    borrowingLimits, setBorrowingLimits,
    stockQuotes, lastUpdated, quoteError,
    refreshQuotes, clearStockData,
  } = useStockContext();

  // 從 SettingsContext 取所有設定值（取代原本的 useStickyState）
  const {
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
  } = useSettingsContext();

  const {
    loans, setLoans,
    stakingItems, setStakingItems,
    recordLoanPayment, undoLoanPayment,
    totalLoanMonthlyPayments,
    stakingBorrowInterest, stakingEarnTotal, stakingEarnIncome,
    clearLoanData,
  } = useLoanContext();

  const [assets, setAssets] = useStickyState<AssetCategory[]>(initialAssets, 'app-assets-v1');
  const [liabilities, setLiabilities] = useStickyState<LiabilityItem[]>(initialLiabilities, 'app-liabilities-v1');
  const [snapshots, setSnapshots] = useStickyState<AssetSnapshot[]>([], 'app-snapshots-v1');
  const [annualEntries, setAnnualEntries] = useStickyState<AnnualEntry[]>([], 'app-annual-v1');
  const [monthlyRecords, setMonthlyRecords] = useStickyState<Record<string, MonthRecord>>(
    {}, 'app-monthly-records-v1'
  );
  const [cashflowTemplate, setCashflowTemplate] = useStickyState<CashflowTemplate>(
    { income: initialIncomeData, expense: initialExpenseData },
    'app-cashflow-template-v1'
  );
  const [goals, setGoals] = useStickyState<FinancialGoal[]>([], 'app-goals-v1');
  const [customCategories, setCustomCategories] = useStickyState<string[]>(DEFAULT_CATEGORIES, 'app-custom-categories-v1');
  const [categoryBudgets, setCategoryBudgets] = useStickyState<Record<string, number>>(
    {},
    'assetdash-category-budgets',
  );

  // Schema version migration — runs once on mount
  useEffect(() => {
    const stored = localStorage.getItem('app-schema-version');
    const version = stored ? parseInt(stored) : 0;
    if (version < STORAGE_SCHEMA_VERSION) {
      localStorage.setItem('app-schema-version', String(STORAGE_SCHEMA_VERSION));
    }
  }, []);

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

  // Compute Collateral Market Value (for pledge ratio)
  const totalCollateralValueTWD = useMemo(() => {
    return stockItems.reduce((sum, item) => {
      if (!item.collateralShares) return sum;
      const quote = stockQuotes[item.symbol];
      if (!quote) return sum;
      const value = quote.price * item.collateralShares;
      return sum + (quote.currency === 'USD' ? value * usdToTwd : value);
    }, 0);
  }, [stockItems, stockQuotes, usdToTwd]);

  // Compute Stock Total
  const totalStockValueTWD = useMemo(() => {
    let total = 0;
    for (const item of stockItems) {
      const quote = stockQuotes[item.symbol];
      if (quote) {
        const value = quote.price * item.shares;
        total += quote.currency === 'USD' ? value * usdToTwd : value;
      }
    }
    return total;
  }, [stockItems, stockQuotes, usdToTwd]);

  // Combined Assets（股票市值 + 收益型活存 自動加入投資分類）
  const combinedAssets = useMemo(() => {
    return assets.map(cat => {
      if (cat.id === 'investment') {
        const extra: { id: string; name: string; amount: number }[] = [];
        if (totalStockValueTWD > 0) extra.push({ id: 'auto-stocks', name: '自動化股票投資', amount: Math.round(totalStockValueTWD) });
        if (stakingEarnTotal > 0)   extra.push({ id: 'auto-earn',   name: '活存/Earn 收益資產', amount: stakingEarnTotal });
        if (extra.length === 0) return cat;
        return { ...cat, items: [...cat.items, ...extra] };
      }
      return cat;
    });
  }, [assets, totalStockValueTWD, stakingEarnTotal]);

  // Computed Totals
  const totalAssets = useMemo(() => {
    return combinedAssets.reduce((catSum, cat) => catSum + cat.items.reduce((itemSum, item) => itemSum + item.amount, 0), 0);
  }, [combinedAssets]);

  const combinedLiabilities = useMemo(() => {
    const list = [...liabilities];
    // 個別展示每筆質押借款（borrow 型）
    for (const item of stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow')) {
      list.push({
        id: `auto-staking-${item.id}`,
        name: item.name,
        description: `${item.protocol} · 質押借款 · ${item.apy}% 年利率`,
        amount: item.value,
        updatedAt: '自動同步',
        icon: 'building' as const,
      });
    }
    // 個別展示每筆信貸
    for (const loan of loans) {
      if (loan.principal > 0) {
        list.push({
          id: `auto-loan-${loan.id}`,
          name: `${loan.name}（${loan.bank}）`,
          description: loan.loanType === 'installment'
            ? `分期還款 · ${loan.interestRate}% · 剩餘${loan.remainingPeriods}期`
            : `循環借款 · ${loan.interestRate}% 年利率`,
          amount: loan.principal,
          updatedAt: '自動同步',
          icon: 'creditCard' as const,
        });
      }
    }
    return list;
  }, [liabilities, stakingItems, loans]);

  const totalLiabilities = useMemo(() => {
    return combinedLiabilities.reduce((sum, item) => sum + item.amount, 0);
  }, [combinedLiabilities]);

  // Cash Flow Calculations — 所有項目（固定 + 單次）皆計入當月收支
  const currentMonthKey = monthKey(new Date());

  const totalMonthlyIncome = useMemo(() => {
    const record = monthlyRecords[currentMonthKey];
    const items  = record?.income ?? cashflowTemplate.income;
    return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(stakingEarnIncome);
  }, [monthlyRecords, currentMonthKey, cashflowTemplate.income, stakingEarnIncome]);

  const totalMonthlyExpense = useMemo(() => {
    const record = monthlyRecords[currentMonthKey];
    const items  = record?.expense ?? cashflowTemplate.expense;
    return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(stakingBorrowInterest) + totalLoanMonthlyPayments;
  }, [monthlyRecords, currentMonthKey, cashflowTemplate.expense, stakingBorrowInterest, totalLoanMonthlyPayments]);

  const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyExpense;

  const netWorth = totalAssets - totalLiabilities;

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

  // Auto daily snapshot — fires after quotes load (or immediately if no stocks)
  useEffect(() => {
    if (stockItems.length > 0 && !lastUpdated) return;
    const today = new Date().toISOString().split('T')[0];
    setSnapshots(prev => {
      const last = prev[prev.length - 1];
      if (last?.date === today) return prev;
      if (totalAssets === 0 && netWorth === 0) return prev;
      // Compute health score and per-category amounts for this snapshot
      const liquidAmt = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
      const investmentAmt = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
      const fixedAmt = assets.find(c => c.id === 'fixed')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
      const receivableAmt = assets.find(c => c.id === 'receivable')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
      const healthResult = calculateHealthScore({
        totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
        totalAssets, totalLiabilities, liquidAssets: liquidAmt, investmentAssets: investmentAmt, snapshots: prev,
      });
      return [
        ...prev.slice(-364),
        {
          id: `snap-${Date.now()}`, date: today, totalAssets, totalLiabilities, netWorth,
          healthScore: healthResult.totalScore,
          liquid: liquidAmt, investment: investmentAmt, fixed: fixedAmt, receivable: receivableAmt,
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated, totalAssets, totalLiabilities, netWorth]);

  const clearAllData = () => {
    setAssets([]);
    setLiabilities([]);
    clearLoanData();
    setMonthlyRecords({});
    setCashflowTemplate({ income: [], expense: [] });
    setAnnualEntries([]);
    setSnapshots([]);
    setGoals([]);
    setCustomCategories(DEFAULT_CATEGORIES);
    clearStockData();
  };

  const takeSnapshot = () => {
    if (totalAssets === 0 && netWorth === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const liquidAmt = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
    const investmentAmt = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
    const fixedAmt = assets.find(c => c.id === 'fixed')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
    const receivableAmt = assets.find(c => c.id === 'receivable')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
    const healthResult = calculateHealthScore({
      totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
      totalAssets, totalLiabilities, liquidAssets: liquidAmt, investmentAssets: investmentAmt, snapshots,
    });
    const newSnap = {
      id: `snap-${Date.now()}`, date: today, totalAssets, totalLiabilities, netWorth,
      healthScore: healthResult.totalScore,
      liquid: liquidAmt, investment: investmentAmt, fixed: fixedAmt, receivable: receivableAmt,
    };
    setSnapshots(prev => {
      const withoutToday = prev.filter(s => s.date !== today);
      return [...withoutToday.slice(-364), newSnap];
    });
  };

  return (
    <AppContext.Provider value={{
      showValues,
      setShowValues,
      assets,
      setAssets,
      liabilities,
      setLiabilities,
      stakingItems,
      setStakingItems,
      stockItems,
      setStockItems,
      dividendRecords,
      setDividendRecords,
      stockQuotes,
      refreshQuotes,
      lastUpdated,
      quoteError,
      monthlyRecords,
      setMonthlyRecords,
      cashflowTemplate,
      setCashflowTemplate,
      annualEntries,
      setAnnualEntries,
      borrowingLimits,
      setBorrowingLimits,
      snapshots,
      setSnapshots,
      loans,
      setLoans,
      recordLoanPayment,
      undoLoanPayment,
      totalAssets,
      totalLiabilities,
      combinedLiabilities,
      combinedAssets,
      totalMonthlyIncome,
      totalMonthlyExpense,
      monthlyNetCashFlow,
      netWorth,
      momDelta,
      clearAllData,
      takeSnapshot,
      lastExportDate,
      setLastExportDate,
      netWorthGoal,
      setNetWorthGoal,
      totalCollateralValueTWD,
      usdToTwd,
      setUsdToTwd,
      pledgeAlertLastSent,
      setPledgeAlertLastSent,
      userName,
      setUserName,
      userEmail,
      setUserEmail,
      reportSchedule,
      setReportSchedule,
      lastReportSent,
      setLastReportSent,
      goals,
      setGoals,
      customCategories,
      setCustomCategories,
      categoryBudgets,
      setCategoryBudgets,
      fireSettings,
      setFireSettings,
      lifeEvents,
      setLifeEvents,
      onboardingDone,
      setOnboardingDone,
      enablePledgeTracking,
      setEnablePledgeTracking,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LoanProvider>
        <AppProviderInner>{children}</AppProviderInner>
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

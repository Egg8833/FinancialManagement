"use client";

import { createContext, useContext, ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type { AssetCategory, LiabilityItem } from '../types';
import { calculateHealthScore } from '../lib/healthScore';

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

// 版本升級至 v4，元大質押借款移入質押區塊
const initialStakingData: StakingItem[] = [
  { id: 's1', name: 'ETH 2.0 質押', protocol: 'Lido', amount: 15.5, value: 1550000, apy: 3.4, stakingType: 'borrow', borrowDate: '2024-01-15', repayDate: '2025-01-15' },
  { id: 's2', name: 'USDT 活存', protocol: 'Binance Earn', amount: 20000, value: 640000, apy: 6.5, stakingType: 'earn', borrowDate: '2024-02-01' },
  { id: 's3', name: '質押借款A', protocol: '元大', amount: 3734000, value: 3734000, apy: 2.58, stakingType: 'borrow' },
  { id: 's4', name: '質押借款B', protocol: '元大', amount: 126000, value: 126000, apy: 2.85, stakingType: 'borrow' },
];

const initialLoans: LoanItem[] = [
  { id: 'loan1', name: '信貸A', bank: '樂天', principal: 800000, initialPrincipal: 800000, interestRate: 2.08, monthlyPayment: 10242, paymentDay: 11, remainingPeriods: 68, loanType: 'installment', originalPeriods: 84, nextPaymentDate: '2026-05-11' },
  { id: 'loan2', name: '信貸B', bank: '王道', principal: 550000, initialPrincipal: 550000, interestRate: 3.20, monthlyPayment: 7274, paymentDay: 15, remainingPeriods: 70, loanType: 'installment', originalPeriods: 70 },
];

export type AssetSnapshot = {
  id: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  healthScore?: number;
  // per-category asset amounts (optional, added from v2 onwards)
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
  deadline?: string; // YYYY-MM-DD
  color: string;
  icon: 'home' | 'car' | 'travel' | 'emergency' | 'retirement' | 'education' | 'other';
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
  purchaseDate?: string; // YYYY-MM-DD
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
  date: string;           // YYYY-MM-DD
  dividendPerShare: number;
  shares: number;         // 持有股數（除息當時）
  currency: 'TWD' | 'USD';
  source: 'auto' | 'manual';
};

const initialStockData: StockItem[] = [
  { id: 'st1', symbol: '2330.TW', shares: 2000, avgCost: 600 },
  { id: 'st2', symbol: 'AAPL', shares: 100, avgCost: 150 },
];

export type CashFlowItem = {
  id: string;
  name: string;
  amount: number;
  category: string;
  isRecurring: boolean;
  budget?: number;           // 月預算上限（支出項目用）
  expenseTag?: 'needs' | 'wants' | 'savings'; // 50/30/20 分類
};

export type AnnualEntryCategory = 'dividend' | 'bonus' | 'other_income' | 'one_time_expense';

export type AnnualEntry = {
  id: string;
  year: number;
  month: number;
  name: string;
  amount: number;
  category: AnnualEntryCategory;
};


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
  incomeItems: CashFlowItem[];
  setIncomeItems: (items: CashFlowItem[] | ((prev: CashFlowItem[]) => CashFlowItem[])) => void;
  expenseItems: CashFlowItem[];
  setExpenseItems: (items: CashFlowItem[] | ((prev: CashFlowItem[]) => CashFlowItem[])) => void;
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
  clearAllData: () => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [showValues, setShowValues] = useStickyState<boolean>(true, 'app-show-values');
  const [assets, setAssets] = useStickyState<AssetCategory[]>(initialAssets, 'app-assets-v1');
  const [liabilities, setLiabilities] = useStickyState<LiabilityItem[]>(initialLiabilities, 'app-liabilities-v1');
  const [stakingItems, setStakingItems] = useStickyState<StakingItem[]>(initialStakingData, 'app-staking-v5');
  const [snapshots, setSnapshots] = useStickyState<AssetSnapshot[]>([], 'app-snapshots-v1');
  const [borrowingLimits, setBorrowingLimits] = useStickyState<Record<string, number>>({}, 'app-borrowing-limits-v1');
  const [stockItems, setStockItems] = useStickyState<StockItem[]>(initialStockData, 'app-stocks-v1');
  const [dividendRecords, setDividendRecords] = useStickyState<DividendRecord[]>([], 'app-dividends-v1');
  const [stockQuotes, setStockQuotes] = useState<Record<string, StockQuote>>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [incomeItems, setIncomeItems] = useStickyState<CashFlowItem[]>(initialIncomeData, 'app-income-v1');
  const [expenseItems, setExpenseItems] = useStickyState<CashFlowItem[]>(initialExpenseData, 'app-expense-v1');
  const [annualEntries, setAnnualEntries] = useStickyState<AnnualEntry[]>([], 'app-annual-v1');
  const [loans, setLoans] = useStickyState<LoanItem[]>(initialLoans, 'app-loans-v5');
  const [lastExportDate, setLastExportDate] = useStickyState<string>('', 'app-last-export-v1');
  const [netWorthGoal, setNetWorthGoal] = useStickyState<number>(0, 'app-net-worth-goal-v1');
  const [userName, setUserName] = useStickyState<string>('', 'app-user-name-v1');
  const [userEmail, setUserEmail] = useStickyState<string>('', 'app-user-email-v1');
  const [usdToTwd, setUsdToTwd] = useStickyState<number>(32, 'app-usd-twd-v1');
  const [pledgeAlertLastSent, setPledgeAlertLastSent] = useStickyState<Record<'warning' | 'danger', string>>(
    { warning: '', danger: '' },
    'app-pledge-alert-v1'
  );
  const [reportSchedule, setReportSchedule] = useStickyState<'none' | 'weekly' | 'monthly'>('none', 'app-report-schedule-v1');
  const [lastReportSent, setLastReportSent] = useStickyState('', 'app-last-report-sent-v1');
  const [goals, setGoals] = useStickyState<FinancialGoal[]>([], 'app-goals-v1');

  // ref so the interval always calls the latest version without restarting
  const refreshRef = useRef<() => Promise<void>>(undefined);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshQuotes = async () => {
    const symbols = new Set(stockItems.map(item => item.symbol));
    const symbolsParam = Array.from(symbols).join(',');
    if (!symbolsParam) return;
    try {
      const res = await fetch(`/api/quote?symbols=${symbolsParam}`);
      if (res.ok) {
        const data = await res.json();
        setStockQuotes(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch stock quotes', err);
    }
  };

  refreshRef.current = refreshQuotes;

  // Stable 60-second interval — never restarted
  useEffect(() => {
    const interval = setInterval(() => refreshRef.current?.(), 60000);
    return () => clearInterval(interval);
  }, []);

  // Immediate refresh when stock list changes — debounced to collapse rapid hydration updates into one call
  useEffect(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => refreshRef.current?.(), 150);
    return () => { if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current); };
  }, [stockItems]);

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

  // 借款型質押（borrow）：借款本金 → 負債，利息 → 支出
  // 收益型質押（earn）：存入金額 → 資產，收益 → 收入
  const borrowItems = useMemo(() => stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow'), [stakingItems]);
  const earnItems   = useMemo(() => stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn'),  [stakingItems]);


  const stakingBorrowInterest = useMemo(() => borrowItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [borrowItems]);
  const stakingEarnTotal      = useMemo(() => earnItems.reduce((s, i) => s + i.value, 0), [earnItems]);
  const stakingEarnIncome     = useMemo(() => earnItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0), [earnItems]);

  const totalLoanMonthlyPayments = useMemo(() => loans.reduce((s, l) => s + l.monthlyPayment, 0), [loans]);

  const recordLoanPayment = (id: string) => {
    setLoans(prev => prev.map(loan => {
      if (loan.id !== id || loan.loanType !== 'installment' || loan.remainingPeriods <= 0) return loan;
      let nextDate: string | undefined = undefined;
      if (loan.nextPaymentDate) {
        const d = new Date(loan.nextPaymentDate);
        d.setMonth(d.getMonth() + 1);
        nextDate = d.toISOString().split('T')[0];
      }
      
      const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
      const principalReduction = loan.monthlyPayment - interest;

      return {
        ...loan,
        principal: Math.max(0, Math.round(loan.principal - principalReduction)),
        remainingPeriods: loan.remainingPeriods - 1,
        nextPaymentDate: nextDate,
      };
    }));
  };

  const undoLoanPayment = (id: string) => {
    setLoans(prev => prev.map(loan => {
      if (loan.id !== id || loan.loanType !== 'installment') return loan;
      let prevDate: string | undefined = undefined;
      if (loan.nextPaymentDate) {
        const d = new Date(loan.nextPaymentDate);
        d.setMonth(d.getMonth() - 1);
        prevDate = d.toISOString().split('T')[0];
      }
      
      const interest = Math.round(loan.principal * loan.interestRate / 100 / 12);
      const principalReduction = loan.monthlyPayment - interest;

      return {
        ...loan,
        principal: Math.round(loan.principal + principalReduction),
        remainingPeriods: loan.remainingPeriods + 1,
        nextPaymentDate: prevDate,
      };
    }));
  };

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
    for (const item of borrowItems) {
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
  }, [liabilities, borrowItems, loans]);

  const totalLiabilities = useMemo(() => {
    return combinedLiabilities.reduce((sum, item) => sum + item.amount, 0);
  }, [combinedLiabilities]);

  // Cash Flow Calculations
  const totalMonthlyIncome = useMemo(() => {
    const manual = incomeItems.reduce((sum, item) => sum + item.amount, 0);
    return manual + Math.round(stakingEarnIncome); // 活存收益計入收入
  }, [incomeItems, stakingEarnIncome]);

  const totalMonthlyExpense = useMemo(() => {
    const manualExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
    return manualExpense + Math.round(stakingBorrowInterest) + totalLoanMonthlyPayments;
  }, [expenseItems, stakingBorrowInterest, totalLoanMonthlyPayments]);

  const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyExpense;

  const netWorth = totalAssets - totalLiabilities;

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
    setStakingItems([]);
    setLoans([]);
    setStockItems([]);
    setDividendRecords([]);
    setIncomeItems([]);
    setExpenseItems([]);
    setAnnualEntries([]);
    setSnapshots([]);
    setGoals([]);
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
      incomeItems,
      setIncomeItems,
      expenseItems,
      setExpenseItems,
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
      clearAllData,
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

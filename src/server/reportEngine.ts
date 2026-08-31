import type { Db } from '../db/client';
import { assets, liabilities, appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { getQuotes } from '../lib/quoteService';
import { buildCombinedAssets, buildCombinedLiabilities, computeTotalAssets, computeTotalLiabilities } from '../lib/assetCalc';
import { computeMonthlyIncome, computeMonthlyExpense } from '../lib/cashflowCalc';
import { computePledgeRatios, getPledgeAlertLevel, buildReportPledgeRatios, type PledgeRatio } from '../lib/pledgeCalc';
import { monthKey } from '../lib/utils';
import type { ReportPayload } from '../lib/mail';
import type {
  AssetCategory, LiabilityItem, StockItem, StakingItem, LoanItem,
  CashflowTemplate, MonthRecord, StockQuote,
} from '../types';

const assetsStore = createEntityStore(assets);
const liabilitiesStore = createEntityStore(liabilities);
const appStateStore = createEntityStore(appState);

interface UserFinancialData {
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  stockItems: StockItem[];
  stakingItems: StakingItem[];
  loans: LoanItem[];
  cashflowTemplate: CashflowTemplate;
  monthlyRecords: Record<string, MonthRecord>;
  usdToTwd: number;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  lastReportSent: string;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
}

async function loadAppState(db: Db, userId: string): Promise<Record<string, unknown>> {
  const rows = await appStateStore.getAll(db, userId);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    const entry = row.data as { id: string; value: unknown };
    map[entry.id] = entry.value;
  }
  return map;
}

async function loadUserFinancialData(db: Db, userId: string): Promise<UserFinancialData> {
  const [assetRows, liabilityRows, state] = await Promise.all([
    assetsStore.getAll(db, userId),
    liabilitiesStore.getAll(db, userId),
    loadAppState(db, userId),
  ]);

  return {
    assets: assetRows.map(r => r.data as AssetCategory),
    liabilities: liabilityRows.map(r => r.data as LiabilityItem),
    stockItems: (state.stockItems as StockItem[]) ?? [],
    stakingItems: (state.stakingItems as StakingItem[]) ?? [],
    loans: (state.loans as LoanItem[]) ?? [],
    cashflowTemplate: (state.cashflowTemplate as CashflowTemplate) ?? { income: [], expense: [] },
    monthlyRecords: (state.monthlyRecords as Record<string, MonthRecord>) ?? {},
    usdToTwd: (state.usdToTwd as number) ?? 32,
    reportSchedule: (state.reportSchedule as 'none' | 'weekly' | 'monthly') ?? 'none',
    lastReportSent: (state.lastReportSent as string) ?? '',
    pledgeAlertLastSent: (state.pledgeAlertLastSent as Record<'warning' | 'danger', string>) ?? { warning: '', danger: '' },
  };
}

export interface UserReportResult {
  reportPayload: ReportPayload;
  pledgeAlert: { level: 'warning' | 'danger'; platform: string; ratio: number; pledgeData: PledgeRatio[] } | null;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  lastReportSent: string;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
}

export async function computeUserReport(db: Db, userId: string): Promise<UserReportResult> {
  const fin = await loadUserFinancialData(db, userId);

  const symbols = Array.from(new Set(fin.stockItems.map(s => s.symbol)));
  let stockQuotes: Record<string, StockQuote> = {};
  if (symbols.length > 0) {
    const { data } = await getQuotes(symbols);
    stockQuotes = data;
  }

  const borrowItems = fin.stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const earnItems = fin.stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');
  const stakingEarnTotal = earnItems.reduce((s, i) => s + i.value, 0);
  const stakingEarnIncome = earnItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const stakingBorrowInterest = borrowItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const totalLoanMonthlyPayments = fin.loans.reduce((s, l) => s + l.monthlyPayment, 0);

  const totalStockValueTWD = fin.stockItems.reduce((total, item) => {
    const quote = stockQuotes[item.symbol];
    if (!quote) return total;
    const value = quote.price * item.shares;
    return total + (quote.currency === 'USD' ? value * fin.usdToTwd : value);
  }, 0);

  const combinedAssets = buildCombinedAssets(fin.assets, totalStockValueTWD, stakingEarnTotal);
  const combinedLiabilities = buildCombinedLiabilities(fin.liabilities, borrowItems, fin.loans);
  const totalAssets = computeTotalAssets(combinedAssets);
  const totalLiabilities = computeTotalLiabilities(combinedLiabilities);
  const netWorth = totalAssets - totalLiabilities;

  const currentMonthKey = monthKey(new Date());
  const monthRecord = fin.monthlyRecords[currentMonthKey];
  const totalMonthlyIncome = computeMonthlyIncome(monthRecord, fin.cashflowTemplate, stakingEarnIncome);
  const totalMonthlyExpense = computeMonthlyExpense(monthRecord, fin.cashflowTemplate, stakingBorrowInterest, totalLoanMonthlyPayments);
  const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyExpense;

  const pledgeRatios = computePledgeRatios(fin.stakingItems, fin.stockItems, stockQuotes, fin.usdToTwd);
  const alert = getPledgeAlertLevel(pledgeRatios);

  const reportPayload: ReportPayload = {
    totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    usdToTwd: fin.usdToTwd,
    combinedAssets: combinedAssets.map(cat => ({
      title: cat.title, items: cat.items.map(i => ({ name: i.name, amount: i.amount })),
    })),
    combinedLiabilities: combinedLiabilities.map(item => ({
      name: item.name, description: item.description, amount: item.amount,
    })),
    loans: fin.loans.map(loan => ({
      name: loan.name, bank: loan.bank, principal: loan.principal, interestRate: loan.interestRate,
      monthlyPayment: loan.monthlyPayment, remainingPeriods: loan.remainingPeriods,
    })),
    stakingItems: fin.stakingItems.map(item => ({
      name: item.name, protocol: item.protocol, value: item.value, apy: item.apy,
      stakingType: item.stakingType ?? 'borrow', monthlyInterest: item.value * item.apy / 100 / 12,
      borrowDate: item.borrowDate, repayDate: item.repayDate,
    })),
    stockItems: fin.stockItems.map(stock => {
      const quote = stockQuotes[stock.symbol];
      const currentPrice = quote?.price || 0;
      const currency = quote?.currency || 'TWD';
      const changePercent = quote?.changePercent || 0;
      const marketValueRaw = currentPrice * stock.shares;
      const marketValueTWD = currency === 'USD' ? marketValueRaw * fin.usdToTwd : marketValueRaw;
      const costBasis = currency === 'USD' ? stock.avgCost * fin.usdToTwd : stock.avgCost;
      const unrealizedPnL = marketValueTWD - costBasis;
      const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
      return {
        symbol: stock.symbol, shortName: quote?.shortName, platform: stock.platform,
        shares: stock.shares, avgCost: stock.avgCost, currentPrice, currency, changePercent,
        marketValueTWD: Math.round(marketValueTWD), costBasis: Math.round(costBasis),
        unrealizedPnL: Math.round(unrealizedPnL), unrealizedPnLPct,
      };
    }),
    pledgeRatioData: buildReportPledgeRatios(pledgeRatios),
    generatedAt: new Date().toISOString(),
  };

  return {
    reportPayload,
    pledgeAlert: alert ? { ...alert, pledgeData: pledgeRatios } : null,
    reportSchedule: fin.reportSchedule,
    lastReportSent: fin.lastReportSent,
    pledgeAlertLastSent: fin.pledgeAlertLastSent,
  };
}

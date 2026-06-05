export type AssetItem = {
  id: string;
  name: string;
  amount: number;
};

export type AssetCategory = {
  id: string;
  title: string;
  description: string;
  colorClass: string;
  bgClass: string;
  updatedAt: string;
  items: AssetItem[];
};

export type LiabilityItem = {
  id: string;
  name: string;
  description: string;
  amount: number;
  updatedAt: string;
  icon: 'building' | 'creditCard';
};

export type LifeEvent = {
  id: string;
  name: string;
  age: number;
  type: 'income_jump' | 'expense_jump' | 'one_time_lump_sum';
  amount: number;
};

export type FireSettings = {
  currentAge: number;
  targetRetirementAge: number;
  annualReturnRate: number;
  inflationRate: number;
  swr: number;
  taxRate: number;
  currentNetWorth?: number;
  monthlyInvestment?: number;
  retirementMonthlyExpense?: number;
};

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

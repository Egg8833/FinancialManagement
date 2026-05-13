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

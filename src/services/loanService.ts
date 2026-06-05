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

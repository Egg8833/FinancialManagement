// src/lib/assetCalc.ts
import type { AssetCategory, LiabilityItem, StakingItem, LoanItem } from '../types';

export function buildCombinedAssets(
  assets: AssetCategory[],
  totalStockValueTWD: number,
  stakingEarnTotal: number,
): AssetCategory[] {
  return assets.map(cat => {
    if (cat.id !== 'investment') return cat;
    const extra: { id: string; name: string; amount: number }[] = [];
    if (totalStockValueTWD > 0) extra.push({ id: 'auto-stocks', name: '自動化股票投資', amount: Math.round(totalStockValueTWD) });
    if (stakingEarnTotal > 0)   extra.push({ id: 'auto-earn',   name: '活存/Earn 收益資產', amount: stakingEarnTotal });
    if (extra.length === 0) return cat;
    return { ...cat, items: [...cat.items, ...extra] };
  });
}

type BorrowStakingItem = Pick<StakingItem, 'id' | 'name' | 'protocol' | 'value' | 'apy'>;
type CombinedLoan = Pick<LoanItem, 'id' | 'name' | 'bank' | 'principal' | 'interestRate' | 'remainingPeriods' | 'loanType'>;

export function buildCombinedLiabilities(
  liabilities: LiabilityItem[],
  borrowItems: BorrowStakingItem[],
  loans: CombinedLoan[],
): LiabilityItem[] {
  const list = [...liabilities];
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
}

export function computeTotalAssets(combinedAssets: AssetCategory[]): number {
  return combinedAssets.reduce((s, cat) => s + cat.items.reduce((is, i) => is + i.amount, 0), 0);
}

export function computeTotalLiabilities(combinedLiabilities: LiabilityItem[]): number {
  return combinedLiabilities.reduce((s, i) => s + i.amount, 0);
}

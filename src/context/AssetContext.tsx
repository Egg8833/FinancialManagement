"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type { AssetCategory, LiabilityItem, AssetSnapshot, StakingItem, LoanItem } from '../types';

const initialAssets: AssetCategory[] = [
  {
    id: 'liquid', title: '流動資金', description: '現金、存款與數位支付',
    colorClass: 'bg-emerald-400', bgClass: 'bg-emerald-50', updatedAt: '剛剛',
    items: [
      { id: 'l1', name: '銀行活存', amount: 300000 },
      { id: 'l2', name: '支付寶', amount: 150000 },
      { id: 'l3', name: 'Paypal', amount: 124000 },
    ],
  },
  {
    id: 'investment', title: '投資', description: '股票、加密貨幣、基金',
    colorClass: 'bg-indigo-500', bgClass: 'bg-indigo-50', updatedAt: '剛剛',
    items: [
      { id: 'i1', name: '加密貨幣', amount: 150000 },
      { id: 'i2', name: '台股基金', amount: 100000 },
      { id: 'i3', name: '海外股票', amount: 88200 },
    ],
  },
  {
    id: 'fixed', title: '固定資產', description: '房地產與車輛',
    colorClass: 'bg-blue-500', bgClass: 'bg-blue-50', updatedAt: '剛剛',
    items: [
      { id: 'f1', name: '自用住宅', amount: 1200000 },
      { id: 'f2', name: 'Honda Civic', amount: 320000 },
    ],
  },
  {
    id: 'receivable', title: '應收款', description: '借款等應收帳款',
    colorClass: 'bg-sky-400', bgClass: 'bg-sky-50', updatedAt: '剛剛',
    items: [{ id: 'r1', name: '朋友借款', amount: 120000 }],
  },
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
  borrowItems: Pick<StakingItem, 'id' | 'name' | 'protocol' | 'value' | 'apy'>[];
  loans: Pick<LoanItem, 'id' | 'name' | 'bank' | 'principal' | 'interestRate' | 'remainingPeriods' | 'loanType'>[];
}

export function AssetProvider({
  children, stakingEarnTotal, totalStockValueTWD, borrowItems, loans,
}: AssetProviderProps) {
  const [assets, setAssets] = useStickyState<AssetCategory[]>(initialAssets, 'app-assets-v1');
  const [liabilities, setLiabilities] = useStickyState<LiabilityItem[]>(initialLiabilities, 'app-liabilities-v1');
  const [snapshots, setSnapshots] = useStickyState<AssetSnapshot[]>([], 'app-snapshots-v1');

  const combinedAssets = useMemo(() => {
    return assets.map(cat => {
      if (cat.id !== 'investment') return cat;
      const extra: { id: string; name: string; amount: number }[] = [];
      if (totalStockValueTWD > 0) extra.push({ id: 'auto-stocks', name: '自動化股票投資', amount: Math.round(totalStockValueTWD) });
      if (stakingEarnTotal > 0)   extra.push({ id: 'auto-earn',   name: '活存/Earn 收益資產', amount: stakingEarnTotal });
      if (extra.length === 0) return cat;
      return { ...cat, items: [...cat.items, ...extra] };
    });
  }, [assets, totalStockValueTWD, stakingEarnTotal]);

  const combinedLiabilities = useMemo<LiabilityItem[]>(() => {
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
  }, [liabilities, borrowItems, loans]);

  const totalAssets = useMemo(
    () => combinedAssets.reduce((s, cat) => s + cat.items.reduce((is, i) => is + i.amount, 0), 0),
    [combinedAssets]
  );

  const totalLiabilities = useMemo(
    () => combinedLiabilities.reduce((s, i) => s + i.amount, 0),
    [combinedLiabilities]
  );

  const clearAssetData = () => {
    setAssets([]);
    setLiabilities([]);
    setSnapshots([]);
  };

  return (
    <AssetContext.Provider value={{
      assets, setAssets,
      liabilities, setLiabilities,
      snapshots, setSnapshots,
      combinedAssets, combinedLiabilities,
      totalAssets, totalLiabilities,
      clearAssetData,
    }}>
      {children}
    </AssetContext.Provider>
  );
}

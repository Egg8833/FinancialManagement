"use client";

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';
import type { EntityRepository } from '../repositories/types';
import { createLocalRepository } from '../repositories/localRepository';
import { createRemoteRepository } from '../repositories/remoteRepository';

export const LOCAL_KEYS = {
  assets: 'app-assets-v1',
  liabilities: 'app-liabilities-v1',
  snapshots: 'app-snapshots-v1',
} as const;

export const initialAssets: AssetCategory[] = [
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

export const initialLiabilities: LiabilityItem[] = [
  { id: 'li1', name: '房貸', description: '剩餘本金', amount: 1000000, updatedAt: '剛剛', icon: 'building' },
  { id: 'li2', name: '信用卡款', description: '本月未出帳', amount: 80000, updatedAt: '剛剛', icon: 'creditCard' },
];

export type Repos = {
  assets: EntityRepository<AssetCategory>;
  liabilities: EntityRepository<LiabilityItem>;
  snapshots: EntityRepository<AssetSnapshot>;
};

interface RepositoryContextType {
  repos: Repos;
  mode: 'guest' | 'cloud';
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

export function useRepositories() {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepositories must be used within RepositoryProvider');
  return ctx;
}

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const mode: 'guest' | 'cloud' = status === 'authenticated' ? 'cloud' : 'guest';

  const repos = useMemo<Repos>(() => (
    mode === 'cloud'
      ? {
          assets: createRemoteRepository<AssetCategory>('/api/user/assets'),
          liabilities: createRemoteRepository<LiabilityItem>('/api/user/liabilities'),
          snapshots: createRemoteRepository<AssetSnapshot>('/api/user/snapshots'),
        }
      : {
          assets: createLocalRepository<AssetCategory>(LOCAL_KEYS.assets, initialAssets),
          liabilities: createLocalRepository<LiabilityItem>(LOCAL_KEYS.liabilities, initialLiabilities),
          snapshots: createLocalRepository<AssetSnapshot>(LOCAL_KEYS.snapshots, []),
        }
  ), [mode]);

  return (
    <RepositoryContext.Provider value={{ repos, mode, sessionStatus: status }}>
      {children}
    </RepositoryContext.Provider>
  );
}

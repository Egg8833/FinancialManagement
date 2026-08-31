"use client";

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import type { AssetCategory, AssetItem, LiabilityItem, AssetSnapshot, StakingItem, LoanItem } from '../types';
import { useRepositories } from './RepositoryContext';
import { useSyncedCollection } from '../hooks/useSyncedCollection';
import { mergeSnapshot } from '../lib/snapshotMerge';
import { ConflictError } from '../repositories/types';
import { useToast } from './ToastContext';
import { buildCombinedAssets, buildCombinedLiabilities, computeTotalAssets, computeTotalLiabilities } from '../lib/assetCalc';

const nowTs = () => '剛剛';

interface AssetContextType {
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  snapshots: AssetSnapshot[];
  assetsLoading: boolean;               // cloud 模式初載;guest 模式恆 false(首次 render 後)
  combinedAssets: AssetCategory[];
  combinedLiabilities: LiabilityItem[];
  totalAssets: number;
  totalLiabilities: number;
  addCategory(input: { title: string; description: string; colorClass: string; bgClass: string }): void;
  updateCategory(id: string, patch: Partial<Omit<AssetCategory, 'id'>>): void;
  removeCategory(id: string): void;
  addAssetItem(categoryId: string, name: string, amount: number): void;
  updateAssetItem(categoryId: string, itemId: string, patch: Partial<Omit<AssetItem, 'id'>>): void;
  removeAssetItem(categoryId: string, itemId: string): void;
  reorderAssetItems(categoryId: string, orderedIds: string[]): void;
  addLiability(input: { name: string; amount: number; description?: string; icon?: 'building' | 'creditCard' }): void;
  updateLiability(id: string, patch: Partial<Omit<LiabilityItem, 'id'>>): void;
  removeLiability(id: string): void;
  saveSnapshot(snap: AssetSnapshot): void;        // 同日去重 + 保留最近 365 筆
  removeSnapshot(id: string): void;
  replaceAssets(data: AssetCategory[]): Promise<void>;
  replaceLiabilities(data: LiabilityItem[]): Promise<void>;
  replaceSnapshots(data: AssetSnapshot[]): Promise<void>;
  clearAssetData(): void;
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
  const { repos } = useRepositories();
  const { toast } = useToast();

  const onError = useCallback((e: unknown, reload: () => void) => {
    if (e instanceof ConflictError) {
      toast('資料已在其他裝置修改，已重新載入', 'error');
      reload();
    } else {
      toast('儲存失敗，變更已還原', 'error');
    }
  }, [toast]);

  const onLoadError = useCallback((_e: unknown) => {
    toast('載入雲端資料失敗，請重新整理頁面', 'error');
  }, [toast]);

  const assetsCol = useSyncedCollection<AssetCategory>(repos.assets, onError, onLoadError);
  const liabCol = useSyncedCollection<LiabilityItem>(repos.liabilities, onError, onLoadError);
  const snapCol = useSyncedCollection<AssetSnapshot>(repos.snapshots, onError, onLoadError);

  const assets = assetsCol.items;
  const liabilities = liabCol.items;
  const snapshots = snapCol.items;
  const assetsLoading = assetsCol.loading || liabCol.loading || snapCol.loading;

  // ── 資產分類操作 ──────────────────────────────────────────────
  const addCategory = useCallback((input: { title: string; description: string; colorClass: string; bgClass: string }) => {
    const cat: AssetCategory = { id: `cat-${Date.now()}`, ...input, updatedAt: nowTs(), items: [] };
    assetsCol.apply([...assets, cat], r => r.create(cat));
  }, [assets, assetsCol]);

  const updateCategory = useCallback((id: string, patch: Partial<Omit<AssetCategory, 'id'>>) => {
    const target = assets.find(c => c.id === id);
    if (!target) return;
    const updated = { ...target, ...patch, updatedAt: nowTs() };
    assetsCol.apply(assets.map(c => (c.id === id ? updated : c)), r => r.update(updated));
  }, [assets, assetsCol]);

  const removeCategory = useCallback((id: string) => {
    assetsCol.apply(assets.filter(c => c.id !== id), r => r.remove(id));
  }, [assets, assetsCol]);

  const mutateCategoryItems = useCallback((categoryId: string, fn: (items: AssetItem[]) => AssetItem[]) => {
    const target = assets.find(c => c.id === categoryId);
    if (!target) return;
    const updated = { ...target, items: fn(target.items), updatedAt: nowTs() };
    assetsCol.apply(assets.map(c => (c.id === categoryId ? updated : c)), r => r.update(updated));
  }, [assets, assetsCol]);

  const addAssetItem = useCallback((categoryId: string, name: string, amount: number) => {
    if (!name.trim()) return;
    mutateCategoryItems(categoryId, items => [...items, { id: Date.now().toString(), name, amount }]);
  }, [mutateCategoryItems]);

  const updateAssetItem = useCallback((categoryId: string, itemId: string, patch: Partial<Omit<AssetItem, 'id'>>) => {
    mutateCategoryItems(categoryId, items => items.map(i => (i.id === itemId ? { ...i, ...patch } : i)));
  }, [mutateCategoryItems]);

  const removeAssetItem = useCallback((categoryId: string, itemId: string) => {
    mutateCategoryItems(categoryId, items => items.filter(i => i.id !== itemId));
  }, [mutateCategoryItems]);

  const reorderAssetItems = useCallback((categoryId: string, orderedIds: string[]) => {
    mutateCategoryItems(categoryId, items => {
      const byId = new Map(items.map(i => [i.id, i]));
      const reordered = orderedIds.map(id => byId.get(id)).filter((i): i is AssetItem => !!i);
      // 保留任何不在 orderedIds 內的項目（理論上不會發生，防呆用）
      const missing = items.filter(i => !orderedIds.includes(i.id));
      return [...reordered, ...missing];
    });
  }, [mutateCategoryItems]);

  // ── 負債操作 ─────────────────────────────────────────────────
  const addLiability = useCallback((input: { name: string; amount: number; description?: string; icon?: 'building' | 'creditCard' }) => {
    if (!input.name.trim()) return;
    const item: LiabilityItem = {
      id: Date.now().toString(), name: input.name, amount: input.amount,
      description: input.description ?? '自訂負債', updatedAt: nowTs(), icon: input.icon ?? 'creditCard',
    };
    liabCol.apply([...liabilities, item], r => r.create(item));
  }, [liabilities, liabCol]);

  const updateLiability = useCallback((id: string, patch: Partial<Omit<LiabilityItem, 'id'>>) => {
    const target = liabilities.find(i => i.id === id);
    if (!target) return;
    const updated = { ...target, ...patch, updatedAt: nowTs() };
    liabCol.apply(liabilities.map(i => (i.id === id ? updated : i)), r => r.update(updated));
  }, [liabilities, liabCol]);

  const removeLiability = useCallback((id: string) => {
    liabCol.apply(liabilities.filter(i => i.id !== id), r => r.remove(id));
  }, [liabilities, liabCol]);

  // ── 快照操作 ─────────────────────────────────────────────────
  const saveSnapshot = useCallback((snap: AssetSnapshot) => {
    const next = mergeSnapshot(snapshots, snap);
    // 同日去重/裁切會刪舊列;為簡化與穩健,快照一律整批同步
    snapCol.apply(next, r => r.replaceAll(next));
  }, [snapshots, snapCol]);

  const removeSnapshot = useCallback((id: string) => {
    snapCol.apply(snapshots.filter(s => s.id !== id), r => r.remove(id));
  }, [snapshots, snapCol]);

  // ── 匯入/清除 ────────────────────────────────────────────────
  const replaceAssets = assetsCol.replace;
  const replaceLiabilities = liabCol.replace;
  const replaceSnapshots = snapCol.replace;

  const clearAssetData = useCallback(() => {
    void (async () => {
      try {
        await Promise.all([
          assetsCol.replace([]),
          liabCol.replace([]),
          snapCol.replace([]),
        ]);
      } catch {
        toast('清除失敗，請稍後再試', 'error');
      }
    })();
  }, [assetsCol, liabCol, snapCol, toast]);

  // ── 衍生值(呼叫 src/lib/assetCalc.ts 的共用純函式,前端與伺服器 cron 共用同一份邏輯)──
  const combinedAssets = useMemo(
    () => buildCombinedAssets(assets, totalStockValueTWD, stakingEarnTotal),
    [assets, totalStockValueTWD, stakingEarnTotal]
  );

  const combinedLiabilities = useMemo(
    () => buildCombinedLiabilities(liabilities, borrowItems, loans),
    [liabilities, borrowItems, loans]
  );

  const totalAssets = useMemo(() => computeTotalAssets(combinedAssets), [combinedAssets]);
  const totalLiabilities = useMemo(() => computeTotalLiabilities(combinedLiabilities), [combinedLiabilities]);

  return (
    <AssetContext.Provider value={{
      assets, liabilities, snapshots, assetsLoading,
      combinedAssets, combinedLiabilities, totalAssets, totalLiabilities,
      addCategory, updateCategory, removeCategory,
      addAssetItem, updateAssetItem, removeAssetItem, reorderAssetItems,
      addLiability, updateLiability, removeLiability,
      saveSnapshot, removeSnapshot,
      replaceAssets, replaceLiabilities, replaceSnapshots,
      clearAssetData,
    }}>
      {children}
    </AssetContext.Provider>
  );
}

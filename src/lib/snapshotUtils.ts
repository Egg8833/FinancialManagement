import type { AssetSnapshot, AssetCategory } from '../types';
import { calculateHealthScore } from './healthScore';

interface BuildSnapshotParams {
  assets: AssetCategory[];
  combinedAssets: AssetCategory[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  monthlyNetCashFlow: number;
  snapshots: AssetSnapshot[];
}

export function buildSnapshot(params: BuildSnapshotParams): AssetSnapshot {
  const {
    assets, combinedAssets, totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow, snapshots,
  } = params;

  const today = new Date().toISOString().split('T')[0];
  const liquidAmt     = assets.find(c => c.id === 'liquid')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const investmentAmt = combinedAssets.find(c => c.id === 'investment')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const fixedAmt      = assets.find(c => c.id === 'fixed')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
  const receivableAmt = assets.find(c => c.id === 'receivable')?.items.reduce((s, i) => s + i.amount, 0) ?? 0;

  const healthResult = calculateHealthScore({
    totalMonthlyIncome,
    totalMonthlyExpense,
    monthlyNetCashFlow,
    totalAssets,
    totalLiabilities,
    liquidAssets: liquidAmt,
    investmentAssets: investmentAmt,
    snapshots,
  });

  return {
    id: `snap-${Date.now()}`,
    date: today,
    totalAssets,
    totalLiabilities,
    netWorth,
    healthScore: healthResult.totalScore,
    liquid: liquidAmt,
    investment: investmentAmt,
    fixed: fixedAmt,
    receivable: receivableAmt,
  };
}

import type { FinancialGoal } from '../context/AppContext';
import type { AssetCategory } from '../types';

export function resolveCurrentAmount(goal: FinancialGoal, assets: AssetCategory[]): number {
  if (!goal.linkedAssetItemIds?.length) return goal.currentAmount;
  const allItems = assets.flatMap(cat => cat.items);
  return goal.linkedAssetItemIds.reduce((sum, id) => {
    const item = allItems.find(i => i.id === id);
    return sum + (item?.amount ?? 0);
  }, 0);
}

export function getLinkedItemIds(goals: FinancialGoal[], excludeGoalId?: string): Set<string> {
  return new Set(
    goals
      .filter(g => g.id !== excludeGoalId)
      .flatMap(g => g.linkedAssetItemIds ?? [])
  );
}

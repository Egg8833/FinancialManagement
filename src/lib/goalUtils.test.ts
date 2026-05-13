import { describe, it, expect } from 'vitest';
import { resolveCurrentAmount, getLinkedItemIds } from './goalUtils';
import type { FinancialGoal } from '../context/AppContext';
import type { AssetCategory } from '../types';

const mkGoal = (overrides: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 'g1', name: 'Test', targetAmount: 100000, currentAmount: 50000,
  color: '#6366f1', icon: 'other', ...overrides,
});

const mkAssets = (): AssetCategory[] => [
  {
    id: 'liquid', title: '流動資金', description: '', colorClass: '', bgClass: '', updatedAt: '',
    items: [
      { id: 'a1', name: '銀行活存', amount: 300000 },
      { id: 'a2', name: '支付寶', amount: 150000 },
    ],
  },
  {
    id: 'investment', title: '投資', description: '', colorClass: '', bgClass: '', updatedAt: '',
    items: [
      { id: 'a3', name: '加密貨幣', amount: 100000 },
    ],
  },
];

describe('resolveCurrentAmount', () => {
  it('returns currentAmount when linkedAssetItemIds is undefined', () => {
    const goal = mkGoal({ currentAmount: 50000 });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(50000);
  });

  it('returns currentAmount when linkedAssetItemIds is empty array', () => {
    const goal = mkGoal({ currentAmount: 50000, linkedAssetItemIds: [] });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(50000);
  });

  it('sums linked asset items when linkedAssetItemIds is set', () => {
    const goal = mkGoal({ linkedAssetItemIds: ['a1', 'a3'] });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(400000);
  });

  it('silently skips orphan ids', () => {
    const goal = mkGoal({ linkedAssetItemIds: ['a1', 'orphan-id'] });
    expect(resolveCurrentAmount(goal, mkAssets())).toBe(300000);
  });
});

describe('getLinkedItemIds', () => {
  it('returns ids linked by a single goal', () => {
    const goals = [mkGoal({ id: 'g1', linkedAssetItemIds: ['a1', 'a2'] })];
    expect(getLinkedItemIds(goals)).toEqual(new Set(['a1', 'a2']));
  });

  it('excludes ids from the specified goal', () => {
    const goals = [mkGoal({ id: 'g1', linkedAssetItemIds: ['a1', 'a2'] })];
    expect(getLinkedItemIds(goals, 'g1')).toEqual(new Set());
  });

  it('aggregates ids from multiple goals excluding specified', () => {
    const goals = [
      mkGoal({ id: 'g1', linkedAssetItemIds: ['a1'] }),
      mkGoal({ id: 'g2', linkedAssetItemIds: ['a2', 'a3'] }),
    ];
    expect(getLinkedItemIds(goals, 'g1')).toEqual(new Set(['a2', 'a3']));
  });

  it('returns empty set when no goals have links', () => {
    const goals = [mkGoal({ id: 'g1' })];
    expect(getLinkedItemIds(goals)).toEqual(new Set());
  });
});

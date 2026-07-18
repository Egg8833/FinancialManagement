import { describe, it, expect } from 'vitest';
import { assetCategorySchema, liabilityItemSchema, assetSnapshotSchema } from './entitySchemas';

describe('entitySchemas', () => {
  it('接受合法 AssetCategory', () => {
    const ok = assetCategorySchema.safeParse({
      id: 'liquid', title: '流動資金', description: '現金', colorClass: 'bg-emerald-400',
      bgClass: 'bg-emerald-50', updatedAt: '剛剛',
      items: [{ id: 'l1', name: '活存', amount: 1000 }],
    });
    expect(ok.success).toBe(true);
  });

  it('拒絕 items 缺 amount 的 AssetCategory', () => {
    const bad = assetCategorySchema.safeParse({
      id: 'x', title: 't', description: '', colorClass: '', bgClass: '', updatedAt: '',
      items: [{ id: 'l1', name: '活存' }],
    });
    expect(bad.success).toBe(false);
  });

  it('接受合法 LiabilityItem 並拒絕非法 icon', () => {
    expect(liabilityItemSchema.safeParse({
      id: 'li1', name: '房貸', description: '', amount: 100, updatedAt: '', icon: 'building',
    }).success).toBe(true);
    expect(liabilityItemSchema.safeParse({
      id: 'li1', name: '房貸', description: '', amount: 100, updatedAt: '', icon: 'car',
    }).success).toBe(false);
  });

  it('接受含選填欄位的 AssetSnapshot', () => {
    expect(assetSnapshotSchema.safeParse({
      id: 's1', date: '2026-07-18', totalAssets: 1, totalLiabilities: 0, netWorth: 1,
      healthScore: 80, liquid: 1,
    }).success).toBe(true);
  });
});

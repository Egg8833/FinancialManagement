import { z } from 'zod';

export const assetItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
});

export const assetCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  colorClass: z.string(),
  bgClass: z.string(),
  updatedAt: z.string(),
  items: z.array(assetItemSchema),
});

export const liabilityItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  amount: z.number(),
  updatedAt: z.string(),
  icon: z.enum(['building', 'creditCard']),
});

export const assetSnapshotSchema = z.object({
  id: z.string(),
  date: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  healthScore: z.number().optional(),
  liquid: z.number().optional(),
  investment: z.number().optional(),
  fixed: z.number().optional(),
  receivable: z.number().optional(),
});

// 通用鍵值狀態：id 為設定鍵名，value 為任意形狀（陣列/物件/數字/字串/布林），
// 由前端各網域自行決定實際結構，伺服器端不做結構化驗證，只驗證外層包裝。
export const appStateEntrySchema = z.object({
  id: z.string(),
  value: z.unknown(),
});

export const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#94a3b8',
] as const;

export const UNCATEGORIZED_COLOR = '#d1d5db';

type MinimalItem = { customCategory?: string; amount: number };

export function buildDonutData(
  expenseItems: MinimalItem[]
): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  for (const item of expenseItems) {
    const cat = item.customCategory ?? '未分類';
    map[cat] = (map[cat] ?? 0) + item.amount;
  }
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildCategoryMonthData(
  expenseItems: MinimalItem[],
  referenceDate: Date = new Date()
): Record<string, number | string>[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11 + i, 1);
    const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row: Record<string, number | string> = { label };
    for (const item of expenseItems) {
      const cat = item.customCategory ?? '未分類';
      row[cat] = ((row[cat] as number) ?? 0) + item.amount;
    }
    return row;
  });
}

export function getCategoryColor(cat: string, categories: string[]): string {
  const idx = categories.indexOf(cat);
  return idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : UNCATEGORIZED_COLOR;
}

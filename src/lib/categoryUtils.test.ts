import { describe, it, expect } from 'vitest';
import {
  buildDonutData,
  buildCategoryMonthData,
  getCategoryColor,
  CATEGORY_COLORS,
  UNCATEGORIZED_COLOR,
} from './categoryUtils';

describe('buildDonutData', () => {
  it('groups expenses by customCategory and sorts by value desc', () => {
    const items = [
      { customCategory: '餐飲', amount: 5000 },
      { customCategory: '交通', amount: 2000 },
      { customCategory: '餐飲', amount: 3000 },
    ];
    const result = buildDonutData(items);
    expect(result).toEqual([
      { name: '餐飲', value: 8000 },
      { name: '交通', value: 2000 },
    ]);
  });

  it('groups items without customCategory as 未分類', () => {
    const items = [
      { amount: 1000 },
      { customCategory: undefined, amount: 2000 },
    ];
    const result = buildDonutData(items);
    expect(result).toEqual([{ name: '未分類', value: 3000 }]);
  });

  it('filters out zero-value categories', () => {
    const result = buildDonutData([]);
    expect(result).toEqual([]);
  });
});

describe('buildCategoryMonthData', () => {
  it('returns exactly 12 data points', () => {
    const result = buildCategoryMonthData([]);
    expect(result).toHaveLength(12);
  });

  it('each point has a label string', () => {
    const result = buildCategoryMonthData([]);
    result.forEach(r => expect(typeof r.label).toBe('string'));
  });

  it('accumulates same category amounts across items', () => {
    const items = [
      { customCategory: '餐飲', amount: 5000 },
      { customCategory: '餐飲', amount: 3000 },
    ];
    const result = buildCategoryMonthData(items);
    result.forEach(r => expect(r['餐飲']).toBe(8000));
  });

  it('groups uncategorised items as 未分類', () => {
    const items = [{ amount: 4000 }];
    const result = buildCategoryMonthData(items);
    result.forEach(r => expect(r['未分類']).toBe(4000));
  });
});

describe('getCategoryColor', () => {
  it('returns the correct indexed color for a known category', () => {
    const cats = ['餐飲', '交通'];
    expect(getCategoryColor('餐飲', cats)).toBe(CATEGORY_COLORS[0]);
    expect(getCategoryColor('交通', cats)).toBe(CATEGORY_COLORS[1]);
  });

  it('wraps around when index exceeds CATEGORY_COLORS length', () => {
    const cats = Array.from({ length: 12 }, (_, i) => `cat${i}`);
    expect(getCategoryColor('cat11', cats)).toBe(CATEGORY_COLORS[11 % CATEGORY_COLORS.length]);
  });

  it('returns UNCATEGORIZED_COLOR for unknown category', () => {
    expect(getCategoryColor('未知', [])).toBe(UNCATEGORIZED_COLOR);
    expect(getCategoryColor('未知', ['餐飲'])).toBe(UNCATEGORIZED_COLOR);
  });
});

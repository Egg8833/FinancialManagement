import { describe, it, expect } from 'vitest';
import { localDateStr, addMonthsToDateStr } from './dateUtils';

describe('localDateStr', () => {
  it('使用本地日期而非 UTC(台灣清晨 7 點仍是當天)', () => {
    // 本地時間 2026-03-10 07:00;在 UTC+8 時 toISOString 會是 03-09
    const d = new Date(2026, 2, 10, 7, 0, 0);
    expect(localDateStr(d)).toBe('2026-03-10');
  });

  it('月、日補零', () => {
    expect(localDateStr(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('addMonthsToDateStr', () => {
  it('一般日期加一個月', () => {
    expect(addMonthsToDateStr('2026-01-15', 1)).toBe('2026-02-15');
  });

  it('月底不溢位到下下個月(1/31 + 1 個月 = 2/28)', () => {
    expect(addMonthsToDateStr('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDateStr('2028-01-31', 1)).toBe('2028-02-29'); // 閏年
    expect(addMonthsToDateStr('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('跨年與減月', () => {
    expect(addMonthsToDateStr('2026-12-10', 1)).toBe('2027-01-10');
    expect(addMonthsToDateStr('2026-01-10', -1)).toBe('2025-12-10');
    expect(addMonthsToDateStr('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('不受執行環境時區影響(純字串運算)', () => {
    expect(addMonthsToDateStr('2026-05-01', 1)).toBe('2026-06-01');
  });
});

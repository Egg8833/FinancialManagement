import { describe, it, expect } from 'vitest';
import { parseSymbols, isValidSymbol, MAX_SYMBOLS } from './symbolValidation';

describe('symbol 驗證', () => {
  it('接受常見代號格式', () => {
    for (const s of ['2330.TW', '6488.TWO', 'AAPL', 'BRK-B', '^TWII', 'BTC-USD', 'EURUSD=X']) {
      expect(isValidSymbol(s)).toBe(true);
    }
  });

  it('拒絕異常字元與過長字串', () => {
    expect(isValidSymbol('<script>')).toBe(false);
    expect(isValidSymbol('A'.repeat(21))).toBe(false);
    expect(isValidSymbol('')).toBe(false);
  });

  it('parseSymbols 去除空白、去重', () => {
    expect(parseSymbols(' AAPL, 2330.TW ,AAPL,,')).toEqual({ ok: true, symbols: ['AAPL', '2330.TW'] });
  });

  it('parseSymbols 拒絕無效代號', () => {
    expect(parseSymbols('AAPL,<x>').ok).toBe(false);
  });

  it(`parseSymbols 拒絕超過 ${MAX_SYMBOLS} 個代號`, () => {
    const many = Array.from({ length: MAX_SYMBOLS + 1 }, (_, i) => `S${i}`).join(',');
    expect(parseSymbols(many).ok).toBe(false);
  });
});

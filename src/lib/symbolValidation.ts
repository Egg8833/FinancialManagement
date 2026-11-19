/** 單次報價請求最多可查詢的代號數量 */
export const MAX_SYMBOLS = 50;

// Yahoo Finance 代號:英數字與 . - ^ = ,例如 2330.TW、BRK-B、^TWII、EURUSD=X
const SYMBOL_RE = /^[A-Za-z0-9.\-^=]{1,20}$/;

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_RE.test(symbol);
}

export function parseSymbols(param: string):
  | { ok: true; symbols: string[] }
  | { ok: false; error: string } {
  const symbols = [...new Set(param.split(',').map(s => s.trim()).filter(Boolean))];
  if (symbols.length === 0) return { ok: false, error: 'Missing symbols' };
  if (symbols.length > MAX_SYMBOLS) return { ok: false, error: `Too many symbols (max ${MAX_SYMBOLS})` };
  const bad = symbols.find(s => !isValidSymbol(s));
  if (bad) return { ok: false, error: 'Invalid symbol' };
  return { ok: true, symbols };
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

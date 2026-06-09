export type Market = '台股' | '美股' | '其他';

export const LOT_SIZE = 1000;

export function sharesToUnit(shares: number, market: Market): { value: number; unit: string } {
  if (market === '台股') return { value: shares / LOT_SIZE, unit: '張' };
  return { value: shares, unit: '股' };
}

export function unitToShares(lots: number, market: Market): number {
  return market === '台股' ? lots * LOT_SIZE : lots;
}

export function getMarket(symbol: string): Market {
  if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) return '台股';
  return '美股';
}

export function toSymbol(raw: string, market: Market): string {
  const upper = raw.trim().toUpperCase();
  if (market === '台股' && upper && !upper.includes('.')) return upper + '.TW';
  return upper;
}

export const MARKET_GRADIENT: Record<Market, string> = {
  '台股': 'from-emerald-400 to-emerald-600',
  '美股': 'from-blue-400 to-blue-600',
  '其他': 'from-orange-400 to-orange-500',
};

export const MARKET_BADGE: Record<Market, string> = {
  '台股': 'bg-emerald-100 text-emerald-700',
  '美股': 'bg-blue-100 text-blue-700',
  '其他': 'bg-orange-100 text-orange-700',
};

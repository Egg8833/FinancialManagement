import type { StakingItem, StockItem, StockQuote } from '../types';

export interface PledgeRatio {
  platform: string;
  ratio: number;
  borrowValue: number;
  collateralValue: number;
}

export function computePledgeRatios(
  stakingItems: StakingItem[],
  stockItems: StockItem[],
  stockQuotes: Record<string, StockQuote>,
  usdToTwd: number,
): PledgeRatio[] {
  const borrowStaking = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const borrowByPlatform: Record<string, StakingItem[]> = {};
  for (const item of borrowStaking) {
    const p = (item.protocol || '未分類').trim();
    if (!borrowByPlatform[p]) borrowByPlatform[p] = [];
    borrowByPlatform[p].push(item);
  }

  const collateralByPlatform: Record<string, number> = {};
  for (const item of stockItems) {
    if (!item.collateralShares) continue;
    const quote = stockQuotes[item.symbol];
    if (!quote) continue;
    const value = quote.price * item.collateralShares;
    const twdValue = quote.currency === 'USD' ? value * usdToTwd : value;
    const p = (item.platform || '未分類').trim();
    collateralByPlatform[p] = (collateralByPlatform[p] || 0) + twdValue;
  }

  return Object.keys(borrowByPlatform).map(platform => {
    const items = borrowByPlatform[platform];
    const borrowValue = items.reduce((s, i) => s + i.value, 0);
    const collateralValue = collateralByPlatform[platform] || 0;
    const ratio = borrowValue > 0 ? (collateralValue / borrowValue) * 100 : 0;
    return { platform, ratio, borrowValue, collateralValue };
  });
}

export interface PledgeAlert {
  level: 'warning' | 'danger';
  platform: string;
  ratio: number;
}

/** 寄信觸發門檻:< 167% danger,< 200% warning。多平台時取維持率最低者。 */
export function getPledgeAlertLevel(ratios: PledgeRatio[]): PledgeAlert | null {
  let min = Infinity;
  let minPlatform = '';
  for (const r of ratios) {
    if (r.borrowValue > 0 && r.ratio < min) {
      min = r.ratio;
      minPlatform = r.platform;
    }
  }
  if (min === Infinity || !minPlatform) return null;
  if (min < 167) return { level: 'danger', platform: minPlatform, ratio: min };
  if (min < 200) return { level: 'warning', platform: minPlatform, ratio: min };
  return null;
}

export interface ReportPledgeRatio {
  platform: string;
  ratio: number;
  totalBorrowValue: number;
  totalCollateralValueTWD: number;
  buffer: number;
  shortage: number;
  isRed: boolean;
  isYellow: boolean;
}

/** 報表顯示門檻:< 130% isRed(已達追繳線),130%~166% isYellow(警戒),與 getPledgeAlertLevel 的寄信門檻(167/200)是兩套獨立標準,皆為既有行為。 */
export function buildReportPledgeRatios(ratios: PledgeRatio[]): ReportPledgeRatio[] {
  return ratios.map(r => {
    const isRed = r.ratio < 130;
    const isYellow = r.ratio >= 130 && r.ratio < 166;
    const buffer = Math.round(r.collateralValue - r.borrowValue * 1.30);
    const shortage = Math.round(r.borrowValue * 1.30 - r.collateralValue);
    return {
      platform: r.platform,
      ratio: r.ratio,
      totalBorrowValue: r.borrowValue,
      totalCollateralValueTWD: Math.round(r.collateralValue),
      buffer,
      shortage,
      isRed,
      isYellow,
    };
  });
}

import type { StakingItem, StockItem, StockQuote } from '../types';

/**
 * 質押維持率門檻(全站唯一標準):畫面、報表、模擬器、橫幅、每日警示信都使用這兩條線。
 * 低於追繳線 → 追繳(danger);追繳線 ~ 警戒線 → 警戒(warn);其餘安全。
 */
export const PLEDGE_CALL_RATIO = 130;
export const PLEDGE_WARN_RATIO = 166;

export type PledgeStatus = 'safe' | 'warn' | 'danger';

export function pledgeStatusOf(ratio: number): PledgeStatus {
  if (ratio < PLEDGE_CALL_RATIO) return 'danger';
  if (ratio < PLEDGE_WARN_RATIO) return 'warn';
  return 'safe';
}

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

/**
 * 警示等級:低於追繳線 danger、低於警戒線 warning(與畫面同一套門檻)。
 * 多平台時取維持率最低者;未設定擔保品(市值 0,多為尚未設定或無報價)的平台不列入,
 * 以免 0% 遮蔽其他平台真正的警示。
 */
export function getPledgeAlertLevel(ratios: PledgeRatio[]): PledgeAlert | null {
  let min = Infinity;
  let minPlatform = '';
  for (const r of ratios) {
    if (r.borrowValue > 0 && r.collateralValue > 0 && r.ratio < min) {
      min = r.ratio;
      minPlatform = r.platform;
    }
  }
  if (min === Infinity || !minPlatform) return null;
  const status = pledgeStatusOf(min);
  if (status === 'danger') return { level: 'danger', platform: minPlatform, ratio: min };
  if (status === 'warn') return { level: 'warning', platform: minPlatform, ratio: min };
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

/** 報表用:isRed = 低於追繳線,isYellow = 警戒區間(與 getPledgeAlertLevel 同一套門檻)。 */
export function buildReportPledgeRatios(ratios: PledgeRatio[]): ReportPledgeRatio[] {
  return ratios.map(r => {
    const status = pledgeStatusOf(r.ratio);
    const isRed = status === 'danger';
    const isYellow = status === 'warn';
    const callLine = r.borrowValue * (PLEDGE_CALL_RATIO / 100);
    const buffer = Math.round(r.collateralValue - callLine);
    const shortage = Math.round(callLine - r.collateralValue);
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

/* ===== 維持率模擬(跌幅 + 手動還款 + 補繳擔保品) ===== */

export interface PledgeAdjustment {
  /** 擔保品市值下跌百分比(0~100)。 */
  dropPct?: number;
  /** 手動還款金額 TWD,直接減少借款餘額。 */
  repayAmount?: number;
  /** 補繳擔保品市值 TWD,於下跌之後才匯入,故不受 dropPct 影響。 */
  addCollateral?: number;
}

export interface PledgeSimResult {
  collateralValue: number;
  borrowValue: number;
  ratio: number;
  buffer: number;
  shortage: number;
  status: PledgeStatus;
  /** 借款已全部還清(借款餘額為 0),此時 ratio 無意義,固定為 0。 */
  isCleared: boolean;
}

const clampNonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * 以跌幅、手動還款、補繳擔保品三個變數模擬維持率。
 * 還款金額超過借款餘額時以借款餘額為上限(不會算出負債)。
 */
export function simulatePledge(
  collateralValue: number,
  borrowValue: number,
  adj: PledgeAdjustment = {},
): PledgeSimResult {
  const dropPct = Math.min(Math.max(adj.dropPct ?? 0, 0), 100);
  const repay = Math.min(clampNonNegative(adj.repayAmount ?? 0), clampNonNegative(borrowValue));
  const add = clampNonNegative(adj.addCollateral ?? 0);

  const collateral = clampNonNegative(collateralValue) * (1 - dropPct / 100) + add;
  const borrow = clampNonNegative(borrowValue) - repay;

  if (borrow <= 0) {
    return { collateralValue: collateral, borrowValue: 0, ratio: 0, buffer: Math.round(collateral), shortage: 0, status: 'safe', isCleared: true };
  }

  const ratio = (collateral / borrow) * 100;
  const callLine = borrow * (PLEDGE_CALL_RATIO / 100);
  return {
    collateralValue: collateral,
    borrowValue: borrow,
    ratio,
    buffer: Math.round(collateral - callLine),
    shortage: Math.round(callLine - collateral),
    status: pledgeStatusOf(ratio),
    isCleared: false,
  };
}

/** 要把維持率拉到 targetRatio,需手動還款多少 TWD(已達標回 0)。 */
export function repaymentForTargetRatio(collateralValue: number, borrowValue: number, targetRatio: number): number {
  if (borrowValue <= 0 || targetRatio <= 0) return 0;
  const targetBorrow = clampNonNegative(collateralValue) / (targetRatio / 100);
  return Math.max(0, Math.ceil(borrowValue - targetBorrow));
}

/** 要把維持率拉到 targetRatio,需補繳多少市值的擔保品 TWD(已達標回 0)。 */
export function collateralForTargetRatio(collateralValue: number, borrowValue: number, targetRatio: number): number {
  if (borrowValue <= 0 || targetRatio <= 0) return 0;
  return Math.max(0, Math.ceil(borrowValue * (targetRatio / 100) - clampNonNegative(collateralValue)));
}

/** 擔保品還能跌幾 % 才碰到 targetRatio(已低於則回 0)。 */
export function dropPctToRatio(collateralValue: number, borrowValue: number, targetRatio: number): number {
  if (collateralValue <= 0 || borrowValue <= 0) return 0;
  const floor = borrowValue * (targetRatio / 100);
  return Math.max(0, (1 - floor / collateralValue) * 100);
}

export interface PledgeAccount {
  platform: string;
  collateralValue: number;
  borrowValue: number;
}

export interface PortfolioSimAccount extends PledgeAccount {
  before: PledgeSimResult;
  after: PledgeSimResult;
  /** 套用此帳戶的還款/補繳後,擔保品還能跌幾 % 才碰到追繳線(已還清為 100)。 */
  dropPctToCall: number;
}

export interface PortfolioSimResult {
  accounts: PortfolioSimAccount[];
  /** 把所有帳戶的擔保品與借款加總後的合併維持率(僅供參考,各平台不可互相抵充)。 */
  total: { before: PledgeSimResult; after: PledgeSimResult };
  /** 模擬後維持率最低的帳戶。 */
  worst: PortfolioSimAccount | null;
  /** 模擬後落入追繳區的平台。 */
  breached: string[];
  /** 模擬後所有帳戶合計需補的缺口 TWD。 */
  totalShortage: number;
  /** 有借款但未設定擔保品(市值 0)的平台,無法模擬,不納入上述計算。 */
  unconfigured: string[];
}

/** 套用還款/補繳(補繳視為跌幅後才匯入)時,擔保品還能跌幾 % 才碰到 targetRatio。 */
function dropPctToRatioAdjusted(a: PledgeAccount, adj: PledgeAdjustment, targetRatio: number): number {
  const borrow = clampNonNegative(a.borrowValue) - Math.min(clampNonNegative(adj.repayAmount ?? 0), clampNonNegative(a.borrowValue));
  if (borrow <= 0) return 100;
  if (a.collateralValue <= 0) return 0;
  const floor = borrow * (targetRatio / 100);
  const pct = ((a.collateralValue + clampNonNegative(adj.addCollateral ?? 0) - floor) / a.collateralValue) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * 多帳戶一起下跌同一個百分比時,各帳戶與合併的維持率變化。
 * adjustments 可針對個別平台再加上手動還款 / 補繳擔保品。
 */
export function simulatePortfolio(
  accounts: PledgeAccount[],
  dropPct: number,
  adjustments: Record<string, PledgeAdjustment> = {},
): PortfolioSimResult {
  const withBorrow = accounts.filter(a => a.borrowValue > 0);
  const unconfigured = withBorrow.filter(a => a.collateralValue <= 0).map(a => a.platform);
  const rows: PortfolioSimAccount[] = withBorrow
    .filter(a => a.collateralValue > 0)
    .map(a => {
      const adj = adjustments[a.platform] ?? {};
      const before = simulatePledge(a.collateralValue, a.borrowValue);
      const after = simulatePledge(a.collateralValue, a.borrowValue, { ...adj, dropPct });
      return {
        ...a,
        before,
        after,
        dropPctToCall: dropPctToRatioAdjusted(a, adj, PLEDGE_CALL_RATIO),
      };
    });

  const sumCollateral = rows.reduce((s, r) => s + r.collateralValue, 0);
  const sumBorrow = rows.reduce((s, r) => s + r.borrowValue, 0);
  // 每個帳戶的還款以該帳戶借款為上限(= 模擬前後借款餘額差),避免高估合併維持率
  const sumRepay = rows.reduce((s, r) => s + (r.before.borrowValue - r.after.borrowValue), 0);
  const sumAdd = rows.reduce((s, r) => s + clampNonNegative(adjustments[r.platform]?.addCollateral ?? 0), 0);

  const worst = rows
    .filter(r => !r.after.isCleared)
    .reduce<PortfolioSimAccount | null>((min, r) => (!min || r.after.ratio < min.after.ratio ? r : min), null);

  return {
    accounts: rows,
    total: {
      before: simulatePledge(sumCollateral, sumBorrow),
      after: simulatePledge(sumCollateral, sumBorrow, { dropPct, repayAmount: sumRepay, addCollateral: sumAdd }),
    },
    worst,
    breached: rows.filter(r => r.after.status === 'danger' && !r.after.isCleared).map(r => r.platform),
    totalShortage: rows.reduce((s, r) => s + Math.max(0, r.after.shortage), 0),
    unconfigured,
  };
}

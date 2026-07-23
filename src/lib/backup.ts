import type {
  AssetCategory, LiabilityItem, AssetSnapshot, StakingItem, LoanItem,
  StockItem, SoldStockItem, MonthRecord, CashflowTemplate, AnnualEntry,
} from '../types';

export const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  exportedAt: string;
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  snapshots: AssetSnapshot[];
  stakingItems: StakingItem[];
  loans: LoanItem[];
  stockItems: StockItem[];
  soldStocks: SoldStockItem[];
  monthlyRecords: Record<string, MonthRecord>;
  cashflowTemplate: CashflowTemplate;
  annualEntries: AnnualEntry[];
  borrowingLimits: Record<string, number>;
  customCategories: string[];
  netWorthGoal: number;
  usdToTwd: number;
  userName: string;
  userEmail: string;
}

export type BuildBackupInput = Omit<BackupData, 'version' | 'exportedAt'>;

export function buildBackup(input: BuildBackupInput): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...input,
  };
}

export interface ApplyBackupSetters {
  replaceAssets: (v: AssetCategory[]) => Promise<void>;
  replaceLiabilities: (v: LiabilityItem[]) => Promise<void>;
  replaceSnapshots: (v: AssetSnapshot[]) => Promise<void>;
  setStakingItems: (v: StakingItem[]) => void;
  setLoans: (v: LoanItem[]) => void;
  setStockItems: (v: StockItem[]) => void;
  setSoldStocks: (v: SoldStockItem[]) => void;
  setMonthlyRecords: (v: Record<string, MonthRecord>) => void;
  setCashflowTemplate: (v: CashflowTemplate) => void;
  setAnnualEntries: (v: AnnualEntry[]) => void;
  setBorrowingLimits: (v: Record<string, number>) => void;
  setCustomCategories: (v: string[]) => void;
  setNetWorthGoal: (v: number) => void;
  setUsdToTwd: (v: number) => void;
  setUserName: (v: string) => void;
  setUserEmail: (v: string) => void;
}

export interface ApplyBackupOptions {
  /** 登入 Google 帳號時姓名/信箱以帳號為準，備份檔內容不應覆寫（預設 true） */
  allowIdentityOverride?: boolean;
}

export interface ApplyBackupResult {
  hasCloudFailure: boolean;
}

const isArray = Array.isArray;

/**
 * 套用一份已 JSON.parse 的備份物件（未知結構，需逐欄位防呆）。
 * 資產／負債／快照為雲端網域，非同步寫入並以 Promise.allSettled 統計是否有失敗；
 * 其餘欄位皆為本機 localStorage 網域，同步寫入。
 */
export async function applyBackup(
  data: Record<string, unknown>,
  setters: ApplyBackupSetters,
  options: ApplyBackupOptions = {},
): Promise<ApplyBackupResult> {
  const { allowIdentityOverride = true } = options;
  const cloudWrites: Promise<void>[] = [];

  if (isArray(data.assets))      cloudWrites.push(setters.replaceAssets(data.assets as AssetCategory[]));
  if (isArray(data.liabilities)) cloudWrites.push(setters.replaceLiabilities(data.liabilities as LiabilityItem[]));
  if (isArray(data.snapshots))   cloudWrites.push(setters.replaceSnapshots(data.snapshots as AssetSnapshot[]));

  if (isArray(data.stakingItems)) setters.setStakingItems(data.stakingItems as StakingItem[]);
  if (isArray(data.loans))        setters.setLoans(data.loans as LoanItem[]);
  if (isArray(data.stockItems))   setters.setStockItems(data.stockItems as StockItem[]);
  if (isArray(data.soldStocks))   setters.setSoldStocks(data.soldStocks as SoldStockItem[]);
  if (data.monthlyRecords && typeof data.monthlyRecords === 'object') {
    setters.setMonthlyRecords(data.monthlyRecords as Record<string, MonthRecord>);
  }
  if (data.cashflowTemplate) {
    setters.setCashflowTemplate(data.cashflowTemplate as CashflowTemplate);
  } else if (isArray(data.incomeItems) && isArray(data.expenseItems)) {
    // 向後相容：舊版備份把現金流模板存成獨立的 incomeItems/expenseItems
    setters.setCashflowTemplate({
      income: data.incomeItems as CashflowTemplate['income'],
      expense: data.expenseItems as CashflowTemplate['expense'],
    });
  }
  if (isArray(data.annualEntries)) setters.setAnnualEntries(data.annualEntries as AnnualEntry[]);
  if (data.borrowingLimits != null) setters.setBorrowingLimits(data.borrowingLimits as Record<string, number>);
  if (isArray(data.customCategories)) setters.setCustomCategories(data.customCategories as string[]);
  if (typeof data.netWorthGoal === 'number') setters.setNetWorthGoal(data.netWorthGoal);
  if (typeof data.usdToTwd === 'number') setters.setUsdToTwd(data.usdToTwd);

  if (allowIdentityOverride) {
    if (typeof data.userName === 'string' && data.userName) setters.setUserName(data.userName);
    if (typeof data.userEmail === 'string' && data.userEmail) setters.setUserEmail(data.userEmail);
  }

  const results = await Promise.allSettled(cloudWrites);
  return { hasCloudFailure: results.some(r => r.status === 'rejected') };
}

import { describe, it, expect, vi } from 'vitest';
import { buildBackup, applyBackup, BACKUP_VERSION, type ApplyBackupSetters, type BuildBackupInput } from './backup';

const baseInput: BuildBackupInput = {
  assets: [{ id: 'a1', title: '流動', description: '', colorClass: '', bgClass: '', updatedAt: '', items: [{ id: 'i1', name: '現金', amount: 100 }] }],
  liabilities: [{ id: 'l1', name: '信用卡', description: '', amount: 50, updatedAt: '', icon: 'creditCard' }],
  snapshots: [{ id: 's1', date: '2026-07-18', totalAssets: 100, totalLiabilities: 50, netWorth: 50 }],
  stakingItems: [],
  loans: [],
  stockItems: [],
  soldStocks: [{ id: 'sold1', symbol: 'AAPL', platform: '', shares: 1, avgCost: 1, collateralShares: 0, soldDate: '2026-01-01', soldPrice: 2, soldShares: 1 } as unknown as BuildBackupInput['soldStocks'][number]],
  monthlyRecords: {},
  cashflowTemplate: { income: [], expense: [] },
  annualEntries: [],
  borrowingLimits: {},
  customCategories: ['自訂分類'],
  netWorthGoal: 1000,
  usdToTwd: 32,
  userName: '小明',
  userEmail: 'a@b.com',
};

function makeSetters(): ApplyBackupSetters {
  return {
    replaceAssets: vi.fn().mockResolvedValue(undefined),
    replaceLiabilities: vi.fn().mockResolvedValue(undefined),
    replaceSnapshots: vi.fn().mockResolvedValue(undefined),
    setStakingItems: vi.fn(),
    setLoans: vi.fn(),
    setStockItems: vi.fn(),
    setSoldStocks: vi.fn(),
    setMonthlyRecords: vi.fn(),
    setCashflowTemplate: vi.fn(),
    setAnnualEntries: vi.fn(),
    setBorrowingLimits: vi.fn(),
    setCustomCategories: vi.fn(),
    setNetWorthGoal: vi.fn(),
    setUsdToTwd: vi.fn(),
    setUserName: vi.fn(),
    setUserEmail: vi.fn(),
  };
}

describe('buildBackup', () => {
  it('附上 version 與 exportedAt，並保留所有輸入欄位（含 soldStocks）', () => {
    const backup = buildBackup(baseInput);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(typeof backup.exportedAt).toBe('string');
    expect(backup.soldStocks).toEqual(baseInput.soldStocks);
    expect(backup.customCategories).toEqual(['自訂分類']);
    expect(backup.userName).toBe('小明');
  });
});

describe('applyBackup', () => {
  it('round-trip：build 產生的備份可完整套用回所有欄位', async () => {
    const backup = buildBackup(baseInput);
    const setters = makeSetters();
    const { hasCloudFailure } = await applyBackup(backup as unknown as Record<string, unknown>, setters);

    expect(hasCloudFailure).toBe(false);
    expect(setters.replaceAssets).toHaveBeenCalledWith(backup.assets);
    expect(setters.replaceLiabilities).toHaveBeenCalledWith(backup.liabilities);
    expect(setters.replaceSnapshots).toHaveBeenCalledWith(backup.snapshots);
    expect(setters.setSoldStocks).toHaveBeenCalledWith(backup.soldStocks);
    expect(setters.setCustomCategories).toHaveBeenCalledWith(backup.customCategories);
    expect(setters.setUserName).toHaveBeenCalledWith('小明');
    expect(setters.setUserEmail).toHaveBeenCalledWith('a@b.com');
  });

  it('雲端寫入失敗時回報 hasCloudFailure', async () => {
    const backup = buildBackup(baseInput);
    const setters = makeSetters();
    vi.mocked(setters.replaceAssets).mockRejectedValue(new Error('網路錯誤'));

    const { hasCloudFailure } = await applyBackup(backup as unknown as Record<string, unknown>, setters);
    expect(hasCloudFailure).toBe(true);
  });

  it('allowIdentityOverride: false 時不覆寫姓名/信箱（登入 Google 帳號情境）', async () => {
    const backup = buildBackup(baseInput);
    const setters = makeSetters();
    await applyBackup(backup as unknown as Record<string, unknown>, setters, { allowIdentityOverride: false });

    expect(setters.setUserName).not.toHaveBeenCalled();
    expect(setters.setUserEmail).not.toHaveBeenCalled();
    // 非身分欄位仍正常套用
    expect(setters.setNetWorthGoal).toHaveBeenCalledWith(1000);
  });

  it('向後相容：舊版備份用 incomeItems/expenseItems 而非 cashflowTemplate', async () => {
    const legacyData = {
      assets: [],
      incomeItems: [{ id: 'inc1', name: '薪資', amount: 50000 }],
      expenseItems: [{ id: 'exp1', name: '房租', amount: 15000 }],
    };
    const setters = makeSetters();
    await applyBackup(legacyData, setters);

    expect(setters.setCashflowTemplate).toHaveBeenCalledWith({
      income: legacyData.incomeItems,
      expense: legacyData.expenseItems,
    });
  });

  it('缺漏或型別錯誤的欄位不會呼叫對應 setter，也不會拋錯', async () => {
    const setters = makeSetters();
    const { hasCloudFailure } = await applyBackup({ assets: 'not-an-array', usdToTwd: 'not-a-number' }, setters);

    expect(hasCloudFailure).toBe(false);
    expect(setters.replaceAssets).not.toHaveBeenCalled();
    expect(setters.setUsdToTwd).not.toHaveBeenCalled();
  });
});

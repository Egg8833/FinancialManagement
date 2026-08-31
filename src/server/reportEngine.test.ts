import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/quoteService', () => ({
  getQuotes: vi.fn(),
}));

// entityStore.ts -> apiHelpers.ts imports ../auth (next-auth), which fails to resolve
// under vitest's module graph; mock it out as entityStore.test.ts already does.
vi.mock('../auth', () => ({
  auth: vi.fn(),
}));

import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { assets, liabilities, appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { getQuotes } from '../lib/quoteService';
import { computeUserReport } from './reportEngine';

const assetsStore = createEntityStore(assets);
const liabilitiesStore = createEntityStore(liabilities);
const appStateStore = createEntityStore(appState);

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await createTestUser(db, 'u1');
  vi.mocked(getQuotes).mockReset();
});

describe('computeUserReport', () => {
  it('沒有任何資產/負債/股票時,回傳全 0 的報表且無質押警示', async () => {
    const result = await computeUserReport(db, 'u1');
    expect(result.reportPayload.totalAssets).toBe(0);
    expect(result.reportPayload.totalLiabilities).toBe(0);
    expect(result.pledgeAlert).toBeNull();
    expect(result.reportSchedule).toBe('none');
    expect(result.lastReportSent).toBe('');
  });

  it('組合資產、負債、股票市值、質押警示,結果與前端計算一致', async () => {
    await assetsStore.create(db, 'u1', 'investment', {
      id: 'investment', title: '投資', description: '', colorClass: '', bgClass: '', updatedAt: '', items: [],
    });
    await liabilitiesStore.create(db, 'u1', 'l1', {
      id: 'l1', name: '房貸', description: '', amount: 2000000, updatedAt: '', icon: 'building',
    });
    await appStateStore.create(db, 'u1', 'stockItems', {
      id: 'stockItems',
      value: [{ id: 'st1', symbol: '2330.TW', shares: 1000, avgCost: 500, collateralShares: 1000, platform: '元大' }],
    });
    await appStateStore.create(db, 'u1', 'stakingItems', {
      id: 'stakingItems',
      value: [{ id: 's1', name: '借款A', protocol: '元大', amount: 1000000, value: 1000000, apy: 2.5, stakingType: 'borrow' }],
    });
    await appStateStore.create(db, 'u1', 'usdToTwd', { id: 'usdToTwd', value: 32 });
    await appStateStore.create(db, 'u1', 'reportSchedule', { id: 'reportSchedule', value: 'weekly' });
    await appStateStore.create(db, 'u1', 'enablePledgeTracking', { id: 'enablePledgeTracking', value: true });

    vi.mocked(getQuotes).mockResolvedValue({
      data: { '2330.TW': { price: 1500, changePercent: 1, currency: 'TWD', shortName: '台積電' } },
      stale: false,
    });

    const result = await computeUserReport(db, 'u1');

    // 股票市值 1000 * 1500 = 1,500,000,投資分類附加「自動化股票投資」
    expect(result.reportPayload.totalAssets).toBe(1_500_000);
    // 負債 = 房貸 2,000,000 + 質押借款 1,000,000
    expect(result.reportPayload.totalLiabilities).toBe(3_000_000);
    expect(result.reportSchedule).toBe('weekly');
    // 擔保品市值 1,500,000 / 借款 1,000,000 * 100 = 150% < 167% → danger,且已開啟 enablePledgeTracking
    expect(result.pledgeAlert).toMatchObject({ level: 'danger', platform: '元大', ratio: 150 });
  });

  it('enablePledgeTracking 為預設值 false(未開啟)時,即使維持率會觸發 danger 也不回傳 pledgeAlert', async () => {
    await assetsStore.create(db, 'u1', 'investment', {
      id: 'investment', title: '投資', description: '', colorClass: '', bgClass: '', updatedAt: '', items: [],
    });
    await liabilitiesStore.create(db, 'u1', 'l1', {
      id: 'l1', name: '房貸', description: '', amount: 2000000, updatedAt: '', icon: 'building',
    });
    await appStateStore.create(db, 'u1', 'stockItems', {
      id: 'stockItems',
      value: [{ id: 'st1', symbol: '2330.TW', shares: 1000, avgCost: 500, collateralShares: 1000, platform: '元大' }],
    });
    await appStateStore.create(db, 'u1', 'stakingItems', {
      id: 'stakingItems',
      value: [{ id: 's1', name: '借款A', protocol: '元大', amount: 1000000, value: 1000000, apy: 2.5, stakingType: 'borrow' }],
    });
    await appStateStore.create(db, 'u1', 'usdToTwd', { id: 'usdToTwd', value: 32 });
    await appStateStore.create(db, 'u1', 'reportSchedule', { id: 'reportSchedule', value: 'weekly' });
    // enablePledgeTracking 未設定 → 預設 false(與前端 SettingsContext 預設值一致)

    vi.mocked(getQuotes).mockResolvedValue({
      data: { '2330.TW': { price: 1500, changePercent: 1, currency: 'TWD', shortName: '台積電' } },
      stale: false,
    });

    const result = await computeUserReport(db, 'u1');

    // 維持率仍為 150% < 167%,但 enablePledgeTracking 關閉時不應寄出警示信
    expect(result.pledgeAlert).toBeNull();
    // 報表本身的質押資料不受影響,徽章顯示邏輯獨立於寄信開關
    expect(result.reportPayload.pledgeRatioData).toEqual([
      expect.objectContaining({ platform: '元大', ratio: 150 }),
    ]);
  });

  it('沒有持股時完全不呼叫 getQuotes', async () => {
    await computeUserReport(db, 'u1');
    expect(getQuotes).not.toHaveBeenCalled();
  });
});

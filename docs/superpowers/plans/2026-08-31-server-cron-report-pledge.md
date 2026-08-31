# 資產報表排程 / 質押警示改伺服器 Cron 觸發 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「資產報表排程寄送」與「質押維持率警示」從前端 `useEffect`(依賴使用者開網頁才觸發)改成 Vercel Cron 每天自動執行一次,伺服器端獨立重算資料並寄信。

**Architecture:** 不新增資料表。抽出前端 Context 內嵌的計算邏輯(資產彙總、月收支、質押比)為 `src/lib/` 下的純函式,前端與新的伺服器模組共用;新增 `src/server/reportEngine.ts`(單一使用者的資料讀取 + 計算)與 `src/server/dailyCheck.ts`(逐使用者迴圈 + 寄信 + 寫回狀態的邏輯,以依賴注入方式可測),`src/app/api/cron/daily-check/route.ts` 只是薄薄一層,注入真正的 db/寄信函式並做 `CRON_SECRET` 驗證。

**Tech Stack:** Next.js App Router、Drizzle ORM(neon-http)、Vitest + `@electric-sql/pglite`(既有 test db 模式)、yahoo-finance2、nodemailer。

**Spec:** [docs/superpowers/specs/2026-08-31-server-cron-report-pledge-design.md](../specs/2026-08-31-server-cron-report-pledge-design.md)

## Global Constraints

- Vercel **Hobby** 方案:cron 一天只觸發一次,function 執行時間預設 10 秒 —— 本計畫在 cron route 明確設定 `export const maxDuration = 60;` 拿到 60 秒上限。
- 不新增資料表。收件信箱改用 `users.email`;`lastReportSent`/`pledgeAlertLastSent`/`reportSchedule` 都走既有 `appState` 表(id = 設定鍵名,`data = { id, value }`)。
- 前端與伺服器共用同一份純函式計算資產彙總/月收支/質押比,禁止在伺服器端重寫一份邏輯。
- 質押追蹤(`enablePledgeTracking`)在現行程式碼中已寫死為 `true`(見 `SettingsContext.tsx:67`),伺服器端不需要額外判斷這個開關。
- cron 端點用 `Authorization: Bearer ${CRON_SECRET}` 驗證,單一使用者處理失敗要 try/catch 隔離,不中斷整批。
- 純函式重構(Task 1-5)必須是行為不變的搬移,不得順手修改既有計算邏輯或格式化方式。

---

## Task 1: 抽出股價查詢為共用服務 `quoteService.ts`

**Files:**
- Create: `src/lib/quoteService.ts`
- Create: `src/lib/quoteService.test.ts`
- Modify: `src/app/api/quote/route.ts`

**Interfaces:**
- Produces: `QuoteResult` type(`Record<string, { price: number; changePercent: number; currency: string; shortName?: string }>`)、`getQuotes(symbols: string[]): Promise<{ data: QuoteResult; stale: boolean }>`(丟出原始錯誤,呼叫端自行決定如何回應)

- [ ] **Step 1: 寫 `src/lib/quoteService.ts` 的失敗測試**

```ts
// src/lib/quoteService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuote = vi.fn();
vi.mock('yahoo-finance2', () => ({
  default: vi.fn().mockImplementation(() => ({ quote: mockQuote })),
}));
vi.mock('./twse-names', () => ({
  getStockNameMap: vi.fn().mockResolvedValue(new Map([['2330', '台積電']])),
}));

import { getQuotes } from './quoteService';

beforeEach(() => {
  mockQuote.mockReset();
  vi.useRealTimers();
});

describe('getQuotes', () => {
  it('回傳 yahoo-finance2 的報價,台股代號用中文簡稱覆蓋 shortName', async () => {
    mockQuote.mockResolvedValue({
      '2330.TW': { regularMarketPrice: 600, regularMarketChangePercent: 1.2, currency: 'TWD', shortName: 'TSMC' },
    });
    const { data, stale } = await getQuotes(['2330.TW']);
    expect(stale).toBe(false);
    expect(data['2330.TW']).toEqual({ price: 600, changePercent: 1.2, currency: 'TWD', shortName: '台積電' });
  });

  it('60 秒內重複查同一組 symbols 會用快取,不再呼叫 yahoo-finance2', async () => {
    mockQuote.mockResolvedValue({
      AAPL: { regularMarketPrice: 200, regularMarketChangePercent: 0.5, currency: 'USD', shortName: 'Apple' },
    });
    await getQuotes(['AAPL']);
    await getQuotes(['AAPL']);
    expect(mockQuote).toHaveBeenCalledTimes(1);
  });

  it('查詢失敗但有舊快取時,回傳舊資料並標記 stale', async () => {
    mockQuote.mockResolvedValueOnce({
      MSFT: { regularMarketPrice: 300, regularMarketChangePercent: 0, currency: 'USD' },
    });
    await getQuotes(['MSFT']);
    mockQuote.mockRejectedValueOnce(new Error('network down'));
    const { data, stale } = await getQuotes(['MSFT']);
    expect(stale).toBe(true);
    expect(data.MSFT.price).toBe(300);
  });

  it('查詢失敗且無快取時,把錯誤往外丟', async () => {
    mockQuote.mockRejectedValue(new Error('boom'));
    await expect(getQuotes(['NFLX'])).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: 執行測試,確認因檔案不存在而失敗**

Run: `npm test -- src/lib/quoteService.test.ts`
Expected: FAIL,錯誤訊息為找不到模組 `./quoteService`

- [ ] **Step 3: 建立 `src/lib/quoteService.ts`**

```ts
// src/lib/quoteService.ts
import YahooFinance from 'yahoo-finance2';
import { getStockNameMap } from './twse-names';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export type QuoteResult = Record<string, { price: number; changePercent: number; currency: string; shortName?: string }>;

const CACHE_TTL_MS = 60_000;
const quoteCache = new Map<string, { data: QuoteResult; expiresAt: number }>();
const inflightMap = new Map<string, Promise<QuoteResult>>();

async function fetchQuotes(symbols: string[]): Promise<QuoteResult> {
  const hasTW = symbols.some(s => s.endsWith('.TW') || s.endsWith('.TWO'));
  const nameMap = hasTW ? await getStockNameMap() : null;
  const quotes = await yf.quote(symbols, { return: 'object' });

  const result: QuoteResult = {};
  for (const [symbol, quote] of Object.entries(quotes)) {
    let shortName = quote.shortName ?? quote.longName ?? undefined;

    if (nameMap && (symbol.endsWith('.TW') || symbol.endsWith('.TWO'))) {
      const code = symbol.replace(/\.(TWO|TW)$/, '');
      const chineseName = nameMap.get(code);
      if (chineseName) shortName = chineseName;
    }

    result[symbol] = {
      price: quote.regularMarketPrice ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      currency: quote.currency ?? 'USD',
      shortName,
    };
  }
  return result;
}

/**
 * 60 秒快取 + 同批 symbols 進行中請求共用同一個 Promise。
 * 查詢失敗時若有舊快取,回傳舊資料並標記 stale:true;沒有快取則把錯誤往外丟。
 */
export async function getQuotes(symbols: string[]): Promise<{ data: QuoteResult; stale: boolean }> {
  const cacheKey = [...symbols].sort().join(',');

  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { data: cached.data, stale: false };
  }

  const existing = inflightMap.get(cacheKey);
  if (existing) {
    return { data: await existing, stale: false };
  }

  const fetchPromise = fetchQuotes(symbols);
  inflightMap.set(cacheKey, fetchPromise);

  try {
    const result = await fetchPromise;
    quoteCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return { data: result, stale: false };
  } catch (error) {
    const stale = quoteCache.get(cacheKey);
    if (stale) return { data: stale.data, stale: true };
    throw error;
  } finally {
    inflightMap.delete(cacheKey);
  }
}
```

- [ ] **Step 4: 執行測試,確認全部通過**

Run: `npm test -- src/lib/quoteService.test.ts`
Expected: PASS(4 個測試)

- [ ] **Step 5: 把 `src/app/api/quote/route.ts` 改成呼叫 `getQuotes`**

把整個檔案內容換成:

```ts
// src/app/api/quote/route.ts
import { NextResponse } from 'next/server';
import { getQuotes } from '../../../lib/quoteService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const { data, stale } = await getQuotes(symbols);
    return NextResponse.json(stale ? { ...data, _stale: true } : data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching quotes:', message);
    return NextResponse.json({ error: 'Failed to fetch quotes', details: message }, { status: 500 });
  }
}
```

- [ ] **Step 6: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS,無型別錯誤

- [ ] **Step 7: Commit**

```bash
git add src/lib/quoteService.ts src/lib/quoteService.test.ts src/app/api/quote/route.ts
git commit -m "refactor: 抽出股價查詢為共用 quoteService,供 API route 與日後 cron 共用"
```

---

## Task 2: 抽出質押警示信 HTML 產生器到 `mail.ts`

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/lib/mail.test.ts`(不存在則建立)
- Modify: `src/app/api/pledge-alert/route.ts`

**Interfaces:**
- Produces: `buildPledgeAlertHtml(data: { isDanger: boolean; platformName: string; ratio: number; pledgeData: { platform: string; ratio: number; borrowValue: number; collateralValue: number }[] }): string`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/mail.test.ts
import { describe, it, expect } from 'vitest';
import { buildPledgeAlertHtml } from './mail';

describe('buildPledgeAlertHtml', () => {
  it('danger 等級會標示「緊急」與平台名稱、比率', () => {
    const html = buildPledgeAlertHtml({
      isDanger: true,
      platformName: '元大',
      ratio: 150.5,
      pledgeData: [{ platform: '元大', ratio: 150.5, borrowValue: 1000000, collateralValue: 1505000 }],
    });
    expect(html).toContain('緊急');
    expect(html).toContain('元大');
    expect(html).toContain('150.5%');
  });

  it('warning 等級不含「緊急」字樣,含「注意」', () => {
    const html = buildPledgeAlertHtml({
      isDanger: false,
      platformName: '國泰',
      ratio: 190,
      pledgeData: [{ platform: '國泰', ratio: 190, borrowValue: 500000, collateralValue: 950000 }],
    });
    expect(html).toContain('注意');
    expect(html).not.toContain('緊急');
  });
});
```

- [ ] **Step 2: 執行測試,確認因函式不存在而失敗**

Run: `npm test -- src/lib/mail.test.ts`
Expected: FAIL,`buildPledgeAlertHtml` 不是 `mail.ts` 的匯出

- [ ] **Step 3: 在 `src/lib/mail.ts` 檔尾加入 `buildPledgeAlertHtml`**

在 `generateAssetReportHtml` 函式之後(檔案最後)加入,內容原樣取自 `src/app/api/pledge-alert/route.ts` 現有的 `buildAlertHtml`,只改函式名稱與匯出:

```ts
export function buildPledgeAlertHtml(data: {
  isDanger: boolean;
  platformName: string;
  ratio: number;
  pledgeData: { platform: string; ratio: number; borrowValue: number; collateralValue: number }[];
}): string {
  const { isDanger, platformName, ratio, pledgeData } = data;
  const headerColor = isDanger ? '#dc2626' : '#d97706';
  const headerBg = isDanger ? '#fef2f2' : '#fffbeb';
  const borderColor = isDanger ? '#fecaca' : '#fde68a';
  const dateStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const ratioColor = (r: number) => r < 167 ? '#dc2626' : r < 200 ? '#d97706' : '#059669';

  const rows = pledgeData.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:13px;color:#374151;">${p.platform}</span>
      <span style="font-size:14px;font-weight:700;color:${ratioColor(p.ratio)};">${p.ratio > 0 ? p.ratio.toFixed(1) + '%' : '—'}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI','Microsoft JhengHei',sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:${headerBg};border-bottom:3px solid ${borderColor};padding:24px 28px;">
    <div style="font-size:20px;font-weight:700;color:${headerColor};">${isDanger ? '⚠️ 緊急：質押維持率警示' : '⚡ 注意：質押維持率提醒'}</div>
    <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${dateStr}</p>
  </div>
  <div style="padding:24px 28px;">
    <p style="font-size:15px;color:#374151;margin:0 0 12px;">您的質押帳戶 <strong>${platformName}</strong> 維持率已${isDanger ? '低於 167%' : '低於 200%'}，目前為 <strong style="color:${headerColor};">${ratio.toFixed(1)}%</strong>。</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">${isDanger ? '⚠️ 請立即補充保證金或部分還款，以避免強制平倉。' : '建議您適時補充擔保品，以提高安全緩衝。'}</p>
    <div style="background:#f9fafb;border-radius:10px;padding:16px;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">各平台質押狀況</div>
      ${rows}
    </div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">此信件由 AssetDash 自動產生 · ${dateStr}</p>
  </div>
</div>
</body>
</html>`;
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `npm test -- src/lib/mail.test.ts`
Expected: PASS(2 個測試)

- [ ] **Step 5: 修改 `src/app/api/pledge-alert/route.ts`,改用 `mail.ts` 的匯出並移除本地重複定義**

把檔案內容換成:

```ts
// src/app/api/pledge-alert/route.ts
import { NextResponse } from 'next/server';
import { sendEmail, buildPledgeAlertHtml } from '../../../lib/mail';

type PledgeData = {
  platform: string;
  ratio: number;
  borrowValue: number;
  collateralValue: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipientEmail, alertLevel, platformName, ratio, pledgeData } = body as {
      recipientEmail: string;
      alertLevel: 'warning' | 'danger';
      platformName: string;
      ratio: number;
      pledgeData: PledgeData[];
    };

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: '請提供有效的收件人 Email' }, { status: 400 });
    }
    if (!process.env.EMAIL_SERVER_HOST || !process.env.EMAIL_SERVER_USER) {
      return NextResponse.json({ error: '伺服器尚未設定 SMTP' }, { status: 500 });
    }

    const isDanger = alertLevel === 'danger';
    const subject = isDanger
      ? `[緊急] 質押維持率 ${ratio.toFixed(1)}% — 請立即補倉`
      : `[注意] 質押維持率 ${ratio.toFixed(1)}% — 建議補充保證金`;

    const html = buildPledgeAlertHtml({ isDanger, platformName, ratio, pledgeData });
    await sendEmail({ to: recipientEmail, subject, html });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `寄送失敗：${message}` }, { status: 500 });
  }
}
```

- [ ] **Step 6: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/mail.ts src/lib/mail.test.ts src/app/api/pledge-alert/route.ts
git commit -m "refactor: 質押警示信 HTML 產生器搬到 mail.ts,供 API route 與日後 cron 共用"
```

---

## Task 3: 抽出資產彙總計算為 `assetCalc.ts`

**Files:**
- Create: `src/lib/assetCalc.ts`
- Create: `src/lib/assetCalc.test.ts`
- Modify: `src/context/AssetContext.tsx:182-231`

**Interfaces:**
- Produces:
  - `buildCombinedAssets(assets: AssetCategory[], totalStockValueTWD: number, stakingEarnTotal: number): AssetCategory[]`
  - `buildCombinedLiabilities(liabilities: LiabilityItem[], borrowItems: { id: string; name: string; protocol: string; value: number; apy: number }[], loans: { id: string; name: string; bank: string; principal: number; interestRate: number; remainingPeriods: number; loanType: 'installment' | 'revolving' }[]): LiabilityItem[]`
  - `computeTotalAssets(combinedAssets: AssetCategory[]): number`
  - `computeTotalLiabilities(combinedLiabilities: LiabilityItem[]): number`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/assetCalc.test.ts
import { describe, it, expect } from 'vitest';
import { buildCombinedAssets, buildCombinedLiabilities, computeTotalAssets, computeTotalLiabilities } from './assetCalc';
import type { AssetCategory, LiabilityItem } from '../types';

const cat = (id: string, amounts: number[]): AssetCategory => ({
  id, title: id, description: '', colorClass: '', bgClass: '', updatedAt: '',
  items: amounts.map((amount, i) => ({ id: `${id}-${i}`, name: `item${i}`, amount })),
});

describe('buildCombinedAssets', () => {
  it('非 investment 分類原樣回傳', () => {
    const assets = [cat('liquid', [1000])];
    expect(buildCombinedAssets(assets, 5000, 2000)).toEqual(assets);
  });

  it('investment 分類會附加自動化股票投資與活存/Earn 收益資產', () => {
    const assets = [cat('investment', [100])];
    const result = buildCombinedAssets(assets, 50000, 20000);
    expect(result[0].items).toEqual([
      { id: 'investment-0', name: 'item0', amount: 100 },
      { id: 'auto-stocks', name: '自動化股票投資', amount: 50000 },
      { id: 'auto-earn', name: '活存/Earn 收益資產', amount: 20000 },
    ]);
  });

  it('股票市值與 Earn 皆為 0 時,investment 分類不附加任何項目', () => {
    const assets = [cat('investment', [100])];
    expect(buildCombinedAssets(assets, 0, 0)).toEqual(assets);
  });
});

describe('buildCombinedLiabilities', () => {
  const liabilities: LiabilityItem[] = [
    { id: 'l1', name: '房貸', description: '', amount: 3000000, updatedAt: '', icon: 'building' },
  ];

  it('質押借款與本金 > 0 的貸款會併入負債清單', () => {
    const result = buildCombinedLiabilities(
      liabilities,
      [{ id: 's1', name: 'ETH 質押', protocol: 'Lido', value: 1000000, apy: 3.4 }],
      [{ id: 'loan1', name: '信貸A', bank: '樂天', principal: 500000, interestRate: 2.08, remainingPeriods: 68, loanType: 'installment' }],
    );
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({ id: 'auto-staking-s1', amount: 1000000, icon: 'building' });
    expect(result[2]).toMatchObject({ id: 'auto-loan-loan1', amount: 500000, icon: 'creditCard' });
  });

  it('本金為 0 的貸款不會被列入', () => {
    const result = buildCombinedLiabilities(
      liabilities, [],
      [{ id: 'loan1', name: '已還清', bank: '樂天', principal: 0, interestRate: 2.08, remainingPeriods: 0, loanType: 'installment' }],
    );
    expect(result).toHaveLength(1);
  });
});

describe('computeTotalAssets / computeTotalLiabilities', () => {
  it('加總所有分類 items 的 amount', () => {
    expect(computeTotalAssets([cat('a', [100, 200]), cat('b', [50])])).toBe(350);
  });

  it('加總所有負債的 amount', () => {
    const liabilities: LiabilityItem[] = [
      { id: 'l1', name: 'x', description: '', amount: 100, updatedAt: '', icon: 'building' },
      { id: 'l2', name: 'y', description: '', amount: 200, updatedAt: '', icon: 'creditCard' },
    ];
    expect(computeTotalLiabilities(liabilities)).toBe(300);
  });
});
```

- [ ] **Step 2: 執行測試,確認因檔案不存在而失敗**

Run: `npm test -- src/lib/assetCalc.test.ts`
Expected: FAIL,找不到模組 `./assetCalc`

- [ ] **Step 3: 建立 `src/lib/assetCalc.ts`**

```ts
// src/lib/assetCalc.ts
import type { AssetCategory, LiabilityItem, StakingItem, LoanItem } from '../types';

export function buildCombinedAssets(
  assets: AssetCategory[],
  totalStockValueTWD: number,
  stakingEarnTotal: number,
): AssetCategory[] {
  return assets.map(cat => {
    if (cat.id !== 'investment') return cat;
    const extra: { id: string; name: string; amount: number }[] = [];
    if (totalStockValueTWD > 0) extra.push({ id: 'auto-stocks', name: '自動化股票投資', amount: Math.round(totalStockValueTWD) });
    if (stakingEarnTotal > 0)   extra.push({ id: 'auto-earn',   name: '活存/Earn 收益資產', amount: stakingEarnTotal });
    if (extra.length === 0) return cat;
    return { ...cat, items: [...cat.items, ...extra] };
  });
}

type BorrowStakingItem = Pick<StakingItem, 'id' | 'name' | 'protocol' | 'value' | 'apy'>;
type CombinedLoan = Pick<LoanItem, 'id' | 'name' | 'bank' | 'principal' | 'interestRate' | 'remainingPeriods' | 'loanType'>;

export function buildCombinedLiabilities(
  liabilities: LiabilityItem[],
  borrowItems: BorrowStakingItem[],
  loans: CombinedLoan[],
): LiabilityItem[] {
  const list = [...liabilities];
  for (const item of borrowItems) {
    list.push({
      id: `auto-staking-${item.id}`,
      name: item.name,
      description: `${item.protocol} · 質押借款 · ${item.apy}% 年利率`,
      amount: item.value,
      updatedAt: '自動同步',
      icon: 'building' as const,
    });
  }
  for (const loan of loans) {
    if (loan.principal > 0) {
      list.push({
        id: `auto-loan-${loan.id}`,
        name: `${loan.name}（${loan.bank}）`,
        description: loan.loanType === 'installment'
          ? `分期還款 · ${loan.interestRate}% · 剩餘${loan.remainingPeriods}期`
          : `循環借款 · ${loan.interestRate}% 年利率`,
        amount: loan.principal,
        updatedAt: '自動同步',
        icon: 'creditCard' as const,
      });
    }
  }
  return list;
}

export function computeTotalAssets(combinedAssets: AssetCategory[]): number {
  return combinedAssets.reduce((s, cat) => s + cat.items.reduce((is, i) => is + i.amount, 0), 0);
}

export function computeTotalLiabilities(combinedLiabilities: LiabilityItem[]): number {
  return combinedLiabilities.reduce((s, i) => s + i.amount, 0);
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `npm test -- src/lib/assetCalc.test.ts`
Expected: PASS(6 個測試)

- [ ] **Step 5: 修改 `src/context/AssetContext.tsx`,改用 `assetCalc.ts`**

在檔案頂端 import 區加入:

```ts
import { buildCombinedAssets, buildCombinedLiabilities, computeTotalAssets, computeTotalLiabilities } from '../lib/assetCalc';
```

把現有第 182-231 行(`// ── 衍生值...` 註解到 `computeTotalLiabilities` 為止的四個 `useMemo`)換成:

```ts
  // ── 衍生值(呼叫 src/lib/assetCalc.ts 的共用純函式,前端與伺服器 cron 共用同一份邏輯)──
  const combinedAssets = useMemo(
    () => buildCombinedAssets(assets, totalStockValueTWD, stakingEarnTotal),
    [assets, totalStockValueTWD, stakingEarnTotal]
  );

  const combinedLiabilities = useMemo(
    () => buildCombinedLiabilities(liabilities, borrowItems, loans),
    [liabilities, borrowItems, loans]
  );

  const totalAssets = useMemo(() => computeTotalAssets(combinedAssets), [combinedAssets]);
  const totalLiabilities = useMemo(() => computeTotalLiabilities(combinedLiabilities), [combinedLiabilities]);
```

- [ ] **Step 6: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS,無型別錯誤

- [ ] **Step 7: 手動驗證行為不變**

Run: `npm run dev`,打開 `/`(資產總覽頁),確認總資產、投資分類下的「自動化股票投資」「活存/Earn 收益資產」項目金額與重構前一致。

- [ ] **Step 8: Commit**

```bash
git add src/lib/assetCalc.ts src/lib/assetCalc.test.ts src/context/AssetContext.tsx
git commit -m "refactor: 抽出資產彙總計算為共用 assetCalc,供前端與日後 cron 共用"
```

---

## Task 4: 抽出月收支計算為 `cashflowCalc.ts`

**Files:**
- Create: `src/lib/cashflowCalc.ts`
- Create: `src/lib/cashflowCalc.test.ts`
- Modify: `src/context/AppContext.tsx:188-201`

**Interfaces:**
- Produces:
  - `computeMonthlyIncome(monthRecord: MonthRecord | undefined, cashflowTemplate: CashflowTemplate, stakingEarnIncome: number): number`
  - `computeMonthlyExpense(monthRecord: MonthRecord | undefined, cashflowTemplate: CashflowTemplate, stakingBorrowInterest: number, totalLoanMonthlyPayments: number): number`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/cashflowCalc.test.ts
import { describe, it, expect } from 'vitest';
import { computeMonthlyIncome, computeMonthlyExpense } from './cashflowCalc';
import type { CashflowTemplate, MonthRecord } from '../types';

const template: CashflowTemplate = {
  income: [{ id: 'i1', name: '薪資', amount: 80000, category: 'Salary', isRecurring: true }],
  expense: [{ id: 'e1', name: '房租', amount: 20000, category: 'Housing', isRecurring: true }],
};

describe('computeMonthlyIncome', () => {
  it('無當月紀錄時用範本收入,並加上四捨五入後的 Earn 收益', () => {
    expect(computeMonthlyIncome(undefined, template, 1234.6)).toBe(80000 + 1235);
  });

  it('有當月紀錄時優先用紀錄的收入清單', () => {
    const record: MonthRecord = { income: [{ id: 'i2', name: '獎金', amount: 10000, category: 'Bonus', isRecurring: false }], expense: [] };
    expect(computeMonthlyIncome(record, template, 0)).toBe(10000);
  });
});

describe('computeMonthlyExpense', () => {
  it('無當月紀錄時用範本支出,加上質押利息與貸款月付金', () => {
    expect(computeMonthlyExpense(undefined, template, 500.4, 10242)).toBe(20000 + 500 + 10242);
  });

  it('有當月紀錄時優先用紀錄的支出清單', () => {
    const record: MonthRecord = { income: [], expense: [{ id: 'e2', name: '醫療', amount: 3000, category: 'Medical', isRecurring: false }] };
    expect(computeMonthlyExpense(record, template, 0, 0)).toBe(3000);
  });
});
```

- [ ] **Step 2: 執行測試,確認因檔案不存在而失敗**

Run: `npm test -- src/lib/cashflowCalc.test.ts`
Expected: FAIL,找不到模組 `./cashflowCalc`

- [ ] **Step 3: 建立 `src/lib/cashflowCalc.ts`**

```ts
// src/lib/cashflowCalc.ts
import type { CashflowTemplate, MonthRecord } from '../types';

export function computeMonthlyIncome(
  monthRecord: MonthRecord | undefined,
  cashflowTemplate: CashflowTemplate,
  stakingEarnIncome: number,
): number {
  const items = monthRecord?.income ?? cashflowTemplate.income;
  return items.reduce((sum, item) => sum + item.amount, 0) + Math.round(stakingEarnIncome);
}

export function computeMonthlyExpense(
  monthRecord: MonthRecord | undefined,
  cashflowTemplate: CashflowTemplate,
  stakingBorrowInterest: number,
  totalLoanMonthlyPayments: number,
): number {
  const items = monthRecord?.expense ?? cashflowTemplate.expense;
  return items.reduce((sum, item) => sum + item.amount, 0)
    + Math.round(stakingBorrowInterest)
    + totalLoanMonthlyPayments;
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `npm test -- src/lib/cashflowCalc.test.ts`
Expected: PASS(4 個測試)

- [ ] **Step 5: 修改 `src/context/AppContext.tsx`,改用 `cashflowCalc.ts`**

在檔案頂端 import 區加入:

```ts
import { computeMonthlyIncome, computeMonthlyExpense } from '../lib/cashflowCalc';
```

把現有第 188-201 行(`// totalMonthlyIncome / totalMonthlyExpense...` 兩個 `useMemo`)換成:

```ts
  // totalMonthlyIncome / totalMonthlyExpense（跨 domain 計算,呼叫 src/lib/cashflowCalc.ts 的共用純函式）
  const totalMonthlyIncome = useMemo(
    () => computeMonthlyIncome(cashflowCtx.monthlyRecords[cashflowCtx.currentMonthKey], cashflowCtx.cashflowTemplate, loanCtx.stakingEarnIncome),
    [cashflowCtx.monthlyRecords, cashflowCtx.currentMonthKey, cashflowCtx.cashflowTemplate, loanCtx.stakingEarnIncome]
  );

  const totalMonthlyExpense = useMemo(
    () => computeMonthlyExpense(cashflowCtx.monthlyRecords[cashflowCtx.currentMonthKey], cashflowCtx.cashflowTemplate, loanCtx.stakingBorrowInterest, loanCtx.totalLoanMonthlyPayments),
    [cashflowCtx.monthlyRecords, cashflowCtx.currentMonthKey, cashflowCtx.cashflowTemplate, loanCtx.stakingBorrowInterest, loanCtx.totalLoanMonthlyPayments]
  );
```

- [ ] **Step 6: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS

- [ ] **Step 7: 手動驗證行為不變**

Run: `npm run dev`,打開現金流頁面,確認月收入/月支出/月淨現金流數字與重構前一致。

- [ ] **Step 8: Commit**

```bash
git add src/lib/cashflowCalc.ts src/lib/cashflowCalc.test.ts src/context/AppContext.tsx
git commit -m "refactor: 抽出月收支計算為共用 cashflowCalc,供前端與日後 cron 共用"
```

---

## Task 5: 抽出質押維持率計算為 `pledgeCalc.ts`

**Files:**
- Create: `src/lib/pledgeCalc.ts`
- Create: `src/lib/pledgeCalc.test.ts`
- Modify: `src/app/debt/page.tsx:114-135`
- Modify: `src/components/EmailReportSender.tsx:119-149`

**Interfaces:**
- Produces:
  - `interface PledgeRatio { platform: string; ratio: number; borrowValue: number; collateralValue: number }`
  - `computePledgeRatios(stakingItems: StakingItem[], stockItems: StockItem[], stockQuotes: Record<string, StockQuote>, usdToTwd: number): PledgeRatio[]`
  - `interface PledgeAlert { level: 'warning' | 'danger'; platform: string; ratio: number }`
  - `getPledgeAlertLevel(ratios: PledgeRatio[]): PledgeAlert | null`(< 167% = danger,< 200% = warning,以上或無借款平台回傳 null)
  - `interface ReportPledgeRatio { platform: string; ratio: number; totalBorrowValue: number; totalCollateralValueTWD: number; buffer: number; shortage: number; isRed: boolean; isYellow: boolean }`
  - `buildReportPledgeRatios(ratios: PledgeRatio[]): ReportPledgeRatio[]`(< 130% = isRed,130%~166% = isYellow,報表用的顯示門檻,與 `getPledgeAlertLevel` 的寄信門檻不同,兩者都要保留)

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/pledgeCalc.test.ts
import { describe, it, expect } from 'vitest';
import { computePledgeRatios, getPledgeAlertLevel, buildReportPledgeRatios } from './pledgeCalc';
import type { StakingItem, StockItem, StockQuote } from '../types';

const staking: StakingItem[] = [
  { id: 's1', name: '借款A', protocol: '元大', amount: 1000000, value: 1000000, apy: 2.5, stakingType: 'borrow' },
];
const stocks: StockItem[] = [
  { id: 'st1', symbol: '2330.TW', shares: 1000, avgCost: 500, collateralShares: 1000, platform: '元大' },
];
const quotes: Record<string, StockQuote> = { '2330.TW': { price: 1500, changePercent: 0, currency: 'TWD' } };

describe('computePledgeRatios', () => {
  it('依平台分組計算維持率(擔保品市值/借款金額 * 100)', () => {
    const result = computePledgeRatios(staking, stocks, quotes, 32);
    expect(result).toEqual([{ platform: '元大', ratio: 150, borrowValue: 1000000, collateralValue: 1500000 }]);
  });

  it('無借款項目時回傳空陣列', () => {
    expect(computePledgeRatios([], stocks, quotes, 32)).toEqual([]);
  });

  it('USD 計價股票的擔保品市值會換算成台幣', () => {
    const usdStock: StockItem[] = [{ id: 'st2', symbol: 'AAPL', shares: 100, avgCost: 150, collateralShares: 100, platform: '元大' }];
    const usdQuotes: Record<string, StockQuote> = { AAPL: { price: 200, changePercent: 0, currency: 'USD' } };
    const result = computePledgeRatios(staking, usdStock, usdQuotes, 32);
    expect(result[0].collateralValue).toBe(200 * 100 * 32);
  });
});

describe('getPledgeAlertLevel', () => {
  it('維持率 < 167% 回傳 danger', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 150, borrowValue: 100, collateralValue: 150 }]))
      .toEqual({ level: 'danger', platform: 'A', ratio: 150 });
  });

  it('167% <= 維持率 < 200% 回傳 warning', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 180, borrowValue: 100, collateralValue: 180 }]))
      .toEqual({ level: 'warning', platform: 'A', ratio: 180 });
  });

  it('維持率 >= 200% 回傳 null', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 250, borrowValue: 100, collateralValue: 250 }])).toBeNull();
  });

  it('沒有任何借款 > 0 的平台時回傳 null', () => {
    expect(getPledgeAlertLevel([{ platform: 'A', ratio: 0, borrowValue: 0, collateralValue: 0 }])).toBeNull();
  });

  it('多平台時取維持率最低者', () => {
    const result = getPledgeAlertLevel([
      { platform: 'A', ratio: 180, borrowValue: 100, collateralValue: 180 },
      { platform: 'B', ratio: 120, borrowValue: 100, collateralValue: 120 },
    ]);
    expect(result).toEqual({ level: 'danger', platform: 'B', ratio: 120 });
  });
});

describe('buildReportPledgeRatios', () => {
  it('維持率 < 130% 標記 isRed,並計算追繳缺口 shortage', () => {
    const [r] = buildReportPledgeRatios([{ platform: 'A', ratio: 100, borrowValue: 1000000, collateralValue: 1000000 }]);
    expect(r.isRed).toBe(true);
    expect(r.isYellow).toBe(false);
    expect(r.shortage).toBe(Math.round(1000000 * 1.3 - 1000000));
  });

  it('130% <= 維持率 < 166% 標記 isYellow', () => {
    const [r] = buildReportPledgeRatios([{ platform: 'A', ratio: 150, borrowValue: 1000000, collateralValue: 1500000 }]);
    expect(r.isYellow).toBe(true);
    expect(r.isRed).toBe(false);
  });

  it('維持率 >= 166% 兩者皆 false,並計算安全緩衝 buffer', () => {
    const [r] = buildReportPledgeRatios([{ platform: 'A', ratio: 200, borrowValue: 1000000, collateralValue: 2000000 }]);
    expect(r.isRed).toBe(false);
    expect(r.isYellow).toBe(false);
    expect(r.buffer).toBe(Math.round(2000000 - 1000000 * 1.3));
  });
});
```

- [ ] **Step 2: 執行測試,確認因檔案不存在而失敗**

Run: `npm test -- src/lib/pledgeCalc.test.ts`
Expected: FAIL,找不到模組 `./pledgeCalc`

- [ ] **Step 3: 建立 `src/lib/pledgeCalc.ts`**

```ts
// src/lib/pledgeCalc.ts
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
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `npm test -- src/lib/pledgeCalc.test.ts`
Expected: PASS(12 個測試)

- [ ] **Step 5: 修改 `src/app/debt/page.tsx`,改用 `pledgeCalc.ts`**

在檔案頂端 import 區加入:

```ts
import { computePledgeRatios, getPledgeAlertLevel } from '../../lib/pledgeCalc';
```

把現有第 114-135 行(`const { minRatio, minPlatform, allPlatformRatios } = useMemo(...)` 到 `const alertLevel = ...` 為止)換成:

```ts
  const pledgeRatios = useMemo(
    () => computePledgeRatios(stakingItems, stockItems, stockQuotes, usdToTwd),
    [stakingItems, stockItems, stockQuotes, usdToTwd]
  );

  const pledgeAlert = useMemo(() => getPledgeAlertLevel(pledgeRatios), [pledgeRatios]);
  const alertLevel: 'warning' | 'danger' | null = pledgeAlert?.level ?? null;
  const minRatio = pledgeAlert?.ratio ?? 0;
  const minPlatform = pledgeAlert?.platform ?? '';
  const allPlatformRatios = pledgeRatios.map(r => ({
    platform: r.platform, ratio: r.ratio, borrowValue: r.borrowValue, collateralValue: r.collateralValue,
  }));
```

保留原本第 88-112 行(`borrowByPlatform`/`pledgePlatforms`/`collateralByPlatform` 的 `useMemo`)不動 —— 這些仍要傳給 `BorrowSection` 顯示用。

- [ ] **Step 6: 修改 `src/components/EmailReportSender.tsx`,改用 `pledgeCalc.ts`**

在檔案頂端 import 區加入:

```ts
import { computePledgeRatios, buildReportPledgeRatios } from '../lib/pledgeCalc';
```

把現有第 119-149 行(`// 質押維持率（按平台分組）` 的 IIFE)換成:

```ts
      // 質押維持率（按平台分組）
      pledgeRatioData: buildReportPledgeRatios(computePledgeRatios(ctx.stakingItems, ctx.stockItems, ctx.stockQuotes, usdToTwd)),
```

- [ ] **Step 7: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS

- [ ] **Step 8: 手動驗證行為不變**

Run: `npm run dev`,打開 `/debt` 頁面確認質押維持率警示橫幅顯示邏輯不變;打開「寄送報表」彈窗按「立即寄送」,確認信件仍正確顯示質押狀況。

- [ ] **Step 9: Commit**

```bash
git add src/lib/pledgeCalc.ts src/lib/pledgeCalc.test.ts src/app/debt/page.tsx src/components/EmailReportSender.tsx
git commit -m "refactor: 抽出質押維持率計算為共用 pledgeCalc,供前端與日後 cron 共用"
```

---

## Task 6: `lastReportSent` 改為雲端同步狀態

**Files:**
- Modify: `src/context/SettingsContext.tsx`

**Interfaces:**
- Consumes: 既有 `useSyncedState<T>(key, defaultValue, localStorageKey)`(`src/hooks/useSyncedState.ts`,本任務不修改)
- Produces:(不變)`lastReportSent: string`、`setLastReportSent: (v: string) => void`,對外簽名完全相同,呼叫端不需修改。

`lastReportSent` 目前用 `useStickyState`(純本機),cron 需要一個「所有裝置共用」的最後寄信日期才能避免重複寄信,所以要跟 `reportSchedule`、`pledgeAlertLastSent` 一樣改用 `useSyncedState`。這是既有 hook 的直接替換,行為已由 `useSyncedState.test.ts` 涵蓋的訪客/雲端模式邏輯保證,不需要新增測試。

- [ ] **Step 1: 修改 `src/context/SettingsContext.tsx`**

把第 56 行:

```ts
  const [lastReportSent, setLastReportSent] = useStickyState('', 'app-last-report-sent-v1');
```

改成:

```ts
  const [lastReportSent, setLastReportSent] = useSyncedState<string>('lastReportSent', '', 'app-last-report-sent-v1');
```

把第 50-52 行的註解:

```ts
  // 裝置專屬，刻意不雲端同步：showValues（隱私顯示開關，各裝置各自獨立較合理）、
  // userName/userEmail（登入時改由 Google 帳號同步，見 AppContext）、
  // lastReportSent/lastExportDate（本機操作紀錄）、onboardingDone（已由 hasAnyData 判斷取代，見 OnboardingWizard）
```

改成:

```ts
  // 裝置專屬，刻意不雲端同步：showValues（隱私顯示開關，各裝置各自獨立較合理）、
  // userName/userEmail（登入時改由 Google 帳號同步，見 AppContext）、
  // lastExportDate（本機操作紀錄）、onboardingDone（已由 hasAnyData 判斷取代，見 OnboardingWizard）
  // lastReportSent 改為雲端同步（見下方 useSyncedState）：伺服器 cron 與任何裝置手動寄送報表都要共用同一個
  // 「今天寄過了沒」狀態，才能避免跨裝置/跨 cron 重複寄信。
```

- [ ] **Step 2: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS,無型別錯誤(`useSyncedState` 已在檔案頂端 import,不需新增 import)

- [ ] **Step 3: 手動驗證**

Run: `npm run dev`,登入 Google 帳號後在「寄送報表」按「立即寄送」,確認寄送成功後重新整理頁面,`lastReportSent` 狀態仍維持(代表已寫入雲端而非只在 localStorage)。

- [ ] **Step 4: Commit**

```bash
git add src/context/SettingsContext.tsx
git commit -m "refactor: lastReportSent 改為雲端同步狀態,供伺服器 cron 判斷是否已寄送"
```

---

## Task 7: 伺服器端單一使用者資料讀取與計算 `reportEngine.ts`

**Files:**
- Create: `src/server/reportEngine.ts`
- Create: `src/server/reportEngine.test.ts`

**Interfaces:**
- Consumes:
  - `createEntityStore`(`src/server/entityStore.ts`,已存在)
  - `getQuotes`(`src/lib/quoteService.ts`,Task 1)
  - `buildCombinedAssets`、`buildCombinedLiabilities`、`computeTotalAssets`、`computeTotalLiabilities`(`src/lib/assetCalc.ts`,Task 3)
  - `computeMonthlyIncome`、`computeMonthlyExpense`(`src/lib/cashflowCalc.ts`,Task 4)
  - `computePledgeRatios`、`getPledgeAlertLevel`、`buildReportPledgeRatios`、`PledgeRatio`(`src/lib/pledgeCalc.ts`,Task 5)
  - `monthKey`(`src/lib/utils.ts`,已存在)
  - `ReportPayload`(`src/lib/mail.ts`,已存在)
- Produces:
  - `interface UserReportResult { reportPayload: ReportPayload; pledgeAlert: { level: 'warning' | 'danger'; platform: string; ratio: number; pledgeData: PledgeRatio[] } | null; reportSchedule: 'none' | 'weekly' | 'monthly'; lastReportSent: string; pledgeAlertLastSent: Record<'warning' | 'danger', string> }`
  - `computeUserReport(db: Db, userId: string): Promise<UserReportResult>`(供 Task 8 的 `dailyCheck.ts` 呼叫)

- [ ] **Step 1: 寫失敗測試**

```ts
// src/server/reportEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/quoteService', () => ({
  getQuotes: vi.fn(),
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
    // 擔保品市值 1,500,000 / 借款 1,000,000 * 100 = 150% < 167% → danger
    expect(result.pledgeAlert).toMatchObject({ level: 'danger', platform: '元大', ratio: 150 });
  });

  it('沒有持股時完全不呼叫 getQuotes', async () => {
    await computeUserReport(db, 'u1');
    expect(getQuotes).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 執行測試,確認因檔案不存在而失敗**

Run: `npm test -- src/server/reportEngine.test.ts`
Expected: FAIL,找不到模組 `./reportEngine`

- [ ] **Step 3: 建立 `src/server/reportEngine.ts`**

```ts
// src/server/reportEngine.ts
import type { Db } from '../db/client';
import { assets, liabilities, appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { getQuotes } from '../lib/quoteService';
import { buildCombinedAssets, buildCombinedLiabilities, computeTotalAssets, computeTotalLiabilities } from '../lib/assetCalc';
import { computeMonthlyIncome, computeMonthlyExpense } from '../lib/cashflowCalc';
import { computePledgeRatios, getPledgeAlertLevel, buildReportPledgeRatios, type PledgeRatio } from '../lib/pledgeCalc';
import { monthKey } from '../lib/utils';
import type { ReportPayload } from '../lib/mail';
import type {
  AssetCategory, LiabilityItem, StockItem, StakingItem, LoanItem,
  CashflowTemplate, MonthRecord, StockQuote,
} from '../types';

const assetsStore = createEntityStore(assets);
const liabilitiesStore = createEntityStore(liabilities);
const appStateStore = createEntityStore(appState);

interface UserFinancialData {
  assets: AssetCategory[];
  liabilities: LiabilityItem[];
  stockItems: StockItem[];
  stakingItems: StakingItem[];
  loans: LoanItem[];
  cashflowTemplate: CashflowTemplate;
  monthlyRecords: Record<string, MonthRecord>;
  usdToTwd: number;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  lastReportSent: string;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
}

async function loadAppState(db: Db, userId: string): Promise<Record<string, unknown>> {
  const rows = await appStateStore.getAll(db, userId);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    const entry = row.data as { id: string; value: unknown };
    map[entry.id] = entry.value;
  }
  return map;
}

async function loadUserFinancialData(db: Db, userId: string): Promise<UserFinancialData> {
  const [assetRows, liabilityRows, state] = await Promise.all([
    assetsStore.getAll(db, userId),
    liabilitiesStore.getAll(db, userId),
    loadAppState(db, userId),
  ]);

  return {
    assets: assetRows.map(r => r.data as AssetCategory),
    liabilities: liabilityRows.map(r => r.data as LiabilityItem),
    stockItems: (state.stockItems as StockItem[]) ?? [],
    stakingItems: (state.stakingItems as StakingItem[]) ?? [],
    loans: (state.loans as LoanItem[]) ?? [],
    cashflowTemplate: (state.cashflowTemplate as CashflowTemplate) ?? { income: [], expense: [] },
    monthlyRecords: (state.monthlyRecords as Record<string, MonthRecord>) ?? {},
    usdToTwd: (state.usdToTwd as number) ?? 32,
    reportSchedule: (state.reportSchedule as 'none' | 'weekly' | 'monthly') ?? 'none',
    lastReportSent: (state.lastReportSent as string) ?? '',
    pledgeAlertLastSent: (state.pledgeAlertLastSent as Record<'warning' | 'danger', string>) ?? { warning: '', danger: '' },
  };
}

export interface UserReportResult {
  reportPayload: ReportPayload;
  pledgeAlert: { level: 'warning' | 'danger'; platform: string; ratio: number; pledgeData: PledgeRatio[] } | null;
  reportSchedule: 'none' | 'weekly' | 'monthly';
  lastReportSent: string;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
}

export async function computeUserReport(db: Db, userId: string): Promise<UserReportResult> {
  const fin = await loadUserFinancialData(db, userId);

  const symbols = Array.from(new Set(fin.stockItems.map(s => s.symbol)));
  let stockQuotes: Record<string, StockQuote> = {};
  if (symbols.length > 0) {
    const { data } = await getQuotes(symbols);
    stockQuotes = data;
  }

  const borrowItems = fin.stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  const earnItems = fin.stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'earn');
  const stakingEarnTotal = earnItems.reduce((s, i) => s + i.value, 0);
  const stakingEarnIncome = earnItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const stakingBorrowInterest = borrowItems.reduce((s, i) => s + (i.value * i.apy / 100 / 12), 0);
  const totalLoanMonthlyPayments = fin.loans.reduce((s, l) => s + l.monthlyPayment, 0);

  const totalStockValueTWD = fin.stockItems.reduce((total, item) => {
    const quote = stockQuotes[item.symbol];
    if (!quote) return total;
    const value = quote.price * item.shares;
    return total + (quote.currency === 'USD' ? value * fin.usdToTwd : value);
  }, 0);

  const combinedAssets = buildCombinedAssets(fin.assets, totalStockValueTWD, stakingEarnTotal);
  const combinedLiabilities = buildCombinedLiabilities(fin.liabilities, borrowItems, fin.loans);
  const totalAssets = computeTotalAssets(combinedAssets);
  const totalLiabilities = computeTotalLiabilities(combinedLiabilities);
  const netWorth = totalAssets - totalLiabilities;

  const currentMonthKey = monthKey(new Date());
  const monthRecord = fin.monthlyRecords[currentMonthKey];
  const totalMonthlyIncome = computeMonthlyIncome(monthRecord, fin.cashflowTemplate, stakingEarnIncome);
  const totalMonthlyExpense = computeMonthlyExpense(monthRecord, fin.cashflowTemplate, stakingBorrowInterest, totalLoanMonthlyPayments);
  const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyExpense;

  const pledgeRatios = computePledgeRatios(fin.stakingItems, fin.stockItems, stockQuotes, fin.usdToTwd);
  const alert = getPledgeAlertLevel(pledgeRatios);

  const reportPayload: ReportPayload = {
    totalAssets, totalLiabilities, netWorth,
    totalMonthlyIncome, totalMonthlyExpense, monthlyNetCashFlow,
    usdToTwd: fin.usdToTwd,
    combinedAssets: combinedAssets.map(cat => ({
      title: cat.title, items: cat.items.map(i => ({ name: i.name, amount: i.amount })),
    })),
    combinedLiabilities: combinedLiabilities.map(item => ({
      name: item.name, description: item.description, amount: item.amount,
    })),
    loans: fin.loans.map(loan => ({
      name: loan.name, bank: loan.bank, principal: loan.principal, interestRate: loan.interestRate,
      monthlyPayment: loan.monthlyPayment, remainingPeriods: loan.remainingPeriods,
    })),
    stakingItems: fin.stakingItems.map(item => ({
      name: item.name, protocol: item.protocol, value: item.value, apy: item.apy,
      stakingType: item.stakingType ?? 'borrow', monthlyInterest: item.value * item.apy / 100 / 12,
      borrowDate: item.borrowDate, repayDate: item.repayDate,
    })),
    stockItems: fin.stockItems.map(stock => {
      const quote = stockQuotes[stock.symbol];
      const currentPrice = quote?.price || 0;
      const currency = quote?.currency || 'TWD';
      const changePercent = quote?.changePercent || 0;
      const marketValueRaw = currentPrice * stock.shares;
      const marketValueTWD = currency === 'USD' ? marketValueRaw * fin.usdToTwd : marketValueRaw;
      const costBasis = currency === 'USD' ? stock.avgCost * fin.usdToTwd : stock.avgCost;
      const unrealizedPnL = marketValueTWD - costBasis;
      const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
      return {
        symbol: stock.symbol, shortName: quote?.shortName, platform: stock.platform,
        shares: stock.shares, avgCost: stock.avgCost, currentPrice, currency, changePercent,
        marketValueTWD: Math.round(marketValueTWD), costBasis: Math.round(costBasis),
        unrealizedPnL: Math.round(unrealizedPnL), unrealizedPnLPct,
      };
    }),
    pledgeRatioData: buildReportPledgeRatios(pledgeRatios),
    generatedAt: new Date().toISOString(),
  };

  return {
    reportPayload,
    pledgeAlert: alert ? { ...alert, pledgeData: pledgeRatios } : null,
    reportSchedule: fin.reportSchedule,
    lastReportSent: fin.lastReportSent,
    pledgeAlertLastSent: fin.pledgeAlertLastSent,
  };
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `npm test -- src/server/reportEngine.test.ts`
Expected: PASS(3 個測試)

- [ ] **Step 5: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/reportEngine.ts src/server/reportEngine.test.ts
git commit -m "feat: 新增 reportEngine,伺服器端重算單一使用者的資產報表與質押警示"
```

---

## Task 8: 每日檢查邏輯 `dailyCheck.ts` + Cron 端點 + `vercel.json`

**Files:**
- Create: `src/server/dailyCheck.ts`
- Create: `src/server/dailyCheck.test.ts`
- Create: `src/app/api/cron/daily-check/route.ts`
- Create: `vercel.json`(專案根目錄)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `computeUserReport`(Task 7)、`generateAssetReportHtml`、`buildPledgeAlertHtml`(`src/lib/mail.ts`)、`createEntityStore`(`src/server/entityStore.ts`)、`users`/`appState`(`src/db/schema.ts`)
- Produces:
  - `interface DailyCheckDeps { getDb: () => Db; computeUserReport: (db: Db, userId: string) => Promise<UserReportResult>; sendEmail: (args: { to: string; subject: string; html: string }) => Promise<unknown> }`
  - `interface DailyCheckSummary { processed: number; reportsSent: number; alertsSent: number; failures: { userId: string; error: string }[] }`
  - `runDailyCheck(deps: DailyCheckDeps): Promise<DailyCheckSummary>`
  - `GET`(`src/app/api/cron/daily-check/route.ts`,注入真正的 `getDb`/`computeUserReport`/`sendEmail`)

- [ ] **Step 1: 寫失敗測試**

```ts
// src/server/dailyCheck.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, createTestUser } from '../db/testDb';
import type { Db } from '../db/client';
import { appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { runDailyCheck } from './dailyCheck';
import type { UserReportResult } from './reportEngine';

const appStateStore = createEntityStore(appState);
let db: Db;

const baseReport = (overrides: Partial<UserReportResult> = {}): UserReportResult => ({
  reportPayload: {
    totalAssets: 0, totalLiabilities: 0, netWorth: 0,
    totalMonthlyIncome: 0, totalMonthlyExpense: 0, monthlyNetCashFlow: 0,
    usdToTwd: 32, combinedAssets: [], combinedLiabilities: [], loans: [], stakingItems: [], stockItems: [],
    generatedAt: new Date().toISOString(),
  },
  pledgeAlert: null,
  reportSchedule: 'none',
  lastReportSent: '',
  pledgeAlertLastSent: { warning: '', danger: '' },
  ...overrides,
});

beforeEach(async () => {
  db = await createTestDb();
});

describe('runDailyCheck', () => {
  it('沒有使用者時 processed 為 0', async () => {
    const sendEmail = vi.fn();
    const summary = await runDailyCheck({
      getDb: () => db, sendEmail, computeUserReport: vi.fn(),
    });
    expect(summary).toEqual({ processed: 0, reportsSent: 0, alertsSent: 0, failures: [] });
  });

  it('reportSchedule=weekly 且今天是週一時寄送報表,並把 lastReportSent 寫回 appState', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });
    const monday = new Date('2026-08-31T01:00:00Z'); // 2026-08-31 為週一
    vi.useFakeTimers();
    vi.setSystemTime(monday);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'weekly' }),
    });

    expect(summary).toEqual({ processed: 1, reportsSent: 1, alertsSent: 0, failures: [] });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('u1@test.local');

    const rows = await appStateStore.getAll(db, 'u1');
    const lastReportSent = rows.find(r => r.id === 'lastReportSent');
    expect((lastReportSent?.data as { value: string }).value).toBe('2026-08-31');
    vi.useRealTimers();
  });

  it('今天已經寄過(lastReportSent = 今天)就不會重複寄送', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn();
    const monday = new Date('2026-08-31T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(monday);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'weekly', lastReportSent: '2026-08-31' }),
    });

    expect(summary.reportsSent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('有質押警示且今天該等級尚未寄過時寄送警示信,並寫回 pledgeAlertLastSent', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({
        pledgeAlert: { level: 'danger', platform: '元大', ratio: 150, pledgeData: [{ platform: '元大', ratio: 150, borrowValue: 100, collateralValue: 150 }] },
      }),
    });

    expect(summary.alertsSent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const rows = await appStateStore.getAll(db, 'u1');
    const pledgeAlertLastSent = rows.find(r => r.id === 'pledgeAlertLastSent');
    expect((pledgeAlertLastSent?.data as { value: Record<string, string> }).value.danger).toBeTruthy();
  });

  it('沒有 email 的使用者會被跳過,不計入失敗', async () => {
    const db2 = await createTestDb();
    await db2.insert((await import('../db/schema')).users).values({ id: 'no-email' });
    const sendEmail = vi.fn();
    const summary = await runDailyCheck({
      getDb: () => db2, sendEmail, computeUserReport: vi.fn(),
    });
    expect(summary).toEqual({ processed: 1, reportsSent: 0, alertsSent: 0, failures: [] });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('單一使用者 computeUserReport 拋錯不影響其他使用者,記錄到 failures 並印出 console.error', async () => {
    await createTestUser(db, 'bad');
    await createTestUser(db, 'good');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });
    const monday = new Date('2026-08-31T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(monday);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async (_db, userId) => {
        if (userId === 'bad') throw new Error('quote api down');
        return baseReport({ reportSchedule: 'weekly' });
      },
    });

    expect(summary.processed).toBe(2);
    expect(summary.reportsSent).toBe(1);
    expect(summary.failures).toEqual([{ userId: 'bad', error: 'quote api down' }]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bad'), expect.any(Error));
    vi.useRealTimers();
    errorSpy.mockRestore();
  });

  it('reportSchedule=monthly 且今天是 1 號時寄送報表', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn().mockResolvedValue({ messageId: '1' });
    const firstOfMonth = new Date('2026-09-01T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(firstOfMonth);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'monthly' }),
    });

    expect(summary.reportsSent).toBe(1);
    vi.useRealTimers();
  });

  it('reportSchedule=monthly 但今天不是 1 號時不寄送', async () => {
    await createTestUser(db, 'u1');
    const sendEmail = vi.fn();
    const midMonth = new Date('2026-09-15T01:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(midMonth);

    const summary = await runDailyCheck({
      getDb: () => db, sendEmail,
      computeUserReport: async () => baseReport({ reportSchedule: 'monthly' }),
    });

    expect(summary.reportsSent).toBe(0);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 執行測試,確認因檔案不存在而失敗**

Run: `npm test -- src/server/dailyCheck.test.ts`
Expected: FAIL,找不到模組 `./dailyCheck`

- [ ] **Step 3: 建立 `src/server/dailyCheck.ts`**

```ts
// src/server/dailyCheck.ts
import type { Db } from '../db/client';
import { users, appState } from '../db/schema';
import { createEntityStore } from './entityStore';
import { generateAssetReportHtml, buildPledgeAlertHtml } from '../lib/mail';
import type { UserReportResult } from './reportEngine';

const appStateStore = createEntityStore(appState);

export interface DailyCheckDeps {
  getDb: () => Db;
  computeUserReport: (db: Db, userId: string) => Promise<UserReportResult>;
  sendEmail: (args: { to: string; subject: string; html: string }) => Promise<unknown>;
}

export interface DailyCheckSummary {
  processed: number;
  reportsSent: number;
  alertsSent: number;
  failures: { userId: string; error: string }[];
}

async function setAppStateValue(db: Db, userId: string, key: string, value: unknown): Promise<void> {
  const existing = await appStateStore.getAll(db, userId);
  const row = existing.find(r => r.id === key);
  if (row) {
    await appStateStore.update(db, userId, key, { id: key, value }, row.version);
  } else {
    await appStateStore.create(db, userId, key, { id: key, value });
  }
}

function isReportDue(
  schedule: 'none' | 'weekly' | 'monthly',
  lastSent: string,
  today: Date,
  todayStr: string,
): boolean {
  if (schedule === 'none') return false;
  if (lastSent === todayStr) return false;
  if (schedule === 'weekly') return today.getDay() === 1;
  return today.getDate() === 1;
}

export async function runDailyCheck(deps: DailyCheckDeps): Promise<DailyCheckSummary> {
  const db = deps.getDb();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);

  const summary: DailyCheckSummary = { processed: 0, reportsSent: 0, alertsSent: 0, failures: [] };

  for (const user of allUsers) {
    summary.processed += 1;
    if (!user.email) continue;

    try {
      const result = await deps.computeUserReport(db, user.id);

      if (isReportDue(result.reportSchedule, result.lastReportSent, today, todayStr)) {
        const html = generateAssetReportHtml(result.reportPayload);
        await deps.sendEmail({
          to: user.email,
          subject: `📊 AssetDash 資產報表 - ${today.toLocaleDateString('zh-TW')}`,
          html,
        });
        await setAppStateValue(db, user.id, 'lastReportSent', todayStr);
        summary.reportsSent += 1;
      }

      if (result.pledgeAlert && result.pledgeAlertLastSent[result.pledgeAlert.level] !== todayStr) {
        const isDanger = result.pledgeAlert.level === 'danger';
        const html = buildPledgeAlertHtml({
          isDanger,
          platformName: result.pledgeAlert.platform,
          ratio: result.pledgeAlert.ratio,
          pledgeData: result.pledgeAlert.pledgeData,
        });
        const subject = isDanger
          ? `[緊急] 質押維持率 ${result.pledgeAlert.ratio.toFixed(1)}% — 請立即補倉`
          : `[注意] 質押維持率 ${result.pledgeAlert.ratio.toFixed(1)}% — 建議補充保證金`;
        await deps.sendEmail({ to: user.email, subject, html });
        await setAppStateValue(db, user.id, 'pledgeAlertLastSent', {
          ...result.pledgeAlertLastSent,
          [result.pledgeAlert.level]: todayStr,
        });
        summary.alertsSent += 1;
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      // 只記錄 userId,不含 email 等 PII
      console.error(`[daily-check] user ${user.id} failed`, error);
      summary.failures.push({ userId: user.id, error: error.message });
    }
  }

  return summary;
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `npm test -- src/server/dailyCheck.test.ts`
Expected: PASS(8 個測試)

- [ ] **Step 5: 建立 `src/app/api/cron/daily-check/route.ts`**

```ts
// src/app/api/cron/daily-check/route.ts
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getDb } from '../../../../db/client';
import { computeUserReport } from '../../../../server/reportEngine';
import { sendEmail } from '../../../../lib/mail';
import { runDailyCheck } from '../../../../server/dailyCheck';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const summary = await runDailyCheck({ getDb, computeUserReport, sendEmail });
  return NextResponse.json(summary);
}
```

- [ ] **Step 6: 建立 `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/daily-check", "schedule": "0 1 * * *" }
  ]
}
```

- [ ] **Step 7: 在 `.env.example` 加入 `CRON_SECRET`**

在檔案最後加入:

```
# Vercel Cron 驗證用密鑰(自行產生亂數字串,並在 Vercel 專案環境變數設定同樣的值)
CRON_SECRET=
```

- [ ] **Step 8: 跑完整測試與型別檢查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部 PASS

- [ ] **Step 9: 本機手動驗證**

在 `.env.local` 設定 `CRON_SECRET=test123`(以及既有的 `EMAIL_SERVER_*` 若要真的收到信),`npm run dev` 後執行:

```bash
curl -H "Authorization: Bearer test123" http://localhost:3000/api/cron/daily-check
```

Expected: 回傳 JSON 摘要(`processed`/`reportsSent`/`alertsSent`/`failures`),沒有帶正確 header 時打同一支 API 應回 401。

- [ ] **Step 10: Commit**

```bash
git add src/server/dailyCheck.ts src/server/dailyCheck.test.ts src/app/api/cron/daily-check/route.ts vercel.json .env.example
git commit -m "feat: 新增 daily-check cron 端點,伺服器每天自動檢查資產報表排程與質押警示"
```

---

## Task 9: 前端移除自動判斷寄信的 `useEffect`(改由伺服器 cron 負責)

**Files:**
- Modify: `src/components/EmailReportSender.tsx`
- Modify: `src/app/debt/page.tsx`

伺服器 cron(Task 8)已經每天自動檢查並寄送報表與質押警示,前端不應該再各自判斷寄送,否則同一天可能被寄兩次(一次前端、一次 cron)。這個任務只刪除觸發邏輯,不動 UI 顯示(質押橫幅、手動寄送按鈕都保留)。

- [ ] **Step 1: 修改 `src/components/EmailReportSender.tsx`,移除排程自動寄送的 `useEffect`**

刪除現有第 25-51 行:

```ts
  useEffect(() => {
    if (ctx.reportSchedule === 'none' || !ctx.userEmail) return;
    if (ctx.assetsLoading) return; // 雲端資料載入中，避免寄出全零報表並誤標「今日已寄送」

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');

    if (ctx.lastReportSent === todayStr) return;

    const shouldSend =
      (ctx.reportSchedule === 'weekly' && today.getDay() === 1) ||
      (ctx.reportSchedule === 'monthly' && today.getDate() === 1);

    if (!shouldSend) return;

    fetch('/api/cron/send-asset-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: ctx.userEmail,
        reportData: buildReportData(),
      }),
    })
      .then(res => { if (res.ok) ctx.setLastReportSent(todayStr); })
      .catch(() => toast('自動報表寄送失敗', 'error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.reportSchedule, ctx.lastReportSent, ctx.userEmail, ctx.assetsLoading]);

```

(緊接其後的 `useEffect(() => { if (isOpen) {...} }, [isOpen, ctx.userEmail]);` 那段維持不動。)

- [ ] **Step 2: 修改 `src/app/debt/page.tsx`,移除質押警示自動寄送的 `useEffect`**

刪除現有第 137-158 行:

```ts
  useEffect(() => {
    if (!alertLevel || !userEmail || !minPlatform) return;
    const today = new Date().toISOString().split('T')[0];
    if (pledgeAlertLastSent[alertLevel] === today) return;

    fetch('/api/pledge-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: userEmail,
        alertLevel,
        platformName: minPlatform,
        ratio: minRatio,
        pledgeData: allPlatformRatios,
      }),
    })
      .then(res => {
        if (res.ok) setPledgeAlertLastSent(prev => ({ ...prev, [alertLevel]: today }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertLevel, minRatio, minPlatform]);

```

因為 `userEmail`、`pledgeAlertLastSent`、`setPledgeAlertLastSent` 只在這個 `useEffect` 裡用到,把檔案開頭 `useAppContext()` 的解構(第 31-42 行)裡的這三個欄位一併移除:

```ts
  const {
    loans, setLoans, recordLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimits, setBorrowingLimits,
    stockItems, stockQuotes,
    usdToTwd,
    pledgeAlertLastSent, setPledgeAlertLastSent,
    userEmail,
    showValues,
    enablePledgeTracking,
    assetsLoading,
  } = useAppContext();
```

改成:

```ts
  const {
    loans, setLoans, recordLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimits, setBorrowingLimits,
    stockItems, stockQuotes,
    usdToTwd,
    showValues,
    enablePledgeTracking,
    assetsLoading,
  } = useAppContext();
```

- [ ] **Step 3: 跑完整測試、型別檢查與 lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 全部 PASS,無 unused-var lint 錯誤

- [ ] **Step 4: 手動驗證**

Run: `npm run dev`:
1. 打開 `/debt` 頁面,確認質押維持率警示橫幅(若有)仍正常顯示。
2. 打開「寄送報表」彈窗,確認「立即寄送」按鈕仍能正常寄信。
3. 確認畫面上不再有任何「一開啟頁面就自動打 `/api/cron/send-asset-report` 或 `/api/pledge-alert`」的網路請求(開瀏覽器 DevTools Network 面板檢查)。

- [ ] **Step 5: Commit**

```bash
git add src/components/EmailReportSender.tsx src/app/debt/page.tsx
git commit -m "refactor: 移除前端自動判斷寄信邏輯,改由伺服器 daily-check cron 統一負責"
```

---

## 部署前提醒(非本計畫任務,留給使用者手動操作)

1. 在 Vercel 專案的 Environment Variables 設定 `CRON_SECRET`(與本機測試用的值可以不同,正式環境自行產生一組亂數字串)。
2. 確認 `EMAIL_SERVER_HOST`/`EMAIL_SERVER_PORT`/`EMAIL_SERVER_USER`/`EMAIL_SERVER_PASSWORD`/`EMAIL_FROM` 也都在 Vercel 環境變數設定好(這些是既有需求,`send-asset-report`/`pledge-alert` 手動寄送本來就需要,cron 沿用同一套)。
3. 部署後可以在 Vercel Dashboard 的 Cron Jobs 頁面手動觸發一次 `daily-check`,確認執行紀錄與 log 正常。

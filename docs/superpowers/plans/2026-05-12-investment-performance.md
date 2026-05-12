# 投資績效分析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在股票頁新增「績效」Tab，透過 Yahoo Finance API 自動拉取股利歷史，計算含息總報酬率與年化報酬率。

**Architecture:** 新增 `/api/dividends` route 使用現有 yahoo-finance2；AppContext 加入 `DividendRecord` 持久化狀態；股票頁加入 Tab 切換，績效 Tab 讀取計算結果展示。

**Tech Stack:** Next.js 15 App Router、TypeScript、yahoo-finance2（已安裝）、Tailwind CSS 4

---

## File Map

| 動作 | 路徑 | 說明 |
|------|------|------|
| 新增 | `src/app/api/dividends/route.ts` | Yahoo Finance 股利歷史 API（24h 快取） |
| 修改 | `src/context/AppContext.tsx` | 加入 DividendRecord 型別與 useStickyState |
| 新增 | `src/components/StocksPerformanceTab.tsx` | 績效 Tab UI（摘要列 + 每股明細 + 股利記錄） |
| 修改 | `src/app/stocks/page.tsx` | 加入 Tab 切換（持倉 / 績效） |

---

## Task 1: 建立 `/api/dividends` Route

**Files:**
- Create: `src/app/api/dividends/route.ts`

- [ ] **Step 1: 建立 `src/app/api/dividends/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

type DividendEntry = { date: string; dividendPerShare: number };

const cache = new Map<string, { data: DividendEntry[]; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const from = searchParams.get('from') ?? '2020-01-01';

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  const cacheKey = `${symbol}:${from}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const history = await yf.historical(symbol, {
      period1: from,
      events: 'dividends',
    });

    const dividends: DividendEntry[] = (history as any[])
      .filter(h => typeof h.dividends === 'number' && h.dividends > 0)
      .map(h => ({
        date: (h.date instanceof Date ? h.date : new Date(h.date)).toISOString().split('T')[0],
        dividendPerShare: h.dividends as number,
      }));

    cache.set(cacheKey, { data: dividends, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(dividends);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching dividends:', message);
    return NextResponse.json({ error: 'Failed to fetch dividends', details: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 手動測試 API（dev server 啟動中）**

```bash
npm run dev
```

在瀏覽器或 terminal 呼叫：
```
http://localhost:3000/api/dividends?symbol=2330.TW&from=2023-01-01
```

預期：JSON 陣列，含 `date` 和 `dividendPerShare`，例如：
```json
[{"date":"2023-07-05","dividendPerShare":3.0},{"date":"2024-01-05","dividendPerShare":3.5}]
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dividends/route.ts
git commit -m "feat: add /api/dividends route using yahoo-finance2 with 24h cache"
```

---

## Task 2: 擴充 AppContext 加入 DividendRecord

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: 在 `src/context/AppContext.tsx` 加入型別定義**

在 `StockItem` 型別定義之後（約第 131 行附近），加入：

```typescript
export type DividendRecord = {
  id: string;
  symbol: string;
  date: string;           // YYYY-MM-DD
  dividendPerShare: number;
  shares: number;         // 持有股數（除息當時）
  currency: 'TWD' | 'USD';
  source: 'auto' | 'manual';
};
```

- [ ] **Step 2: 在 `AppProvider` 函式內加入 state**

找到：
```typescript
const [stockItems, setStockItems] = useStickyState<StockItem[]>(initialStockData, 'app-stocks-v1');
```

在其下方加入：
```typescript
const [dividendRecords, setDividendRecords] = useStickyState<DividendRecord[]>([], 'app-dividends-v1');
```

- [ ] **Step 3: 加入 `clearAllData` 清除邏輯**

找到 `clearAllData` 函式：
```typescript
const clearAllData = () => {
  setAssets([]);
  setLiabilities([]);
  setStakingItems([]);
  setLoans([]);
  setStockItems([]);
  setIncomeItems([]);
  setExpenseItems([]);
  setAnnualEntries([]);
  setSnapshots([]);
};
```

加入 `setDividendRecords([]);`：
```typescript
const clearAllData = () => {
  setAssets([]);
  setLiabilities([]);
  setStakingItems([]);
  setLoans([]);
  setStockItems([]);
  setDividendRecords([]);
  setIncomeItems([]);
  setExpenseItems([]);
  setAnnualEntries([]);
  setSnapshots([]);
};
```

- [ ] **Step 4: 加入 `AppContextType` interface 宣告**

在 `AppContextType` interface 中（找 `stockQuotes` 那一區塊附近）加入：
```typescript
dividendRecords: DividendRecord[];
setDividendRecords: (records: DividendRecord[] | ((prev: DividendRecord[]) => DividendRecord[])) => void;
```

- [ ] **Step 5: 加入 Provider value**

在 `<AppContext.Provider value={{` 的物件中加入：
```typescript
dividendRecords,
setDividendRecords,
```

- [ ] **Step 6: 驗證 TypeScript**

```bash
npx tsc --noEmit
```

預期：無錯誤

- [ ] **Step 7: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add DividendRecord type and state to AppContext"
```

---

## Task 3: 建立 `StocksPerformanceTab` 元件

**Files:**
- Create: `src/components/StocksPerformanceTab.tsx`

- [ ] **Step 1: 建立 `src/components/StocksPerformanceTab.tsx`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { useAppContext, type DividendRecord, type StockItem, type StockQuote } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

// ─── 計算輔助 ─────────────────────────────────────────────────────────────────

function calcCostBasisTWD(item: StockItem, usdToTwd: number): number {
  const base = item.avgCost * item.shares;
  // 台股 avgCost 已是 TWD，美股需換算
  return item.symbol.endsWith('.TW') || item.symbol.endsWith('.TWO') ? base : base * usdToTwd;
}

function calcCurrentValueTWD(item: StockItem, quote: StockQuote | undefined, usdToTwd: number): number {
  if (!quote) return 0;
  const value = quote.price * item.shares;
  return quote.currency === 'USD' ? value * usdToTwd : value;
}

function calcDividendsTWD(
  symbol: string,
  records: DividendRecord[],
  usdToTwd: number,
): number {
  return records
    .filter(r => r.symbol === symbol)
    .reduce((sum, r) => {
      const total = r.dividendPerShare * r.shares;
      return sum + (r.currency === 'USD' ? total * usdToTwd : total);
    }, 0);
}

function calcAnnualizedReturn(
  costBasis: number,
  currentValue: number,
  dividends: number,
  purchaseDate: string | undefined,
): number | null {
  if (!purchaseDate || costBasis <= 0) return null;
  const holdingDays = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000);
  if (holdingDays < 7) return null;
  const totalReturn = (currentValue - costBasis + dividends) / costBasis;
  return Math.pow(1 + totalReturn, 365 / holdingDays) - 1;
}

// ─── 股利新增列 ───────────────────────────────────────────────────────────────

function AddDividendRow({
  symbol,
  currentShares,
  currency,
  onConfirm,
  onCancel,
}: {
  symbol: string;
  currentShares: number;
  currency: 'TWD' | 'USD';
  onConfirm: (record: Omit<DividendRecord, 'id' | 'source'>) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dps, setDps] = useState('');
  const [shares, setShares] = useState(String(currentShares));

  return (
    <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg text-sm">
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="border border-indigo-200 rounded px-2 py-1 text-xs bg-white"
      />
      <input
        type="number"
        placeholder="每股股利"
        value={dps}
        onChange={e => setDps(e.target.value)}
        className="w-24 border border-indigo-200 rounded px-2 py-1 text-xs text-right bg-white"
      />
      <input
        type="number"
        placeholder="股數"
        value={shares}
        onChange={e => setShares(e.target.value)}
        className="w-24 border border-indigo-200 rounded px-2 py-1 text-xs text-right bg-white"
      />
      <button
        onClick={() => onConfirm({ symbol, date, dividendPerShare: Number(dps), shares: Number(shares), currency })}
        className="text-indigo-600 hover:text-indigo-800"
      >
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── 每股績效列 ───────────────────────────────────────────────────────────────

function StockPerformanceRow({
  item,
  quote,
  dividendRecords,
  usdToTwd,
  onAddDividend,
  onDeleteDividend,
}: {
  item: StockItem;
  quote: StockQuote | undefined;
  dividendRecords: DividendRecord[];
  usdToTwd: number;
  onAddDividend: (record: Omit<DividendRecord, 'id' | 'source'>) => void;
  onDeleteDividend: (id: string) => void;
}) {
  const [showDividends, setShowDividends] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const costBasis = calcCostBasisTWD(item, usdToTwd);
  const currentValue = calcCurrentValueTWD(item, quote, usdToTwd);
  const dividends = calcDividendsTWD(item.symbol, dividendRecords, usdToTwd);
  const unrealized = currentValue - costBasis;
  const totalReturn = costBasis > 0 ? (unrealized + dividends) / costBasis : 0;
  const annualized = calcAnnualizedReturn(costBasis, currentValue, dividends, item.purchaseDate);

  const myDividends = dividendRecords.filter(r => r.symbol === item.symbol);
  const displayName = quote?.shortName ?? item.symbol;
  const currency: 'TWD' | 'USD' = (item.symbol.endsWith('.TW') || item.symbol.endsWith('.TWO')) ? 'TWD' : 'USD';

  const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="p-4 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400">{item.symbol}</p>
          </div>

          <div className="grid grid-cols-4 gap-4 text-right flex-shrink-0 text-sm">
            <div>
              <p className="text-xs text-gray-400">投入成本</p>
              <p className="font-medium">{costBasis > 0 ? fmt(costBasis) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">未實現損益</p>
              <p className={`font-bold ${unrealized >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {currentValue > 0 ? fmtPct((unrealized) / costBasis) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">已收股利</p>
              <p className="font-medium text-emerald-600">{dividends > 0 ? fmt(dividends) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">年化報酬</p>
              <p className={`font-bold ${annualized !== null ? (annualized >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-400'}`}>
                {annualized !== null ? fmtPct(annualized) : (item.purchaseDate ? '—' : '未設購買日')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDividends(v => !v)}
            className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            股利 ({myDividends.length}) {showDividends ? '▲' : '▼'}
          </button>
        </div>

        {/* 含息總報酬 */}
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2">
          <span className="text-xs text-gray-400">含息總報酬：</span>
          <span className={`text-sm font-bold ${totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {costBasis > 0 ? fmtPct(totalReturn) : '—'}
          </span>
        </div>
      </div>

      {/* 股利展開區 */}
      {showDividends && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
          {myDividends.length === 0 && !isAdding && (
            <p className="text-xs text-gray-400 text-center py-2">尚無股利記錄</p>
          )}
          {myDividends.map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2">
              <span className="text-gray-500">{r.date}</span>
              <span>每股 {r.dividendPerShare} · {r.shares.toLocaleString()} 股</span>
              <span className="font-medium text-emerald-600">
                {fmt(r.dividendPerShare * r.shares)} {r.currency}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.source === 'auto' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                {r.source === 'auto' ? 'Auto' : '手動'}
              </span>
              <button onClick={() => onDeleteDividend(r.id)} className="text-gray-300 hover:text-rose-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {isAdding && (
            <AddDividendRow
              symbol={item.symbol}
              currentShares={item.shares}
              currency={currency}
              onConfirm={record => { onAddDividend(record); setIsAdding(false); }}
              onCancel={() => setIsAdding(false)}
            />
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="w-full text-xs text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 py-1"
          >
            <Plus className="w-3 h-3" /> 手動新增股利
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export function StocksPerformanceTab() {
  const {
    stockItems, stockQuotes, dividendRecords, setDividendRecords, usdToTwd,
  } = useAppContext();
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(false);

  const fetchAllDividends = useCallback(async () => {
    const eligible = stockItems.filter(s => s.purchaseDate);
    if (eligible.length === 0) return;
    setIsFetching(true);
    try {
      const results = await Promise.allSettled(
        eligible.map(async item => {
          const res = await fetch(`/api/dividends?symbol=${item.symbol}&from=${item.purchaseDate}`);
          if (!res.ok) return;
          const data: { date: string; dividendPerShare: number }[] = await res.json();
          return { item, data };
        })
      );

      setDividendRecords(prev => {
        let updated = [...prev];
        for (const result of results) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const { item, data } = result.value;
          const currency: 'TWD' | 'USD' = (item.symbol.endsWith('.TW') || item.symbol.endsWith('.TWO')) ? 'TWD' : 'USD';
          for (const d of data) {
            const exists = updated.some(r => r.symbol === item.symbol && r.date === d.date && r.source === 'auto');
            if (!exists) {
              updated.push({
                id: `auto-${item.symbol}-${d.date}`,
                symbol: item.symbol,
                date: d.date,
                dividendPerShare: d.dividendPerShare,
                shares: item.shares,
                currency,
                source: 'auto',
              });
            }
          }
        }
        return updated;
      });
      toast('股利資料已同步');
    } catch {
      toast('同步失敗，請稍後再試', 'error');
    } finally {
      setIsFetching(false);
    }
  }, [stockItems, setDividendRecords, toast]);

  // 首次進入 Tab 自動同步（只跑一次）
  useEffect(() => {
    fetchAllDividends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddDividend = (record: Omit<DividendRecord, 'id' | 'source'>) => {
    setDividendRecords(prev => [
      ...prev,
      { ...record, id: `manual-${Date.now()}`, source: 'manual' },
    ]);
    toast('已新增股利記錄');
  };

  const handleDeleteDividend = (id: string) => {
    setDividendRecords(prev => prev.filter(r => r.id !== id));
    toast('已刪除股利記錄', 'info');
  };

  // 摘要計算
  const totalCost = stockItems.reduce((sum, item) => {
    const cost = item.avgCost * item.shares;
    const quote = stockQuotes[item.symbol];
    const isUSD = quote?.currency === 'USD';
    return sum + (isUSD ? cost * usdToTwd : cost);
  }, 0);

  const totalValue = stockItems.reduce((sum, item) => {
    const quote = stockQuotes[item.symbol];
    if (!quote) return sum;
    const value = quote.price * item.shares;
    return sum + (quote.currency === 'USD' ? value * usdToTwd : value);
  }, 0);

  const totalDividends = dividendRecords.reduce((sum, r) => {
    const total = r.dividendPerShare * r.shares;
    return sum + (r.currency === 'USD' ? total * usdToTwd : total);
  }, 0);

  const totalUnrealized = totalValue - totalCost;
  const totalReturn = totalCost > 0 ? (totalUnrealized + totalDividends) / totalCost : 0;
  const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      {/* 摘要列 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '總投入成本', value: fmt(totalCost), color: 'text-gray-900' },
          { label: '目前市值', value: fmt(totalValue), color: 'text-gray-900' },
          { label: '未實現損益', value: fmtPct(totalCost > 0 ? totalUnrealized / totalCost : 0), color: totalUnrealized >= 0 ? 'text-emerald-600' : 'text-rose-600' },
          { label: '已收股利', value: fmt(totalDividends), color: 'text-emerald-600' },
          { label: '含息總報酬', value: fmtPct(totalReturn), color: totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 同步按鈕 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">股利資料來自 Yahoo Finance，每次進入頁面自動同步</p>
        <button
          onClick={fetchAllDividends}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? '同步中…' : '重新同步'}
        </button>
      </div>

      {/* 每股明細 */}
      <div className="space-y-3">
        {stockItems.length === 0 && (
          <p className="text-center text-gray-400 py-8">尚無持倉，請至「持倉」Tab 新增股票</p>
        )}
        {stockItems.map(item => (
          <StockPerformanceRow
            key={item.id}
            item={item}
            quote={stockQuotes[item.symbol]}
            dividendRecords={dividendRecords}
            usdToTwd={usdToTwd}
            onAddDividend={handleAddDividend}
            onDeleteDividend={handleDeleteDividend}
          />
        ))}
      </div>

      {stockItems.some(s => !s.purchaseDate) && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
          ⚠️ 部分股票未設定「購買日期」，年化報酬率與自動股利同步需要此資訊。請至「持倉」Tab 編輯。
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 確認 TypeScript 無誤**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StocksPerformanceTab.tsx
git commit -m "feat: add StocksPerformanceTab with dividend sync and performance metrics"
```

---

## Task 4: 在股票頁加入 Tab 切換

**Files:**
- Modify: `src/app/stocks/page.tsx`

- [ ] **Step 1: 在 `src/app/stocks/page.tsx` 加入 import**

在檔案頂部 import 區加入：
```typescript
import { StocksPerformanceTab } from '../../components/StocksPerformanceTab';
```

- [ ] **Step 2: 在 `stocks/page.tsx` 元件內加入 tab state**

在元件最上方現有的 `useState` 之後加入：
```typescript
const [activeTab, setActiveTab] = useState<'holdings' | 'performance'>('holdings');
```

- [ ] **Step 3: 加入 Tab 切換按鈕**

找到頁面標題區塊（h1 或頂部 flex 區域），在其下方加入：
```typescript
{/* Tab 切換 */}
<div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
  {(['holdings', 'performance'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tab
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {tab === 'holdings' ? '持倉' : '績效分析'}
    </button>
  ))}
</div>
```

- [ ] **Step 4: 用條件渲染包住現有內容，並加入績效 Tab**

找到現有的股票持倉內容開始處，用條件渲染包住：
```typescript
{activeTab === 'holdings' && (
  // 現有所有持倉相關 JSX
)}

{activeTab === 'performance' && (
  <StocksPerformanceTab />
)}
```

- [ ] **Step 5: 驗證並手動測試**

```bash
npm run dev
```

- 前往 `/stocks`，確認 Tab 切換正常
- 切換到「績效分析」Tab，確認摘要列顯示
- 確認股利記錄展開/收合
- 確認「重新同步」按鈕可觸發 API

- [ ] **Step 6: Commit**

```bash
git add src/app/stocks/page.tsx
git commit -m "feat: add performance tab with dividend sync to stocks page"
```

---

## Self-Review Checklist

- [x] `/api/dividends` 使用與 `/api/quote` 相同的 `yahoo-finance2` 實例，不引入新依賴
- [x] `DividendRecord.source` 區分 auto/manual，UI 顯示對應標籤
- [x] 自動同步以 `symbol + date + source=auto` 去重，避免重複累積
- [x] `calcCostBasisTWD` 正確區分台股（TWD）與美股（USD × usdToTwd）
- [x] 年化報酬率在 `holdingDays < 7` 時返回 null，避免短期持倉失真
- [x] `clearAllData` 包含 `setDividendRecords([])`
- [x] 股票頁 Tab 切換不破壞現有持倉功能

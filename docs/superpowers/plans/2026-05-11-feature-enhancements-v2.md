# Feature Enhancements V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 remaining features: fix hardcoded usdToTwd, add goal ETA in HeroKPI, stock portfolio weight, pledge expiry banners, asset allocation donut chart, multi-currency rates, report auto-schedule, and PWA support.

**Architecture:** State additions go through AppContext with useStickyState. New visuals are isolated components. Auto-schedule runs as a side effect in EmailReportSender after stock quotes load (lastUpdated changes). PWA uses a manually-registered service worker with a cache-first strategy.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4.3, Recharts 3.8 (PieChart), Nodemailer (SMTP already configured), localStorage via useStickyState.

---

## Pre-flight: What already exists (do NOT rebuild)

- Loan repayment progress bar: already in `InstallmentLoanCard` (`progress` variable + `h-1.5 bg-rose-400` bar)
- Annual cash flow chart: already in `src/app/annual/page.tsx`
- Stock per-item P&L display: already in `StockRow` (profit, profitPercent)

## File Structure

**Create:**
- `src/components/AssetAllocationChart.tsx` — Recharts PieChart showing asset distribution vs 60/40 reference
- `public/manifest.json` — PWA web app manifest
- `public/sw.js` — cache-first service worker

**Modify:**
- `src/context/AppContext.tsx` — add `extraRates`, `reportSchedule`, `lastReportSent`
- `src/app/stocks/page.tsx` — remove hardcoded `usdToTwd = 32`, add portfolio weight to StockRow
- `src/components/EmailReportSender.tsx` — fix hardcoded `usdToTwd`, add auto-schedule effect
- `src/components/HeroKPI.tsx` — add `monthlyNetCashFlow` prop + ETA display
- `src/app/page.tsx` — pass `monthlyNetCashFlow` to HeroKPI, insert AssetAllocationChart
- `src/app/staking/page.tsx` — add repayDate expiry banners
- `src/app/settings/page.tsx` — add EUR/JPY/HKD inputs + schedule selector
- `src/app/layout.tsx` — add manifest link, theme-color meta, SW registration

---

### Task 1: Fix hardcoded `usdToTwd = 32` in stocks page and email sender

**Files:**
- Modify: `src/app/stocks/page.tsx`
- Modify: `src/components/EmailReportSender.tsx`

- [ ] **Step 1: Add usdToTwd to stocks/page.tsx destructuring**

In `src/app/stocks/page.tsx`, find:
```tsx
const { stockItems, setStockItems, stockQuotes, refreshQuotes, lastUpdated } = useAppContext();
```
Replace with:
```tsx
const { stockItems, setStockItems, stockQuotes, refreshQuotes, lastUpdated, usdToTwd } = useAppContext();
```

- [ ] **Step 2: Remove hardcoded constant**

In the same file, find and delete the line:
```tsx
const usdToTwd = 32;
```
(appears around line 362 inside `StocksPage`, after the `profitPercent` calculation)

- [ ] **Step 3: Fix EmailReportSender.tsx**

In `src/components/EmailReportSender.tsx`, inside `buildReportData()`, find:
```tsx
const usdToTwd = 32;
```
Replace with:
```tsx
const usdToTwd = ctx.usdToTwd;
```

- [ ] **Step 4: Commit**
```bash
git add src/app/stocks/page.tsx src/components/EmailReportSender.tsx
git commit -m "fix: use context usdToTwd instead of hardcoded 32 in stocks and email sender"
```

---

### Task 2: HeroKPI — estimated months and date to reach goal

**Files:**
- Modify: `src/components/HeroKPI.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add monthlyNetCashFlow to HeroKPIProps interface**

In `src/components/HeroKPI.tsx`, update the interface:
```tsx
interface HeroKPIProps {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  formatCurrency: (amount: number) => string;
  netWorthGoal: number;
  setNetWorthGoal: (goal: number) => void;
  monthlyNetCashFlow: number;
}
```

Update function signature:
```tsx
export function HeroKPI({ netWorth, totalAssets, totalLiabilities, formatCurrency, netWorthGoal, setNetWorthGoal, monthlyNetCashFlow }: HeroKPIProps) {
```

- [ ] **Step 2: Calculate ETA**

After `const overPct = rawPct - 100;`, add:
```tsx
const monthsToGoal =
  hasGoal && !achieved && monthlyNetCashFlow > 0
    ? Math.ceil((netWorthGoal - netWorth) / monthlyNetCashFlow)
    : null;
const goalETA =
  monthsToGoal !== null
    ? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + monthsToGoal);
        return `${d.getFullYear()}年${d.getMonth() + 1}月`;
      })()
    : null;
```

- [ ] **Step 3: Show ETA in JSX**

Find:
```tsx
<span className="text-gray-400">
  距目標還差 {((netWorthGoal - netWorth) / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬
</span>
```
Replace with:
```tsx
<span className="text-gray-400">
  距目標還差 {((netWorthGoal - netWorth) / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬
  {goalETA && (
    <span className="block text-indigo-500 mt-0.5">
      預估 {monthsToGoal} 個月達成（{goalETA}）
    </span>
  )}
</span>
```

- [ ] **Step 4: Pass prop from page.tsx**

In `src/app/page.tsx`, find `<HeroKPI` usage and add prop:
```tsx
<HeroKPI
  netWorth={netWorth}
  totalAssets={totalAssets}
  totalLiabilities={totalLiabilities}
  formatCurrency={formatCurrency}
  netWorthGoal={netWorthGoal}
  setNetWorthGoal={setNetWorthGoal}
  monthlyNetCashFlow={monthlyNetCashFlow}
/>
```

- [ ] **Step 5: Commit**
```bash
git add src/components/HeroKPI.tsx src/app/page.tsx
git commit -m "feat: add estimated months and date to reach net worth goal in HeroKPI"
```

---

### Task 3: Stock portfolio weight (持倉比重)

**Files:**
- Modify: `src/app/stocks/page.tsx`

- [ ] **Step 1: Add totalPortfolioTWD prop to StockRow**

Find the `StockRow` function definition (search for `function StockRow`). Update its props interface:
```tsx
function StockRow({
  item,
  quote,
  usdToTwd,
  totalPortfolioTWD,
  onUpdate,
  onDelete
}: {
  item: StockItem,
  quote?: StockQuote,
  usdToTwd: number,
  totalPortfolioTWD: number,
  onUpdate: (data: Partial<StockItem>) => void,
  onDelete: () => void
}) {
```

- [ ] **Step 2: Add weight calculation inside StockRow**

After `const valueTWD = isUSD ? totalValue * usdToTwd : totalValue;`, add:
```tsx
const portfolioWeight = totalPortfolioTWD > 0 ? (valueTWD / totalPortfolioTWD) * 100 : 0;
```

- [ ] **Step 3: Show weight below market value**

Find:
```tsx
<div className="w-36">
  <p className="text-xs text-gray-400 mb-1">總市值 (TWD)</p>
  <p className="text-base font-semibold text-gray-900 tabular-nums">{Math.round(valueTWD).toLocaleString()}</p>
  <p className="text-sm text-transparent mt-0.5">-</p>
</div>
```
Replace with:
```tsx
<div className="w-36">
  <p className="text-xs text-gray-400 mb-1">總市值 (TWD)</p>
  <p className="text-base font-semibold text-gray-900 tabular-nums">{Math.round(valueTWD).toLocaleString()}</p>
  <p className="text-sm text-gray-400 mt-0.5 tabular-nums">{portfolioWeight.toFixed(1)}%</p>
</div>
```

- [ ] **Step 4: Pass totalPortfolioTWD when rendering StockRow**

In the groups render, find `<StockRow` calls inside the `items.map` and add the prop:
```tsx
<StockRow
  key={item.id}
  item={item}
  quote={stockQuotes[item.symbol]}
  usdToTwd={usdToTwd}
  totalPortfolioTWD={totalValueTWD}
  onUpdate={(data) => handleUpdate(item.id, data)}
  onDelete={() => handleDelete(item.id, item.symbol)}
/>
```

- [ ] **Step 5: Commit**
```bash
git add src/app/stocks/page.tsx
git commit -m "feat: show portfolio weight percentage in stock list"
```

---

### Task 4: Pledge repayDate expiry banners

**Files:**
- Modify: `src/app/staking/page.tsx`

- [ ] **Step 1: Add expiry calculation after borrowStaking**

In `BorrowingPage`, after `const borrowStaking = stakingItems.filter(...)` line, add:
```tsx
const expiringItems = useMemo(() => {
  const today = new Date();
  return borrowStaking
    .filter(item => !!item.repayDate)
    .map(item => {
      const daysLeft = Math.ceil(
        (new Date(item.repayDate!).getTime() - today.getTime()) / 86400000
      );
      return { ...item, daysLeft };
    })
    .filter(item => item.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}, [borrowStaking]);
```

- [ ] **Step 2: Render expiry banners in JSX**

Find `{alertLevel && (<PledgeAlertBanner ... />)}` in the JSX return. Add this block immediately after it:
```tsx
{expiringItems.map(item => {
  const isDanger = item.daysLeft <= 7;
  return (
    <div
      key={`expiry-${item.id}`}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 ${
        isDanger
          ? 'bg-red-50 border-red-300 text-red-800'
          : 'bg-yellow-50 border-yellow-300 text-yellow-800'
      }`}
    >
      {isDanger
        ? <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" />
        : <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600" />}
      <p className="flex-1 text-sm font-medium">
        {isDanger
          ? `⚠️ 緊急：「${item.name}」（${item.protocol}）質押借款將於 ${item.daysLeft} 天後到期（${item.repayDate}），請立即安排還款`
          : `⏰ 注意：「${item.name}」（${item.protocol}）質押借款將於 ${item.daysLeft} 天後到期（${item.repayDate}）`}
      </p>
    </div>
  );
})}
```

- [ ] **Step 3: Commit**
```bash
git add src/app/staking/page.tsx
git commit -m "feat: add pledge repayDate expiry banners (7/30 day warnings)"
```

---

### Task 5: Asset allocation donut chart

**Files:**
- Create: `src/components/AssetAllocationChart.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create AssetAllocationChart.tsx**

Create `src/components/AssetAllocationChart.tsx`:
```tsx
"use client";

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { AssetCategory } from '../context/AppContext';

const COLORS = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

interface AssetAllocationChartProps {
  combinedAssets: AssetCategory[];
  totalAssets: number;
  showValues: boolean;
}

export function AssetAllocationChart({ combinedAssets, totalAssets, showValues }: AssetAllocationChartProps) {
  const data = useMemo(() =>
    combinedAssets
      .map(cat => ({
        name: cat.title,
        value: cat.items.reduce((s, i) => s + i.amount, 0),
      }))
      .filter(d => d.value > 0),
    [combinedAssets]
  );

  if (data.length === 0 || totalAssets === 0) return null;

  const investmentValue = data
    .filter(d => d.name === '投資')
    .reduce((s, d) => s + d.value, 0);
  const growthPct = totalAssets > 0 ? ((investmentValue / totalAssets) * 100).toFixed(1) : '0';
  const stablePct = (100 - parseFloat(growthPct)).toFixed(1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">資產配置分析</h3>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            投資型 {growthPct}%
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
            穩定型 {stablePct}%
          </span>
        </div>
      </div>

      {showValues ? (
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="shrink-0">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `NT$ ${Math.round(value).toLocaleString('en-US')}`,
                    '',
                  ]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-2.5 w-full">
            {data.map((item, i) => {
              const pct = totalAssets > 0 ? ((item.value / totalAssets) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700 w-20 shrink-0">{item.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct.toFixed(1)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 w-10 text-right tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              參考：傳統 60/40 配置建議投資型佔 60%，穩定型佔 40%
            </p>
          </div>
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-xl">
          數值已隱藏
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to dashboard**

In `src/app/page.tsx`, add import at top:
```tsx
import { AssetAllocationChart } from '../components/AssetAllocationChart';
```

After `<NetWorthChart ... />`, insert:
```tsx
<AssetAllocationChart
  combinedAssets={combinedAssets}
  totalAssets={totalAssets}
  showValues={showValues}
/>
```

- [ ] **Step 3: Commit**
```bash
git add src/components/AssetAllocationChart.tsx src/app/page.tsx
git commit -m "feat: add asset allocation donut chart to dashboard"
```

---

### Task 6: Multi-currency rates (EUR / JPY / HKD)

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Add extraRates to AppContextType**

In `src/context/AppContext.tsx`, in the `AppContextType` interface, add after the `setUsdToTwd` line:
```tsx
extraRates: { EUR: number; JPY: number; HKD: number };
setExtraRates: (rates: { EUR: number; JPY: number; HKD: number } | ((prev: { EUR: number; JPY: number; HKD: number }) => { EUR: number; JPY: number; HKD: number })) => void;
```

- [ ] **Step 2: Add useStickyState in AppProvider**

After `const [usdToTwd, setUsdToTwd] = useStickyState<number>(32, 'app-usd-twd-v1');`, add:
```tsx
const [extraRates, setExtraRates] = useStickyState<{ EUR: number; JPY: number; HKD: number }>(
  { EUR: 35, JPY: 0.21, HKD: 4.1 },
  'app-extra-rates-v1'
);
```

- [ ] **Step 3: Add to Provider value**

In `<AppContext.Provider value={{...}}>`, after `setUsdToTwd,` add:
```tsx
extraRates,
setExtraRates,
```

- [ ] **Step 4: Add rate inputs to Settings page**

In `src/app/settings/page.tsx`:

Add to `useAppContext()` destructuring:
```tsx
extraRates, setExtraRates,
```

Add local state after `localUsdRate`:
```tsx
const [localEUR, setLocalEUR] = useState(extraRates.EUR.toString());
const [localJPY, setLocalJPY] = useState(extraRates.JPY.toString());
const [localHKD, setLocalHKD] = useState(extraRates.HKD.toString());
```

Update `handleSave` to also save extra rates:
```tsx
const eur = parseFloat(localEUR);
const jpy = parseFloat(localJPY);
const hkd = parseFloat(localHKD);
if (!isNaN(eur) && eur > 0 && !isNaN(jpy) && jpy > 0 && !isNaN(hkd) && hkd > 0) {
  setExtraRates({ EUR: eur, JPY: jpy, HKD: hkd });
}
```

Update `hasChanges` to include:
```tsx
parseFloat(localEUR) !== extraRates.EUR ||
parseFloat(localJPY) !== extraRates.JPY ||
parseFloat(localHKD) !== extraRates.HKD
```

Add JSX in the Form Body (after the USD rate field, before Save Button):
```tsx
{/* Other currency rates */}
<div>
  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
    <DollarSign className="w-4 h-4 text-gray-400" />
    其他幣別匯率（→ TWD）
  </label>
  <div className="grid grid-cols-3 gap-3">
    <div>
      <label className="block text-xs text-gray-400 mb-1">EUR</label>
      <input
        type="number" min="1" step="0.01"
        value={localEUR}
        onChange={e => setLocalEUR(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
      />
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1">JPY</label>
      <input
        type="number" min="0.001" step="0.001"
        value={localJPY}
        onChange={e => setLocalJPY(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
      />
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1">HKD</label>
      <input
        type="number" min="1" step="0.01"
        value={localHKD}
        onChange={e => setLocalHKD(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
      />
    </div>
  </div>
  <p className="text-xs text-gray-400 mt-1.5">供手動資產項目換算時參考，不影響自動計算</p>
</div>
```

- [ ] **Step 5: Commit**
```bash
git add src/context/AppContext.tsx src/app/settings/page.tsx
git commit -m "feat: add EUR/JPY/HKD exchange rates to AppContext and Settings"
```

---

### Task 7: Report auto-schedule

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/EmailReportSender.tsx`

- [ ] **Step 1: Add reportSchedule and lastReportSent to AppContextType**

In `src/context/AppContext.tsx`, `AppContextType` interface, add after `setLastExportDate`:
```tsx
reportSchedule: 'none' | 'weekly' | 'monthly';
setReportSchedule: (s: 'none' | 'weekly' | 'monthly' | ((prev: 'none' | 'weekly' | 'monthly') => 'none' | 'weekly' | 'monthly')) => void;
lastReportSent: string;
setLastReportSent: (date: string | ((prev: string) => string)) => void;
```

- [ ] **Step 2: Add useStickyState declarations in AppProvider**

After `const [lastExportDate, setLastExportDate] = ...`, add:
```tsx
const [reportSchedule, setReportSchedule] = useStickyState<'none' | 'weekly' | 'monthly'>('none', 'app-report-schedule-v1');
const [lastReportSent, setLastReportSent] = useStickyState<string>('', 'app-last-report-sent-v1');
```

- [ ] **Step 3: Add to Provider value**

After `setLastExportDate,` in the Provider value, add:
```tsx
reportSchedule,
setReportSchedule,
lastReportSent,
setLastReportSent,
```

- [ ] **Step 4: Add schedule selector to Settings page**

In `src/app/settings/page.tsx`, add to `useAppContext()` destructuring:
```tsx
reportSchedule, setReportSchedule,
```

Add JSX in the Form Body (after the Other currency rates section, before Save Button):
```tsx
{/* Auto report schedule */}
<div>
  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
    <Mail className="w-4 h-4 text-gray-400" />
    資產報表自動寄送
  </label>
  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium w-fit">
    {(['none', 'weekly', 'monthly'] as const).map(opt => (
      <button
        key={opt}
        type="button"
        onClick={() => setReportSchedule(opt)}
        className={`px-4 py-2 transition-colors ${
          reportSchedule === opt
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {opt === 'none' ? '關閉' : opt === 'weekly' ? '每週一' : '每月1日'}
      </button>
    ))}
  </div>
  <p className="text-xs text-gray-400 mt-1.5">
    App 開啟時若符合排程且今日尚未寄送，將自動寄至個人信箱（需設定信箱）
  </p>
</div>
```

- [ ] **Step 5: Add auto-schedule effect in EmailReportSender**

In `src/components/EmailReportSender.tsx`, after the existing `useEffect` (the one that resets `result` when `isOpen` changes), add:
```tsx
useEffect(() => {
  if (ctx.reportSchedule === 'none' || !ctx.userEmail || !ctx.lastUpdated) return;
  const today = new Date().toISOString().split('T')[0];
  if (ctx.lastReportSent === today) return;

  const d = new Date();
  const shouldSend =
    ctx.reportSchedule === 'weekly' ? d.getDay() === 1 : d.getDate() === 1;
  if (!shouldSend) return;

  const reportData = buildReportData();
  fetch('/api/cron/send-asset-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientEmail: ctx.userEmail, reportData }),
  })
    .then(res => { if (res.ok) ctx.setLastReportSent(today); })
    .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ctx.lastUpdated]);
```

- [ ] **Step 6: Commit**
```bash
git add src/context/AppContext.tsx src/app/settings/page.tsx src/components/EmailReportSender.tsx
git commit -m "feat: add weekly/monthly report auto-schedule in Settings"
```

---

### Task 8: PWA — manifest, service worker, meta tags

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create manifest.json**

Create `public/manifest.json`:
```json
{
  "name": "AssetDash 資產管理",
  "short_name": "AssetDash",
  "description": "個人財務資產管理系統，追蹤資產、負債與現金流",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4f46e5",
  "lang": "zh-TW",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

> Note: Place 192×192 and 512×512 indigo background PNG icons at `public/icon-192.png` and `public/icon-512.png` for full install prompt support.

- [ ] **Step 2: Create service worker**

Create `public/sw.js`:
```js
const CACHE_NAME = 'assetdash-v1';
const PRECACHE = ['/', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

- [ ] **Step 3: Update layout.tsx**

Replace the entire `src/app/layout.tsx` with:
```tsx
import type { Metadata } from 'next';
import '../index.css';
import { ClientLayout } from '../components/ClientLayout';

export const metadata: Metadata = {
  title: 'AssetDash - 個人資產狀態',
  description: '追蹤與管理您的財務狀況',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AssetDash" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {})); }`,
          }}
        />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**
```bash
git add public/manifest.json public/sw.js src/app/layout.tsx
git commit -m "feat: add PWA support (manifest + service worker + Apple meta tags)"
```

---

## Self-Review

**Spec coverage:**
1. Fix hardcoded usdToTwd → Task 1 ✓
2. 淨值目標預估達成時間 → Task 2 ✓
3. 股票持倉比重 → Task 3 ✓
4. 質押到期提醒 → Task 4 ✓
5. 資產分配建議 → Task 5 ✓
6. 多幣別支援 → Task 6 ✓
7. 資產報表自動寄送 → Task 7 ✓
8. PWA → Task 8 ✓

**Already implemented (not rebuilt):**
- 現金流年度總覽: `annual/page.tsx` has full BarChart ✓
- 貸款還款時間軸: `InstallmentLoanCard` has progress bar ✓
- 股票損益分析: StockRow shows per-stock P&L ✓

**Placeholder scan:** No TBDs or TODOs. All steps include complete code.

**Type consistency:**
- `extraRates: { EUR: number; JPY: number; HKD: number }` — consistent in interface, declaration, and Settings
- `reportSchedule: 'none' | 'weekly' | 'monthly'` — consistent in interface, declaration, Settings JSX, and EmailReportSender effect
- `monthlyNetCashFlow: number` — consistent in HeroKPIProps and page.tsx call site
- `totalPortfolioTWD: number` — consistent in StockRow props and call site

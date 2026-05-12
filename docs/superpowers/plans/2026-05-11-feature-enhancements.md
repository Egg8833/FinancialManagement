# Feature Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作三項迫切功能：質押比告警（頁面橫幅 + 每日一次 Email）、淨值歷史趨勢圖（自動日快照 + Recharts 折線圖）、Settings 升級（USD 匯率欄位 + JSON 完整備份）。

**Architecture:** 以 AppContext 為核心擴充兩個新狀態（`usdToTwd`、`pledgeAlertLastSent`）及自動快照 useEffect；質押告警透過新 API route `/api/pledge-alert` 寄信；三個 UI 功能各自新增元件或修改現有頁面，均不影響其他功能。

**Tech Stack:** Next.js 15 App Router、React 19、TypeScript、Tailwind CSS 4、Recharts 3（已安裝）、Nodemailer（已安裝）、localStorage via `useStickyState` hook。

---

## File Map

| 動作 | 檔案 | 說明 |
|------|------|------|
| Modify | `src/context/AppContext.tsx` | 新增 `usdToTwd`、`pledgeAlertLastSent`、自動快照 useEffect；修掉兩處 hardcoded `const usdToTwd = 32` |
| Create | `src/app/api/pledge-alert/route.ts` | 質押告警專用 Email API |
| Create | `src/components/PledgeAlertBanner.tsx` | 告警橫幅 UI 元件 |
| Modify | `src/app/staking/page.tsx` | 從 context 取 `usdToTwd`；新增告警計算邏輯與橫幅渲染 |
| Create | `src/components/NetWorthChart.tsx` | 淨值折線圖元件 |
| Modify | `src/app/page.tsx` | Dashboard 加入 NetWorthChart |
| Modify | `src/app/settings/page.tsx` | 新增 USD 匯率欄位 + 資料備份區塊 |

---

## Task 1: 擴充 AppContext（usdToTwd + pledgeAlertLastSent + 自動快照）

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: 在 AppContextType interface 新增四個屬性**

  在 `src/context/AppContext.tsx` 第 233 行 `const AppContext = createContext...` 之前，找到 `interface AppContextType {`，在 `totalCollateralValueTWD: number;` 之後、`userName: string;` 之前新增：

  ```ts
  usdToTwd: number;
  setUsdToTwd: (v: number | ((prev: number) => number)) => void;
  pledgeAlertLastSent: Record<'warning' | 'danger', string>;
  setPledgeAlertLastSent: (v: Record<'warning' | 'danger', string> | ((prev: Record<'warning' | 'danger', string>) => Record<'warning' | 'danger', string>)) => void;
  ```

- [ ] **Step 2: 在 AppProvider 函式內宣告新 state（緊接在現有 state 宣告區塊末尾）**

  在 `const [userName, setUserName] = useStickyState...` 之後、`const refreshRef = ...` 之前新增：

  ```ts
  const [usdToTwd, setUsdToTwd] = useStickyState<number>(32, 'app-usd-twd-v1');
  const [pledgeAlertLastSent, setPledgeAlertLastSent] = useStickyState<Record<'warning' | 'danger', string>>(
    { warning: '', danger: '' },
    'app-pledge-alert-v1'
  );
  ```

- [ ] **Step 3: 修掉 AppContext 內兩處 hardcoded `const usdToTwd = 32`**

  **第一處**（`totalCollateralValueTWD` useMemo，約第 300 行）— 刪除 `const usdToTwd = 32;` 那一行，直接使用 state 變數 `usdToTwd`：

  ```ts
  const totalCollateralValueTWD = useMemo(() => {
    return stockItems.reduce((sum, item) => {
      if (!item.collateralShares) return sum;
      const quote = stockQuotes[item.symbol];
      if (!quote) return sum;
      const value = quote.price * item.collateralShares;
      return sum + (quote.currency === 'USD' ? value * usdToTwd : value);
    }, 0);
  }, [stockItems, stockQuotes, usdToTwd]);
  ```

  **第二處**（`totalStockValueTWD` useMemo，約第 312 行）— 同樣刪除 `const usdToTwd = 32;`：

  ```ts
  const totalStockValueTWD = useMemo(() => {
    let total = 0;
    for (const item of stockItems) {
      const quote = stockQuotes[item.symbol];
      if (quote) {
        const value = quote.price * item.shares;
        total += quote.currency === 'USD' ? value * usdToTwd : value;
      }
    }
    return total;
  }, [stockItems, stockQuotes, usdToTwd]);
  ```

- [ ] **Step 4: 新增自動日快照 useEffect（加在 `monthlyNetCashFlow` 計算之後）**

  ```ts
  useEffect(() => {
    if (stockItems.length > 0 && !lastUpdated) return;
    const today = new Date().toISOString().split('T')[0];
    setSnapshots(prev => {
      const last = prev[prev.length - 1];
      if (last?.date === today) return prev;
      if (totalAssets === 0 && netWorth === 0) return prev;
      return [
        ...prev.slice(-364),
        { id: `snap-${Date.now()}`, date: today, totalAssets, totalLiabilities, netWorth },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated, totalAssets, totalLiabilities, netWorth]);
  ```

- [ ] **Step 5: 將新狀態加入 Context Provider value 物件**

  在 `return (<AppContext.Provider value={{ ... }}>` 的物件中，在 `totalCollateralValueTWD,` 之後加入：

  ```ts
  usdToTwd,
  setUsdToTwd,
  pledgeAlertLastSent,
  setPledgeAlertLastSent,
  ```

- [ ] **Step 6: 啟動開發伺服器，確認頁面正常載入、無 TypeScript 錯誤**

  ```bash
  npm run dev
  ```

  預期：瀏覽器開啟 http://localhost:3000，Dashboard 正常顯示，console 無 error。

- [ ] **Step 7: Commit**

  ```bash
  git add src/context/AppContext.tsx
  git commit -m "feat: add usdToTwd, pledgeAlertLastSent state and daily auto-snapshot to AppContext"
  ```

---

## Task 2: 建立質押告警 Email API Route

**Files:**
- Create: `src/app/api/pledge-alert/route.ts`

- [ ] **Step 1: 建立目錄並新增 route.ts**

  完整建立 `src/app/api/pledge-alert/route.ts`：

  ```ts
  import { NextResponse } from 'next/server';
  import { sendEmail } from '../../../../lib/mail';

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

      const html = buildAlertHtml({ isDanger, platformName, ratio, pledgeData });
      await sendEmail({ to: recipientEmail, subject, html });

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `寄送失敗：${message}` }, { status: 500 });
    }
  }

  function buildAlertHtml(data: {
    isDanger: boolean;
    platformName: string;
    ratio: number;
    pledgeData: PledgeData[];
  }): string {
    const { isDanger, platformName, ratio, pledgeData } = data;
    const headerColor = isDanger ? '#dc2626' : '#d97706';
    const headerBg = isDanger ? '#fef2f2' : '#fffbeb';
    const borderColor = isDanger ? '#fecaca' : '#fde68a';
    const dateStr = new Date().toLocaleDateString('zh-TW', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });
    const ratioColor = (r: number) => r < 167 ? '#dc2626' : r < 200 ? '#d97706' : '#059669';

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
      ${pledgeData.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:13px;color:#374151;">${p.platform}</span>
          <span style="font-size:14px;font-weight:700;color:${ratioColor(p.ratio)};">${p.ratio > 0 ? p.ratio.toFixed(1) + '%' : '—'}</span>
        </div>
      `).join('')}
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

- [ ] **Step 2: 確認 API route 存在**

  ```bash
  ls src/app/api/pledge-alert/
  ```

  預期輸出：`route.ts`

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/pledge-alert/route.ts
  git commit -m "feat: add /api/pledge-alert email route for pledge ratio warnings"
  ```

---

## Task 3: 建立 PledgeAlertBanner 元件

**Files:**
- Create: `src/components/PledgeAlertBanner.tsx`

- [ ] **Step 1: 建立元件檔案**

  ```tsx
  "use client";

  import { AlertTriangle, AlertOctagon, X } from 'lucide-react';
  import { useState } from 'react';

  interface PledgeAlertBannerProps {
    level: 'warning' | 'danger';
    platformName: string;
    ratio: number;
  }

  export function PledgeAlertBanner({ level, platformName, ratio }: PledgeAlertBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    if (dismissed) return null;

    const isDanger = level === 'danger';
    const Icon = isDanger ? AlertOctagon : AlertTriangle;

    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${
        isDanger
          ? 'bg-red-50 border-red-300 text-red-800'
          : 'bg-yellow-50 border-yellow-300 text-yellow-800'
      }`}>
        <Icon className={`w-5 h-5 shrink-0 ${isDanger ? 'text-red-600' : 'text-yellow-600'}`} />
        <p className="flex-1 text-sm font-medium">
          {isDanger
            ? `⚠️ 緊急：${platformName} 質押維持率 ${ratio.toFixed(1)}% 低於 167%，請立即補充保證金`
            : `⚡ 注意：${platformName} 質押維持率 ${ratio.toFixed(1)}% 低於 200%，建議提高維持率`}
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="關閉提示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/PledgeAlertBanner.tsx
  git commit -m "feat: add PledgeAlertBanner component for pledge ratio alerts"
  ```

---

## Task 4: 串接告警邏輯到 Staking 頁面

**Files:**
- Modify: `src/app/staking/page.tsx`

- [ ] **Step 1: 修掉 staking 頁 hardcoded `const usdToTwd = 32`**

  在 `src/app/staking/page.tsx`，找到 `export default function BorrowingPage()` 函式內的 `useAppContext()` 解構（約第 424 行），新增 `usdToTwd, pledgeAlertLastSent, setPledgeAlertLastSent, userEmail`：

  ```tsx
  const {
    loans, setLoans, recordLoanPayment, undoLoanPayment,
    stakingItems, setStakingItems,
    borrowingLimits, setBorrowingLimits,
    stockItems, stockQuotes,
    usdToTwd,
    pledgeAlertLastSent, setPledgeAlertLastSent,
    userEmail,
  } = useAppContext();
  ```

  然後在 `collateralByPlatform` useMemo（約第 461 行）中，刪除 `const usdToTwd = 32;` 那一行（直接使用上方解構出來的 `usdToTwd`）：

  ```tsx
  const collateralByPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of stockItems) {
      if (!item.collateralShares) continue;
      const quote = stockQuotes[item.symbol];
      if (!quote) continue;
      const value = quote.price * item.collateralShares;
      const twdValue = quote.currency === 'USD' ? value * usdToTwd : value;
      const p = (item.platform || '未分類').trim();
      map[p] = (map[p] || 0) + twdValue;
    }
    return map;
  }, [stockItems, stockQuotes, usdToTwd]);
  ```

- [ ] **Step 2: 新增告警計算 useMemo（加在 `pledgePlatforms` 宣告之後）**

  在 `const pledgePlatforms = useMemo(...)` 之後加入：

  ```tsx
  const { minRatio, minPlatform, allPlatformRatios } = useMemo(() => {
    let min = Infinity;
    let minP = '';
    const allRatios: Array<{ platform: string; ratio: number; borrowValue: number; collateralValue: number }> = [];
    for (const platform of pledgePlatforms) {
      const borrow = (borrowByPlatform[platform] || []).reduce((s, i) => s + i.value, 0);
      const collateral = collateralByPlatform[platform] || 0;
      const ratio = borrow > 0 ? (collateral / borrow) * 100 : Infinity;
      allRatios.push({ platform, ratio: ratio === Infinity ? 0 : ratio, borrowValue: borrow, collateralValue: collateral });
      if (borrow > 0 && ratio < min) { min = ratio; minP = platform; }
    }
    return {
      minRatio: min === Infinity ? 0 : min,
      minPlatform: minP,
      allPlatformRatios: allRatios,
    };
  }, [pledgePlatforms, borrowByPlatform, collateralByPlatform]);

  const alertLevel: 'warning' | 'danger' | null =
    minRatio > 0 && minPlatform
      ? minRatio < 167 ? 'danger' : minRatio < 200 ? 'warning' : null
      : null;
  ```

- [ ] **Step 3: 新增 Email 寄送 useEffect（加在 `alertLevel` 宣告之後）**

  需要在檔案頂部 import 區加入 `useEffect`（若尚未 import）：

  ```tsx
  import { useState, useMemo, useEffect } from 'react';
  ```

  然後在 `alertLevel` 宣告之後加：

  ```tsx
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

- [ ] **Step 4: 在頁面 JSX 頂部渲染 Banner（加在 `<div className="mb-8">` 之前）**

  先在檔案頂部 import：

  ```tsx
  import { PledgeAlertBanner } from '../../components/PledgeAlertBanner';
  ```

  然後在 `return (` 之後、`<div className="mb-8">` 之前插入：

  ```tsx
  {alertLevel && (
    <PledgeAlertBanner
      level={alertLevel}
      platformName={minPlatform}
      ratio={minRatio}
    />
  )}
  ```

- [ ] **Step 5: 手動測試（開發伺服器）**

  1. 開啟 http://localhost:3000/staking
  2. 如有質押平台且維持率 < 200%，應看到黃色/紅色橫幅
  3. 確認 console 無 TypeScript/runtime error

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/staking/page.tsx
  git commit -m "feat: add pledge ratio alert banner and daily email trigger to staking page"
  ```

---

## Task 5: 建立 NetWorthChart 元件

**Files:**
- Create: `src/components/NetWorthChart.tsx`

- [ ] **Step 1: 建立元件**

  ```tsx
  "use client";

  import { useState, useMemo } from 'react';
  import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  } from 'recharts';
  import type { AssetSnapshot } from '../context/AppContext';

  type Range = '1M' | '3M' | '6M' | '1Y';

  const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

  interface NetWorthChartProps {
    snapshots: AssetSnapshot[];
    showValues: boolean;
    formatCurrency: (n: number) => string;
  }

  export function NetWorthChart({ snapshots, showValues, formatCurrency }: NetWorthChartProps) {
    const [range, setRange] = useState<Range>('3M');

    const data = useMemo(() => {
      const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 86400_000);
      return snapshots
        .filter(s => new Date(s.date) >= cutoff)
        .map(s => ({ ...s, label: s.date.slice(5) }));
    }, [snapshots, range]);

    const ranges: Range[] = ['1M', '3M', '6M', '1Y'];

    if (snapshots.length < 2) {
      return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h3 className="text-base font-bold text-gray-900 mb-1">淨值歷史趨勢</h3>
          <p className="text-sm text-gray-400 mt-1">
            資料累積中，每天自動記錄一筆快照。至少需要 2 筆才能顯示趨勢圖。
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">淨值歷史趨勢</h3>
          <div className="flex gap-1">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  range === r ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {showValues ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${Math.round(v / 10000)}萬`}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), '淨值']}
                labelStyle={{ color: '#6b7280', fontSize: 12 }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#4f46e5' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-xl">
            數值已隱藏
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/NetWorthChart.tsx
  git commit -m "feat: add NetWorthChart component with 1M/3M/6M/1Y range selector"
  ```

---

## Task 6: 將 NetWorthChart 加入 Dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 新增 import 與 context 解構**

  在 `src/app/page.tsx` 頂部 import 區加入：

  ```tsx
  import { NetWorthChart } from '../components/NetWorthChart';
  ```

  在 `useAppContext()` 解構（約第 18 行）中新增 `snapshots`：

  ```tsx
  const {
    showValues,
    assets,
    setAssets,
    combinedAssets,
    setLiabilities,
    combinedLiabilities,
    totalMonthlyIncome,
    totalMonthlyExpense,
    monthlyNetCashFlow,
    totalAssets,
    totalLiabilities,
    netWorth,
    netWorthGoal,
    setNetWorthGoal,
    snapshots,
  } = useAppContext();
  ```

- [ ] **Step 2: 在 HeroKPI 之後插入 NetWorthChart**

  找到：
  ```tsx
  <HeroKPI
    netWorth={netWorth}
    ...
  />
  ```

  在其正後方（`<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">` 之前）插入：

  ```tsx
  <NetWorthChart
    snapshots={snapshots}
    showValues={showValues}
    formatCurrency={formatCurrency}
  />
  ```

- [ ] **Step 3: 手動驗證**

  開啟 http://localhost:3000，應在 HeroKPI 下方看到「淨值歷史趨勢」區塊。
  - 若 snapshots < 2：顯示提示文字
  - 若 snapshots ≥ 2：顯示折線圖

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/page.tsx
  git commit -m "feat: add NetWorthChart to dashboard below HeroKPI"
  ```

---

## Task 7: 升級 Settings 頁（USD 匯率 + JSON 備份）

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: 擴充 import 與 context 解構**

  在 `src/app/settings/page.tsx` 頂部，更新 import：

  ```tsx
  import { User, Mail, Save, CheckCircle, DollarSign, Download, Upload, Database } from 'lucide-react';
  ```

  將 `useAppContext()` 解構擴充（目前只有 `userName`, `setUserName`, `userEmail`, `setUserEmail`）：

  ```tsx
  const {
    userName, setUserName,
    userEmail, setUserEmail,
    usdToTwd, setUsdToTwd,
    assets, liabilities, loans, stockItems, stakingItems,
    incomeItems, expenseItems, annualEntries, snapshots,
    netWorthGoal, borrowingLimits,
    setAssets, setLiabilities, setLoans, setStockItems, setStakingItems,
    setIncomeItems, setExpenseItems, setAnnualEntries, setSnapshots,
    setNetWorthGoal, setBorrowingLimits,
  } = useAppContext();
  ```

- [ ] **Step 2: 新增 USD 匯率本地 state**

  在現有 `const [localName, setLocalName] = useState(userName);` 之後加入：

  ```tsx
  const [localUsdRate, setLocalUsdRate] = useState(usdToTwd.toString());
  ```

- [ ] **Step 3: 新增 JSON 匯出函式**

  在 `handleSave` 之後加入：

  ```tsx
  const handleExport = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      assets,
      liabilities,
      loans,
      stockItems,
      stakingItems,
      incomeItems,
      expenseItems,
      annualEntries,
      snapshots,
      netWorthGoal,
      usdToTwd,
      borrowingLimits,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assetdash-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('備份檔案已下載');
  };
  ```

- [ ] **Step 4: 新增 JSON 匯入函式**

  在 `handleExport` 之後加入：

  ```tsx
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version) throw new Error('格式不正確，缺少 version 欄位');
        const ok = window.confirm(
          `確定要匯入備份嗎？\n匯出時間：${data.exportedAt ?? '未知'}\n\n⚠️ 此操作將覆蓋所有現有資料，無法復原。`
        );
        if (!ok) return;
        if (data.assets) setAssets(data.assets);
        if (data.liabilities) setLiabilities(data.liabilities);
        if (data.loans) setLoans(data.loans);
        if (data.stockItems) setStockItems(data.stockItems);
        if (data.stakingItems) setStakingItems(data.stakingItems);
        if (data.incomeItems) setIncomeItems(data.incomeItems);
        if (data.expenseItems) setExpenseItems(data.expenseItems);
        if (data.annualEntries) setAnnualEntries(data.annualEntries);
        if (data.snapshots) setSnapshots(data.snapshots);
        if (typeof data.netWorthGoal === 'number') setNetWorthGoal(data.netWorthGoal);
        if (typeof data.usdToTwd === 'number') { setUsdToTwd(data.usdToTwd); setLocalUsdRate(data.usdToTwd.toString()); }
        if (data.borrowingLimits) setBorrowingLimits(data.borrowingLimits);
        toast('資料已成功匯入！');
      } catch (err) {
        toast(`匯入失敗：${err instanceof Error ? err.message : '檔案格式錯誤'}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  ```

- [ ] **Step 5: 修改 handleSave 也儲存 USD 匯率**

  將現有 `handleSave` 修改為：

  ```tsx
  const handleSave = () => {
    setUserName(localName.trim());
    setUserEmail(localEmail.trim());
    const rate = parseFloat(localUsdRate);
    if (!isNaN(rate) && rate > 0) setUsdToTwd(rate);
    setSaved(true);
    toast('個人資訊已儲存');
  };
  ```

  更新 `hasChanges` 也包含匯率變化：

  ```tsx
  const hasChanges =
    localName !== userName ||
    localEmail !== userEmail ||
    parseFloat(localUsdRate) !== usdToTwd;
  ```

- [ ] **Step 6: 在 JSX 中新增 USD 匯率欄位（加在 Email 欄位之後，儲存按鈕之前）**

  在現有 Email 欄位 `</div>` 之後、Save Button `<div className="flex items-center justify-between pt-2">` 之前插入：

  ```tsx
  {/* USD Rate Field */}
  <div>
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
      <DollarSign className="w-4 h-4 text-gray-400" />
      美元匯率（USD/TWD）
    </label>
    <input
      type="number"
      min="1"
      step="0.1"
      value={localUsdRate}
      onChange={e => setLocalUsdRate(e.target.value)}
      placeholder="32"
      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
    />
    <p className="text-xs text-gray-400 mt-1.5">用於計算美股持倉的台幣市值（預設 32）</p>
  </div>
  ```

- [ ] **Step 7: 在隱私說明卡片之後新增「資料備份」區塊**

  在 `{/* Info Card */}` 區塊之後加入：

  ```tsx
  {/* Backup Card */}
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
      <Database className="w-5 h-5 text-gray-400" />
      <h2 className="font-bold text-gray-900">資料備份</h2>
    </div>
    <div className="p-6 space-y-4">
      <p className="text-sm text-gray-500">
        將所有資料匯出為 JSON 備份檔，或從備份檔還原。資料只存在您的設備，請定期備份以防遺失。
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Download className="w-4 h-4" />
          匯出備份 JSON
        </button>
        <label className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          匯入備份 JSON
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </label>
      </div>
      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
        ⚠️ 匯入備份將覆蓋所有現有資料，操作前請先匯出現有備份。
      </p>
    </div>
  </div>
  ```

- [ ] **Step 8: 手動驗證**

  1. 開啟 http://localhost:3000/settings
  2. 確認「美元匯率」欄位顯示，修改後按儲存，前往股票頁確認市值計算有變化
  3. 點擊「匯出備份 JSON」，確認瀏覽器下載 JSON 檔案
  4. 確認 JSON 內容包含所有資產資料
  5. （選擇性）清除一個資產，再匯入剛才的備份，確認資料還原

- [ ] **Step 9: Commit**

  ```bash
  git add src/app/settings/page.tsx
  git commit -m "feat: add USD rate setting and JSON backup/restore to settings page"
  ```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 質押比 < 167% → 紅色 Banner + 每日 Email（Task 3、4）
- ✅ 質押比 < 200% → 黃色 Banner + 每日 Email（Task 3、4）
- ✅ Email 每天最多寄一次（`pledgeAlertLastSent` check in useEffect）
- ✅ 淨值歷史趨勢圖，自動日快照（Task 1、5、6）
- ✅ USD 匯率欄位，取代 hardcoded 32（Task 1、4、7）
- ✅ JSON 匯出/匯入（Task 7）

**Type consistency:**
- `AssetSnapshot` type 已在 AppContext 定義（含 `id`、`date`、`totalAssets`、`totalLiabilities`、`netWorth`）— NetWorthChart 使用 `import type { AssetSnapshot }` ✅
- `usdToTwd` 在 AppContextType 為 `number`，Settings 本地 state 用 `toString()` 轉換再 `parseFloat()` 還原 ✅
- `pledgeAlertLastSent` 型別 `Record<'warning' | 'danger', string>` 與 API route 的 `alertLevel: 'warning' | 'danger'` 一致 ✅
- PledgeAlertBanner 的 `level` prop 型別與 alertLevel 型別相同 ✅

**No placeholders:** 所有步驟均含完整程式碼，無 TBD/TODO。

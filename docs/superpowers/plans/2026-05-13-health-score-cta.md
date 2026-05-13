# 健康分數 CTA 深度連結 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「升級行動計畫」每個 actionItem 加上導航按鈕，點擊直接前往對應功能頁。

**Architecture:** 單一檔案修改。在 `ActionItem` type 加 `href`/`ctaLabel` 兩個欄位，建立 items 時填入，render 時加 Next.js `<Link>` 按鈕。無新增檔案，無新增 API。

**Tech Stack:** Next.js 14 App Router (`next/link`), TypeScript, Tailwind CSS, lucide-react (`ArrowRight` 已 import)

---

## File Structure

| 檔案 | 改動 |
|------|------|
| `src/app/health/page.tsx` | 新增 `Link` import；`ActionItem` type 加欄位；4 個 item push 加 href/ctaLabel；render 加按鈕 |

---

### Task 1: health/page.tsx — 全部改動

**Files:**
- Modify: `src/app/health/page.tsx`

此 task 只改一個檔案，無純函數可 unit test，以 `tsc --noEmit` 驗證型別正確性。

- [ ] **Step 1: 新增 `Link` import**

找到 `src/app/health/page.tsx` 第 1–11 行的 import 區塊：

```ts
'use client';

import { useMemo } from 'react';
import { Heart, PiggyBank, ShieldCheck, CreditCard, TrendingUp, Wallet, BarChart2, Target, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculateHealthScore, type HealthScoreResult, type MetricResult } from '../../lib/healthScore';
import type { LucideIcon } from 'lucide-react';
```

在 `'use client';` 之後插入一行：

```ts
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Heart, PiggyBank, ShieldCheck, CreditCard, TrendingUp, Wallet, BarChart2, Target, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculateHealthScore, type HealthScoreResult, type MetricResult } from '../../lib/healthScore';
import type { LucideIcon } from 'lucide-react';
```

- [ ] **Step 2: 擴充 `ActionItem` type**

找到 `ActionItem` type（約第 105–116 行）：

```ts
type ActionItem = {
  key: string;
  Icon: LucideIcon;
  label: string;
  current: string;
  target: string;
  action: string;
  amount: number;
  isMonthly: boolean;
  scoreGain: number;
  priority: '高' | '中' | '低';
};
```

改為（末尾加兩個欄位）：

```ts
type ActionItem = {
  key: string;
  Icon: LucideIcon;
  label: string;
  current: string;
  target: string;
  action: string;
  amount: number;
  isMonthly: boolean;
  scoreGain: number;
  priority: '高' | '中' | '低';
  href: string;
  ctaLabel: string;
};
```

- [ ] **Step 3: liquidity item 加 href / ctaLabel**

在 `useMemo` 中找到 `liquidity` 的 `items.push(...)` 區塊（約第 142–151 行）：

```ts
      items.push({
        key: 'liquidity', Icon: ShieldCheck, label: '緊急備用金',
        current: `${liquidMonths.toFixed(1)} 個月`,
        target: '6 個月',
        action: '一次性存入流動帳戶',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: liquidMonths < 3 ? '高' : '中',
      });
```

改為（加最後兩個欄位）：

```ts
      items.push({
        key: 'liquidity', Icon: ShieldCheck, label: '緊急備用金',
        current: `${liquidMonths.toFixed(1)} 個月`,
        target: '6 個月',
        action: '一次性存入流動帳戶',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: liquidMonths < 3 ? '高' : '中',
        href: '/', ctaLabel: '管理資產',
      });
```

- [ ] **Step 4: debt item 加 href / ctaLabel**

找到 `debt` 的 `items.push(...)` 區塊（約第 159–168 行）：

```ts
      items.push({
        key: 'debt', Icon: CreditCard, label: '負債比率',
        current: `${(debtRatio * 100).toFixed(1)}%`,
        target: '≤ 20%',
        action: '還清部分債務',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: debtRatio > 0.5 ? '高' : '中',
      });
```

改為：

```ts
      items.push({
        key: 'debt', Icon: CreditCard, label: '負債比率',
        current: `${(debtRatio * 100).toFixed(1)}%`,
        target: '≤ 20%',
        action: '還清部分債務',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: debtRatio > 0.5 ? '高' : '中',
        href: '/staking', ctaLabel: '管理負債',
      });
```

- [ ] **Step 5: investment item 加 href / ctaLabel**

找到 `investment` 的 `items.push(...)` 區塊（約第 176–185 行）：

```ts
      items.push({
        key: 'investment', Icon: TrendingUp, label: '投資比率',
        current: `${(investRatio * 100).toFixed(1)}%`,
        target: '≥ 40%',
        action: '將閒置現金轉入投資',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: investRatio < 0.15 ? '中' : '低',
      });
```

改為：

```ts
      items.push({
        key: 'investment', Icon: TrendingUp, label: '投資比率',
        current: `${(investRatio * 100).toFixed(1)}%`,
        target: '≥ 40%',
        action: '將閒置現金轉入投資',
        amount: needed, isMonthly: false,
        scoreGain,
        priority: investRatio < 0.15 ? '中' : '低',
        href: '/stocks', ctaLabel: '管理投資',
      });
```

- [ ] **Step 6: savings item 加 href / ctaLabel**

找到 `savings` 的 `items.push(...)` 區塊（約第 193–202 行）：

```ts
      items.push({
        key: 'savings', Icon: PiggyBank, label: '儲蓄率',
        current: `${(savingsRate * 100).toFixed(1)}%`,
        target: '≥ 30%',
        action: '每月增加儲蓄 / 減少支出',
        amount: needed, isMonthly: true,
        scoreGain,
        priority: savingsRate < 0 ? '高' : monthlyNetCashFlow < 0.1 * totalMonthlyIncome ? '中' : '低',
      });
```

改為：

```ts
      items.push({
        key: 'savings', Icon: PiggyBank, label: '儲蓄率',
        current: `${(savingsRate * 100).toFixed(1)}%`,
        target: '≥ 30%',
        action: '每月增加儲蓄 / 減少支出',
        amount: needed, isMonthly: true,
        scoreGain,
        priority: savingsRate < 0 ? '高' : monthlyNetCashFlow < 0.1 * totalMonthlyIncome ? '中' : '低',
        href: '/cashflow', ctaLabel: '管理收支',
      });
```

- [ ] **Step 7: 在 render 加 CTA 按鈕**

找到「升級行動計畫」render 中，每個 actionItem 的右側容器（約第 323–335 行）：

```tsx
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{item.action}</p>
                    <p className="text-base font-black text-gray-900">
                      {item.isMonthly ? '每月 ' : ''}
                      NT${Math.round(item.amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">總分提升</p>
                    <p className="text-base font-black text-emerald-600">+{item.scoreGain} 分</p>
                  </div>
                </div>
```

改為（在 `scoreGain` div 之後加 Link 按鈕）：

```tsx
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{item.action}</p>
                    <p className="text-base font-black text-gray-900">
                      {item.isMonthly ? '每月 ' : ''}
                      NT${Math.round(item.amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">總分提升</p>
                    <p className="text-base font-black text-emerald-600">+{item.scoreGain} 分</p>
                  </div>
                  <Link
                    href={item.href}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {item.ctaLabel} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
```

- [ ] **Step 8: TypeScript 型別檢查**

```
npx tsc --noEmit
```

預期：0 errors（`href`/`ctaLabel` 必填，缺漏的 item 在 compile 時會報 Property '...' is missing）

- [ ] **Step 9: Commit**

```bash
git add src/app/health/page.tsx
git commit -m "feat(health): add CTA deep links to action plan items"
```

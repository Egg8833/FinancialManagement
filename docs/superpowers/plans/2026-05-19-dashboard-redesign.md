# Dashboard Command Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Dashboard 新增三欄摘要（健康分數、本月現金流、FIRE 進度），強化 Alert CTA 可點擊性，移除 NetWorthMilestones，整合快照管理功能。

**Architecture:** 新增 `DashboardSummaryRow` component 封裝三個摘要卡，計算邏輯放在 component 內部（不加新 AppContext selector，直接計算）。其餘修改為現有組件的 props 調整。

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Lucide React, AppContext

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Create | `src/components/DashboardSummaryRow.tsx` | 三欄摘要卡 |
| Modify | `src/app/page.tsx` | 引入 SummaryRow，移除 Milestones，整合快照 |
| Modify | `src/app/page.tsx` | Alert 加 CTA 按鈕 |

---

### Task 1：確認 AppContext 現有資料結構

在寫 code 前，先確認計算所需的欄位確實存在。

- [ ] **Step 1: 確認 FIRE target amount 欄位名稱**

```bash
grep -n "targetAmount\|fireTarget\|retirementGoal\|targetWealth\|fireSettings" src/context/AppContext.tsx | head -20
```

記錄確切欄位名稱（用於 FIRE 進度計算）。

- [ ] **Step 2: 確認 cashFlowItems 結構**

```bash
grep -n "CashFlowItem\|cashFlowItem" src/context/AppContext.tsx | head -15
```

確認 `type`（income/expense）、`amount`、`category` 等欄位存在。

- [ ] **Step 3: 確認 healthScore 和 assetSnapshots 結構**

```bash
grep -n "healthScore\|AssetSnapshot\|assetSnapshot" src/context/AppContext.tsx | head -15
```

確認 `healthScore` 是 AppContext top-level state 還是在 `assetSnapshots` 內的欄位。

- [ ] **Step 4: 確認 netWorth 計算方式**

```bash
grep -n "netWorth\|totalAssets\|totalLiabilities" src/app/page.tsx | head -10
```

確認 netWorth 的計算 or selector 已存在於 Dashboard。

---

### Task 2：建立 DashboardSummaryRow Component

**Files:**
- Create: `src/components/DashboardSummaryRow.tsx`

- [ ] **Step 1: 建立 component 骨架**

```tsx
'use client'

import Link from 'next/link'
import { Heart, Wallet, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'

export default function DashboardSummaryRow() {
  const {
    cashFlowItems,
    assetSnapshots,
    healthScore,
    netWorth,
    // 以下名稱依 Step 1 確認的實際名稱調整
    fireSettings,  // 或 fireTarget / retirementSettings
  } = useAppContext()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      {/* 健康分數卡 */}
      {/* 本月現金流卡 */}
      {/* FIRE 進度卡 */}
    </div>
  )
}
```

- [ ] **Step 2: 實作健康分數卡**

在 component 中加入計算和渲染：

```tsx
// 計算健康分數差異
const snapshots = assetSnapshots.filter((s: any) => s.healthScore !== undefined)
const lastTwo = snapshots.slice(-2)
const scoreDiff = lastTwo.length >= 2
  ? lastTwo[lastTwo.length - 1].healthScore - lastTwo[lastTwo.length - 2].healthScore
  : 0

const healthGrade =
  healthScore >= 80 ? '優秀' :
  healthScore >= 60 ? '良好' :
  healthScore >= 40 ? '普通' : '危險'

const healthColor =
  healthScore >= 80 ? 'text-green-600 bg-green-50' :
  healthScore >= 60 ? 'text-blue-600 bg-blue-50' :
  healthScore >= 40 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'

// 健康分數卡 JSX
<Link href="/health" className="group">
  <div className={`rounded-xl p-4 ${healthColor} hover:opacity-90 transition-opacity cursor-pointer`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Heart className="w-4 h-4" />
        <span className="text-sm font-medium">健康分數</span>
      </div>
      <span className="text-xs opacity-70">查看詳情 →</span>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-3xl font-bold">{healthScore}</span>
      <span className="text-sm font-medium mb-1">{healthGrade}</span>
    </div>
    {scoreDiff !== 0 && (
      <div className="flex items-center gap-1 mt-1 text-sm">
        {scoreDiff > 0
          ? <TrendingUp className="w-3 h-3" />
          : <TrendingDown className="w-3 h-3" />}
        <span>{scoreDiff > 0 ? '+' : ''}{scoreDiff} 較上次</span>
      </div>
    )}
  </div>
</Link>
```

- [ ] **Step 3: 實作本月現金流卡**

```tsx
// 計算本月現金流（固定項目）
const monthlyIncome = cashFlowItems
  .filter((i: any) => i.type === 'income')
  .reduce((sum: number, i: any) => sum + (i.amount || 0), 0)

const monthlyExpense = cashFlowItems
  .filter((i: any) => i.type === 'expense')
  .reduce((sum: number, i: any) => sum + (i.amount || 0), 0)

const monthlyNet = monthlyIncome - monthlyExpense
const savingsRate = monthlyIncome > 0 ? Math.round((monthlyNet / monthlyIncome) * 100) : 0

// 本月現金流卡 JSX
<Link href="/cashflow" className="group">
  <div className="rounded-xl p-4 bg-blue-50 text-blue-700 hover:opacity-90 transition-opacity cursor-pointer">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4" />
        <span className="text-sm font-medium">本月現金流</span>
      </div>
      <span className="text-xs opacity-70">查看明細 →</span>
    </div>
    <div className="flex items-end gap-1">
      <span className={`text-2xl font-bold ${monthlyNet >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
        {monthlyNet >= 0 ? '+' : ''}NT${monthlyNet.toLocaleString()}
      </span>
    </div>
    <div className="mt-1 text-sm opacity-80">
      收 {monthlyIncome.toLocaleString()} / 支 {monthlyExpense.toLocaleString()}
    </div>
    <div className="mt-1 text-sm">
      儲蓄率 <span className={`font-medium ${savingsRate >= 30 ? 'text-green-700' : savingsRate >= 15 ? 'text-yellow-700' : 'text-red-700'}`}>{savingsRate}%</span>
    </div>
  </div>
</Link>
```

- [ ] **Step 4: 實作 FIRE 進度卡**

以下使用 `fireSettings.targetAmount` — 請依 Task 1 Step 1 確認的實際欄位名稱調整：

```tsx
// FIRE 進度計算
const fireTargetAmount = fireSettings?.targetAmount || fireSettings?.retirementWealth || 0
const fireProgress = fireTargetAmount > 0
  ? Math.min(100, Math.round((netWorth / fireTargetAmount) * 100))
  : 0
const fireGap = Math.max(0, fireTargetAmount - netWorth)

// FIRE 進度卡 JSX
<Link href="/fire" className="group">
  <div className="rounded-xl p-4 bg-orange-50 text-orange-700 hover:opacity-90 transition-opacity cursor-pointer">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4" />
        <span className="text-sm font-medium">FIRE 進度</span>
      </div>
      <span className="text-xs opacity-70">查看計畫 →</span>
    </div>
    <div className="flex items-end gap-1 mb-2">
      <span className="text-3xl font-bold">{fireProgress}%</span>
    </div>
    {/* Progress bar */}
    <div className="w-full bg-orange-200 rounded-full h-2 mb-1">
      <div
        className="bg-orange-500 h-2 rounded-full transition-all"
        style={{ width: `${fireProgress}%` }}
      />
    </div>
    {fireGap > 0 ? (
      <p className="text-sm opacity-80">距目標還差 NT${fireGap.toLocaleString()}</p>
    ) : (
      <p className="text-sm font-medium text-green-700">已達 FIRE 目標！</p>
    )}
  </div>
</Link>
```

- [ ] **Step 5: 處理 showValues 遮罩（金額隱藏功能）**

若 Dashboard 有 `showValues` toggle，確認 SummaryRow 也使用：

```tsx
// 在 useAppContext 解構 showValues
const { ..., showValues } = useAppContext()

// 金額顯示時套用
<span>{showValues ? `NT$${monthlyNet.toLocaleString()}` : '●●●●'}</span>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardSummaryRow.tsx
git commit -m "feat(dashboard): add summary row with health score, cashflow, FIRE progress cards"
```

---

### Task 3：整合 SummaryRow 進 Dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 在 Dashboard 移除 NetWorthMilestones**

在 `src/app/page.tsx` 找到並刪除：

```tsx
// 刪除 import
import NetWorthMilestones from '@/components/NetWorthMilestones'

// 刪除 JSX 使用
<NetWorthMilestones ... />
```

- [ ] **Step 2: 新增 DashboardSummaryRow**

在 HeroKPI 下方（淨資產大卡之後），新增：

```tsx
import DashboardSummaryRow from '@/components/DashboardSummaryRow'

// 在 return JSX 中，HeroKPI 之後
<HeroKPI ... />

{/* 摘要指標列 */}
<DashboardSummaryRow />

{/* 原有 alerts... */}
```

- [ ] **Step 3: 手動確認 Dashboard 版面**

```
1. 開啟 /
2. 確認 SummaryRow 三個卡片正確顯示
3. 確認健康分數、現金流數字與 /health、/cashflow 頁一致
4. FIRE 進度百分比與 /fire 頁一致
5. 點擊各卡片，確認跳轉正確
6. NetWorthMilestones 不再出現
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): integrate summary row, remove NetWorthMilestones"
```

---

### Task 4：強化 Alert CTA 按鈕

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 找到現有 Alert 實作**

```bash
grep -n "alert\|Alert\|runway\|borrowing" src/app/page.tsx | head -20
```

找到 alert 渲染邏輯（通常是 map 一個 alerts array 或 conditional 區塊）。

- [ ] **Step 2: 確認 Alert 類型**

現有 alert 類型：
- 現金流為負（月支出 > 月收入）
- 低現金跑道（流動資產 / 月支出）
- 高借貸成本

- [ ] **Step 3: 每個 Alert 加 CTA 按鈕**

找到 alert 的 render JSX，在每個 alert 內加 CTA：

```tsx
{alerts.map(alert => (
  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-yellow-800">{alert.message}</p>
    </div>
    {/* 新增 CTA 按鈕 */}
    <Link
      href={alert.href}
      className="ml-3 flex-shrink-0 text-xs font-medium text-yellow-700 hover:text-yellow-900 underline whitespace-nowrap"
    >
      {alert.ctaLabel}
    </Link>
  </div>
))}
```

若 alerts 不是 array 而是 conditional render，為每個 alert 手動加 CTA：

```tsx
{/* 現金流警示 */}
{isNegativeCashflow && (
  <div className="flex items-center justify-between p-3 ...">
    <p className="text-sm">本月支出超過收入</p>
    <Link href="/cashflow" className="text-xs font-medium underline ml-3 flex-shrink-0">
      調整預算
    </Link>
  </div>
)}

{/* 低現金跑道 */}
{isLowRunway && (
  <div className="flex items-center justify-between p-3 ...">
    <p className="text-sm">現金跑道低於 3 個月</p>
    <Link href="/cashflow" className="text-xs font-medium underline ml-3 flex-shrink-0">
      查看現金流
    </Link>
  </div>
)}
```

- [ ] **Step 4: 確認 Link import**

```tsx
import Link from 'next/link'
```

確認已 import。

- [ ] **Step 5: 手動測試 Alert CTA**

```
製造警示條件（如暫時輸入支出 > 收入），確認：
1. Alert 顯示 CTA 按鈕
2. 點擊按鈕跳轉至正確頁面
3. 無其他 layout 破損
```

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): add actionable CTA buttons to all alerts"
```

---

### Task 5：最終驗證

- [ ] **Step 1: TypeScript 檢查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 無 error。

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | grep -E "error|✓" | head -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: 手動驗收 checklist**

```
□ Dashboard 有三個摘要卡（健康/現金流/FIRE）
□ 各卡數字正確，與對應頁面一致
□ 點擊各卡跳轉至正確頁面
□ NetWorthMilestones 不再顯示
□ 每個 Alert 有 CTA 按鈕
□ 手機版 SummaryRow 單欄顯示
□ 無 console error
```

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "feat(dashboard): complete command center redesign"
```

# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Dashboard、Cashflow、Health 三頁在 375px 手機螢幕可正常使用，並新增手機底部 Tab Bar 導航。

**Architecture:** 純 Tailwind responsive prefix 修改（`sm:`, `md:`, `lg:`），不引入新 UI 庫。底部 Tab Bar 作為獨立 component，在 `ClientLayout` 中條件渲染（手機顯示，桌機隱藏）。

**Tech Stack:** Next.js 15, Tailwind CSS 4, Lucide React, TypeScript

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/Navbar.tsx` | 手機隱藏，桌機顯示 |
| Create | `src/components/BottomTabBar.tsx` | 手機底部 Tab Bar |
| Modify | `src/components/ClientLayout.tsx` | 引入 BottomTabBar |
| Modify | `src/components/HeroKPI.tsx` | 手機 2 欄佈局 |
| Modify | `src/app/page.tsx` | Asset cards 手機單欄、圖表高度調整 |
| Modify | `src/app/cashflow/page.tsx` | 手機單欄、篩選 bar 折疊 |
| Modify | `src/app/health/page.tsx` | gauge 縮小、metric cards 2 欄 |

---

### Task 1：建立手機底部 Tab Bar

**Files:**
- Create: `src/components/BottomTabBar.tsx`
- Modify: `src/components/ClientLayout.tsx`

- [ ] **Step 1: 確認 ClientLayout 結構**

```bash
cat src/components/ClientLayout.tsx
```

找到：Navbar 的引用位置、main content wrapper、現有 padding 設定。

- [ ] **Step 2: 建立 BottomTabBar component**

建立 `src/components/BottomTabBar.tsx`：

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  Flame,
  TrendingUp,
  Heart,
} from 'lucide-react'

const tabs = [
  { href: '/', icon: LayoutDashboard, label: '總覽' },
  { href: '/cashflow', icon: Wallet, label: '現金流' },
  { href: '/fire', icon: Flame, label: 'FIRE' },
  { href: '/stocks', icon: TrendingUp, label: '股票' },
  { href: '/health', icon: Heart, label: '健康' },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex md:hidden">
      {tabs.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-xs">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: 在 ClientLayout 引入 BottomTabBar**

在 `src/components/ClientLayout.tsx` 找到 main content wrapper，加入：

```tsx
import BottomTabBar from './BottomTabBar'

// 在 return JSX 中，main 區塊加 bottom padding（避免內容被 tab bar 遮蓋）
<main className="... pb-16 md:pb-0">
  {children}
</main>

{/* 底部 Tab Bar（只在手機顯示） */}
<BottomTabBar />
```

- [ ] **Step 4: 頂部 Navbar 手機隱藏**

在 `src/components/Navbar.tsx` 找到最外層 wrapper，加入 `hidden md:block` 或 `hidden md:flex`：

```tsx
<nav className="hidden md:flex ...">
  {/* 現有內容 */}
</nav>
```

- [ ] **Step 5: 手動測試**

```
在 Chrome DevTools 切換至 iPhone 12（390px）：
1. 確認頂部 Navbar 隱藏
2. 確認底部 Tab Bar 出現，5 個圖示
3. 點擊各 Tab，確認路由正確跳轉
4. 確認 active 狀態高亮（藍色）
5. 確認頁面內容不被底部 Tab Bar 遮蓋

在桌機（>= 768px）：
1. 確認頂部 Navbar 正常顯示
2. 確認底部 Tab Bar 不出現
```

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomTabBar.tsx src/components/ClientLayout.tsx src/components/Navbar.tsx
git commit -m "feat(mobile): add bottom tab bar for mobile navigation"
```

---

### Task 2：Dashboard 手機響應式

**Files:**
- Modify: `src/components/HeroKPI.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 確認 HeroKPI 現有 grid 設定**

```bash
grep -n "grid\|cols\|flex" src/components/HeroKPI.tsx | head -15
```

- [ ] **Step 2: 修改 HeroKPI 為手機 2 欄**

在 `HeroKPI.tsx` 找到外層 grid wrapper，修改為：

```tsx
{/* 修改前類似 grid-cols-3 */}
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
  {/* 淨資產卡片加 col-span-2 md:col-span-1 讓手機全寬 */}
  <div className="col-span-2 md:col-span-1 ...">
    {/* 淨資產 */}
  </div>
  {/* 其他卡片正常 */}
</div>
```

注意：確認哪張卡片是「主要 KPI（淨資產）」，讓它在手機全寬。

- [ ] **Step 3: Asset Category Cards 手機單欄**

在 `src/app/page.tsx` 找到 asset category 的 grid wrapper，修改：

```tsx
{/* 修改前類似 grid-cols-2 */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
  {/* asset cards */}
</div>
```

- [ ] **Step 4: NetWorthChart 手機降低高度**

```bash
grep -n "height\|NetWorthChart" src/app/page.tsx | head -10
```

找到圖表高度設定，修改為：

```tsx
{/* 若是 Recharts ResponsiveContainer */}
<ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 768 ? 200 : 300}>

{/* 或使用 CSS class 控制 */}
<div className="h-48 md:h-72">
  <ResponsiveContainer width="100%" height="100%">
```

- [ ] **Step 5: Monthly Alerts 手機換行**

在 `src/app/page.tsx` 找到 alert 區塊，確認使用 `flex-col` 在手機：

```tsx
<div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
  {alerts.map(alert => (
    <div key={alert.id} className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 ...">
      {/* alert content */}
    </div>
  ))}
</div>
```

- [ ] **Step 6: FinancialGoals 手機單欄**

```bash
grep -n "grid\|flex" src/components/FinancialGoals.tsx | head -10
```

找到 Goals 的 grid，修改：

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
```

- [ ] **Step 7: 手動測試 Dashboard 手機版**

```
iPhone 12（390px）模式：
1. 頁面不出現橫向 scrollbar
2. 所有 KPI 卡片可看清楚
3. 圖表正常顯示（不過小）
4. Alert 訊息完整顯示
5. 資產卡片單欄排列
```

- [ ] **Step 8: Commit**

```bash
git add src/components/HeroKPI.tsx src/app/page.tsx src/components/FinancialGoals.tsx
git commit -m "feat(mobile): Dashboard responsive - single column layout for mobile"
```

---

### Task 3：Cashflow 手機響應式

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: 確認 Cashflow 的收入/支出並排佈局**

```bash
grep -n "grid\|cols-2\|flex" src/app/cashflow/page.tsx | head -20
```

找到收入/支出並排的 wrapper element。

- [ ] **Step 2: 收入/支出改為手機單欄**

```tsx
{/* 修改前：grid-cols-2 */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
  {/* 收入列 */}
  <div className="...">
    <h3>收入</h3>
    {/* income items */}
  </div>
  {/* 支出列 */}
  <div className="...">
    <h3>支出</h3>
    {/* expense items */}
  </div>
</div>
```

- [ ] **Step 3: Month Navigator 手機縮短日期**

找到月份導航的日期顯示，修改：

```tsx
{/* 手機只顯示月份，桌機顯示年月 */}
<span className="font-semibold">
  <span className="hidden md:inline">{currentYear}年</span>
  {currentMonth + 1}月
</span>
```

- [ ] **Step 4: Tab 標籤手機縮短**

找到 Tab 按鈕，若標籤過長：

```tsx
<button onClick={() => setActiveTab('flow')}>
  <span className="hidden md:inline">月度</span>現金流
</button>
<button onClick={() => setActiveTab('category')}>
  分析<span className="hidden md:inline">（分類）</span>
</button>
```

或確認三個 Tab 在 390px 不溢出（若已 OK 則跳過）。

- [ ] **Step 5: 類別管理 Modal 全螢幕（手機）**

找到類別管理的 Modal/Dialog，確認手機全螢幕：

```tsx
<div className={`fixed inset-0 z-50 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[450px] md:rounded-2xl bg-white shadow-xl overflow-auto`}>
  {/* modal content */}
</div>
```

- [ ] **Step 6: 手動測試 Cashflow 手機版**

```
iPhone 12（390px）：
1. 收入/支出單欄顯示，各自可滾動
2. 新增項目表單可正常輸入（點選、填寫、儲存）
3. 月份導航可切換
4. 三個 Tab 全部可見，不截斷
5. 類別管理 Modal 開啟後全螢幕
```

- [ ] **Step 7: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(mobile): Cashflow responsive - single column, full-screen modals"
```

---

### Task 4：Health Score 手機響應式

**Files:**
- Modify: `src/app/health/page.tsx`

- [ ] **Step 1: 確認 Health 頁面佈局**

```bash
grep -n "grid\|cols\|gauge\|width\|height" src/app/health/page.tsx | head -20
```

- [ ] **Step 2: Score Gauge 手機縮小**

找到 SVG gauge 的尺寸設定（通常是 `width`、`height`、`viewBox`、`r`（radius）等）：

```tsx
{/* 修改：手機 160px，桌機 200px */}
<div className="w-40 h-40 md:w-52 md:h-52 mx-auto">
  <svg viewBox="0 0 200 200" className="w-full h-full">
    {/* SVG 內容不變，靠 viewBox 縮放 */}
  </svg>
</div>
```

若 SVG 使用固定 px 尺寸，改為 `viewBox` + 100% 寬高。

- [ ] **Step 3: Metric Cards 手機改 2 欄**

找到 6 個指標卡片的 grid：

```tsx
{/* 修改前：grid-cols-3 */}
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
  {metrics.map(metric => (
    <div key={metric.id} className="...">
      {/* metric card */}
    </div>
  ))}
</div>
```

- [ ] **Step 4: Action Plan CTA 按鈕全寬**

找到行動建議的 CTA 按鈕：

```tsx
<Link
  href={action.href}
  className="w-full md:w-auto block text-center px-4 py-2 ... rounded-lg"
>
  {action.label}
</Link>
```

- [ ] **Step 5: Health Trend Chart 手機降低高度**

```tsx
<div className="h-36 md:h-48">
  <ResponsiveContainer width="100%" height="100%">
    {/* chart */}
  </ResponsiveContainer>
</div>
```

- [ ] **Step 6: 手動測試 Health 手機版**

```
iPhone 12（390px）：
1. Score Gauge 清楚可見（不過大也不過小）
2. 6 個指標卡片 2 欄顯示（3 排）
3. 每個卡片文字不截斷
4. Action Plan 建議文字完整顯示
5. CTA 按鈕全寬，可點擊
6. 趨勢圖表顯示正常
```

- [ ] **Step 7: Commit**

```bash
git add src/app/health/page.tsx
git commit -m "feat(mobile): Health Score responsive - 2-col metrics, resized gauge"
```

---

### Task 5：最終驗證

- [ ] **Step 1: 全頁面手機測試**

在 Chrome DevTools iPhone 12（390px）逐一測試：

```
□ Dashboard：無橫向 scrollbar，所有內容可見
□ Cashflow：表單可操作，tab 完整顯示
□ Health：gauge 可見，metric cards 2 欄
□ 底部 Tab Bar：5 個 icon，active 狀態正確
□ FIRE（未修改但確認不崩潰）
□ Stocks（未修改但確認不崩潰）
```

- [ ] **Step 2: 桌機版面確認（不退步）**

在 1280px 桌機確認三頁佈局與修改前相同。

- [ ] **Step 3: TypeScript 和 Build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -5
```

Expected: 無 error，`✓ Compiled successfully`

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "feat(mobile): complete mobile responsive for Dashboard, Cashflow, Health + bottom nav"
```

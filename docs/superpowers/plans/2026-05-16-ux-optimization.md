# UX 全面優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面提升 AssetDash 的 PM/UX 體驗，涵蓋觸控優化、備份狀態、資產卡折疊、預算功能、圖表 drill-down、股票頁改進、首次引導、FIRE 即時計算共 10 項改進。

**Architecture:** 純前端 Next.js 15 + React 19 + Tailwind CSS，所有狀態存於 localStorage（useStickyState）。新功能以最小 Context 擴充 + 元件層 state 實作，不引入新依賴。

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide React, Vitest（lib 層測試）

---

## 檔案異動地圖

| 檔案 | 動作 | 用途 |
|------|------|------|
| `src/components/AssetComponents.tsx` | 修改 | 資產卡折疊 + 手機觸控 |
| `src/app/cashflow/page.tsx` | 修改 | 手機觸控 + 預算功能 + 圖表 drill-down |
| `src/components/BackupBanner.tsx` | 修改 | 常態備份狀態顯示 |
| `src/components/Navbar.tsx` | 修改 | md~xl 導覽 tooltip |
| `src/app/page.tsx` | 修改 | 本月注意事項區塊 |
| `src/context/AppContext.tsx` | 修改 | 新增 categoryBudgets 狀態 |
| `src/app/stocks/page.tsx` | 修改 | 最後更新時間 + 投資組合 KPI |
| `src/components/OnboardingWizard.tsx` | 新增 | 首次使用引導精靈 |
| `src/components/ClientLayout.tsx` | 修改 | 注入 OnboardingWizard |
| `src/app/fire/page.tsx` | 修改 | FIRE 即時計算 |

---

## Task 1：資產卡片預設折疊

**Files:**
- Modify: `src/components/AssetComponents.tsx:170-end`

- [ ] **Step 1: 在 AssetCategoryCard 加入 collapsed 狀態**

在 `AssetCategoryCard` function 內，`isEditingCard` 宣告後加入：

```tsx
const [collapsed, setCollapsed] = useState(false);
```

- [ ] **Step 2: 修改卡片 header，加入折疊按鈕與點擊切換**

找到 AssetCategoryCard 的 return JSX，找到顯示類別標題的 div（含 `category.title` 的那一行）。把整個卡片 header 區塊改成可點擊，並加入 chevron icon：

在檔案頂部 import 加入 `ChevronDown, ChevronUp`：
```tsx
import { Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
```

- [ ] **Step 3: 找到卡片 header 區塊並加入折疊控制**

在 `AssetCategoryCard` 的 return 中，找到顯示 `category.title` 的 header 區塊（通常是 `<div className="... flex items-center ...">` 含 colorClass dot 和 title），在標題右側加入折疊按鈕：

```tsx
<button
  onClick={() => setCollapsed(c => !c)}
  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-auto"
  title={collapsed ? '展開' : '折疊'}
>
  {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
</button>
```

- [ ] **Step 4: 用 collapsed 條件隱藏卡片內容**

在卡片 items 列表與 AddAssetRow 外層，用 `{!collapsed && (...)}` 包住：

```tsx
{!collapsed && (
  <div className="mt-3 space-y-0.5">
    {category.items.map(item => (
      <EditableAssetRow ... />
    ))}
    <AddAssetRow ... />
  </div>
)}
```

- [ ] **Step 5: 折疊時仍顯示類別小計**

確認 `categoryTotal` 金額在 header 中始終可見（不受 collapsed 影響）。若目前放在 items 區塊內，搬到 header 旁邊。

- [ ] **Step 6: 手動驗證**

```
1. 開啟首頁
2. 點擊任一資產卡的折疊按鈕 → 項目列表消失，小計仍顯示
3. 再次點擊 → 項目展開
4. 重新整理頁面 → 卡片預設展開（collapsed 初始值為 false）
```

- [ ] **Step 7: Commit**

```bash
git add src/components/AssetComponents.tsx
git commit -m "feat: add collapse toggle to asset category cards"
```

---

## Task 2：手機觸控優化（移除 hover-reveal 編輯按鈕）

**Files:**
- Modify: `src/components/AssetComponents.tsx` (EditableAssetRow)
- Modify: `src/app/cashflow/page.tsx` (CashFlowRow)

**原因：** `opacity-0 group-hover:opacity-100` 在觸控裝置上永遠看不到。改為在手機上常駐顯示小圖示按鈕。

- [ ] **Step 1: 修改 EditableAssetRow 的按鈕可見性**

在 `src/components/AssetComponents.tsx` 第 74 行，找到：
```tsx
<div className={`flex gap-1 transition-opacity ${item.id.startsWith('auto-') ? 'invisible' : 'opacity-0 group-hover:opacity-100'}`}>
```

改為：
```tsx
<div className={`flex gap-1 transition-opacity ${item.id.startsWith('auto-') ? 'invisible' : 'opacity-60 sm:opacity-0 sm:group-hover:opacity-100'}`}>
```

這樣手機（< sm）上按鈕常駐 60% 透明度，桌機維持 hover reveal。

- [ ] **Step 2: 修改 CashFlowRow 的按鈕可見性**

在 `src/app/cashflow/page.tsx` CashFlowRow 的 return，找到：
```tsx
<div className="opacity-0 group-hover:opacity-100 flex gap-1">
```

改為：
```tsx
<div className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 flex gap-1">
```

- [ ] **Step 3: 手動驗證**

```
1. 開啟 Chrome DevTools，切換到手機模擬模式（375px 寬）
2. 首頁資產卡 → 每個項目右側應可見編輯/刪除圖示（半透明）
3. 收支頁 → 每筆收支右側應可見編輯/刪除圖示
4. 在桌機寬度，hover 前應看不到按鈕，hover 後才出現
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AssetComponents.tsx src/app/cashflow/page.tsx
git commit -m "feat: show edit buttons on mobile without hover"
```

---

## Task 3：備份狀態常態顯示

**Files:**
- Modify: `src/components/BackupBanner.tsx`

**目標：** 現行 BackupBanner 只在超過 7 天才顯示。改為在 banner 內同時顯示「距上次備份 X 天」資訊，讓用戶隨時感知備份狀態，不只是警示。

- [ ] **Step 1: 修改 BackupBanner，讓未超期也顯示「已備份」狀態**

將 BackupBanner 的條件從「only show if overdue」改為「always show unless dismissed，過期時變警告色，未過期時用成功色」：

```tsx
"use client";

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Download, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

function daysSince(isoDate: string): number {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

export function BackupBanner() {
  const ctx = useAppContext();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const days = daysSince(ctx.lastExportDate);
  const neverExported = !ctx.lastExportDate;
  const isOverdue = days >= 7;

  if (dismissed && !isOverdue) return null;

  const handleExportNow = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets: ctx.assets,
      liabilities: ctx.liabilities,
      stakingItems: ctx.stakingItems,
      loans: ctx.loans,
      stockItems: ctx.stockItems,
      incomeItems: ctx.incomeItems,
      expenseItems: ctx.expenseItems,
      annualEntries: ctx.annualEntries,
      snapshots: ctx.snapshots,
      borrowingLimits: ctx.borrowingLimits,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assetdash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ctx.setLastExportDate(new Date().toISOString());
    toast('資料已匯出備份');
    setDismissed(true);
  };

  if (isOverdue || neverExported) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-amber-800 font-medium">
            {neverExported ? '您尚未備份過資料' : `距上次備份已 ${days} 天`}，建議立即備份以避免資料遺失。
          </p>
          <button
            onClick={handleExportNow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            立即備份
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 text-amber-400 hover:text-amber-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
        <p className="flex-1 text-sm text-emerald-700">
          上次備份：{days === 0 ? '今天' : `${days} 天前`}
        </p>
        <button
          onClick={handleExportNow}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          備份
        </button>
        <button onClick={() => setDismissed(true)} className="p-1 text-emerald-400 hover:text-emerald-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 手動驗證**

```
1. 若有 lastExportDate（近期）→ 顯示綠色「上次備份：X 天前」+ 備份按鈕
2. 若 lastExportDate 超過 7 天 → 顯示橘色警告 banner
3. 若從未備份 → 顯示橘色警告
4. 點「備份」→ 下載 JSON，banner 變綠
5. 點 X 關閉（未過期）→ banner 隱藏
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BackupBanner.tsx
git commit -m "feat: always show backup status with color-coded indicator"
```

---

## Task 4：導覽列中板螢幕（md~xl）加 Tooltip

**Files:**
- Modify: `src/components/Navbar.tsx`

**目標：** 目前 md~xl 只顯示 icon，用戶需猜測功能。加入 `title` 屬性（已有）+ 視覺 tooltip 讓體驗更好，或者直接降低斷點讓文字更早出現。

- [ ] **Step 1: 調整斷點讓文字標籤出現更早**

在 `Navbar.tsx` 找到「平板：icon only，md ~ xl」的區塊：
```tsx
{/* 平板：icon only，md ~ xl */}
<div className="hidden md:flex gap-5 xl:hidden items-center gap-0.5">
```

改為直接在 lg 以上顯示文字（移除 icon-only 的中間層），讓桌機文字導覽從 lg 開始：

```tsx
{/* 手機隱藏，lg 以下 icon only */}
<div className="hidden md:flex lg:hidden items-center gap-0.5">
  {NAV_LINKS.map(({ href, label, Icon }) => (
    <Link key={href} href={href} title={label} className={getIconNavClass(href)}>
      <Icon className="w-5 h-5" />
    </Link>
  ))}
</div>

{/* lg+ 顯示 icon + 文字 */}
<div className="hidden lg:flex items-center gap-0.5">
  {NAV_LINKS.map(({ href, label, Icon }) => (
    <Link key={href} href={href} className={getNavClass(href)}>
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  ))}
</div>
```

- [ ] **Step 2: 手動驗證**

```
1. 瀏覽器寬度 < 768px → 漢堡選單
2. 768px ~ 1024px → icon only（有 title tooltip）
3. 1024px+ → icon + 中文標籤
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: show nav text labels from lg breakpoint instead of xl"
```

---

## Task 5：儀表板「本月注意事項」區塊

**Files:**
- Modify: `src/app/page.tsx`

**目標：** 在 HeroKPI 上方加一個卡片，自動彙整：擔保比率警示（質押）、距離目標達成率、本月現金流是否為負。

- [ ] **Step 1: 在 page.tsx 加入 alerts 計算邏輯**

在 `DashboardPage` function 的 hooks 區，現有的 `runwayMonths` 計算下方加入：

```tsx
const { stakingItems, financialGoals } = useAppContext();

const alerts = useMemo(() => {
  const result: Array<{ level: 'warn' | 'info'; message: string }> = [];

  // 現金流為負
  if (monthlyNetCashFlow < 0) {
    result.push({ level: 'warn', message: `本月預計現金流為負（${formatCurrency(monthlyNetCashFlow)}），支出超過收入` });
  }

  // 現金跑道不足 3 個月
  if (runwayMonths !== null && runwayMonths < 3) {
    result.push({ level: 'warn', message: `現金彈藥僅剩 ${runwayMonths.toFixed(1)} 個月，建議補充流動資金` });
  }

  // 質押擔保比率警示（borrowItems apy > 0 且 value < threshold）
  const borrowItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
  for (const item of borrowItems) {
    if (item.pledgeRatio && item.pledgeRatio > 70) {
      result.push({ level: 'warn', message: `「${item.name}」質押比率 ${item.pledgeRatio}%，接近警戒線` });
    }
  }

  // 距離財務目標
  if (financialGoals && financialGoals.length > 0) {
    const closest = financialGoals
      .filter(g => g.targetAmount > netWorth)
      .sort((a, b) => a.targetAmount - b.targetAmount)[0];
    if (closest) {
      const progress = Math.min(100, (netWorth / closest.targetAmount) * 100);
      if (progress >= 80) {
        result.push({ level: 'info', message: `目標「${closest.name}」已達成 ${progress.toFixed(0)}%，再加把勁！` });
      }
    }
  }

  return result;
}, [monthlyNetCashFlow, runwayMonths, stakingItems, financialGoals, netWorth, formatCurrency]);
```

**注意：** 需要從 `useAppContext()` 解構 `stakingItems` 與 `financialGoals`（若尚未解構）。

- [ ] **Step 2: 在 JSX 中渲染注意事項區塊**

在 Demo Banner 下方、現有的 `mb-6 flex flex-wrap gap-4` 摘要 bar 上方插入：

```tsx
{alerts.length > 0 && (
  <div className="mb-6 space-y-2">
    {alerts.map((alert, i) => (
      <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
        alert.level === 'warn'
          ? 'bg-amber-50 border border-amber-200 text-amber-800'
          : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
      }`}>
        {alert.level === 'warn'
          ? <span className="text-amber-500">⚠️</span>
          : <span className="text-indigo-500">💡</span>
        }
        {alert.message}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: 確認型別**

確認 `useAppContext` 的 return type 包含 `stakingItems` 和 `financialGoals`。如果 `StakingItem` 沒有 `pledgeRatio` 欄位，改用 `item.value > 0 && item.apy > 10` 作為簡易警示條件。

實際可用的條件（保守版）：

```tsx
// 質押利率超過 10% 的借款項目警示
const borrowItems = stakingItems.filter(i => (i.stakingType ?? 'borrow') === 'borrow');
for (const item of borrowItems) {
  if (item.apy > 10) {
    result.push({ level: 'warn', message: `「${item.name}」借貸年利率 ${item.apy}%，注意資金成本` });
  }
}
```

- [ ] **Step 4: 手動驗證**

```
1. 讓月支出 > 月收入 → 首頁出現「現金流為負」警示
2. 讓流動資金極少（< 月支出 × 3）→ 出現「現金彈藥不足」警示
3. 無任何警示時 → 注意事項區塊不顯示
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add monthly alerts panel to dashboard"
```

---

## Task 6：現金流預算功能（類別月預算 + 進度條）

**Files:**
- Modify: `src/context/AppContext.tsx`（新增 categoryBudgets state）
- Modify: `src/app/cashflow/page.tsx`（CategoryAnalysisTab 加預算輸入與進度條）

- [ ] **Step 1: 在 AppContext 新增 categoryBudgets 狀態**

在 `AppContext.tsx` 中，找到其他 `useStickyState` 的呼叫，在同一區塊加入：

```tsx
const [categoryBudgets, setCategoryBudgets] = useStickyState<Record<string, number>>(
  {},
  'assetdash-category-budgets',
);
```

在 Context value（return 的物件）中加入：
```tsx
categoryBudgets,
setCategoryBudgets,
```

在 Context type interface 加入：
```tsx
categoryBudgets: Record<string, number>;
setCategoryBudgets: (v: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
```

- [ ] **Step 2: 在 CategoryAnalysisTab 加入預算設定 UI**

在 `src/app/cashflow/page.tsx` 的 `CategoryAnalysisTab` function 中，從 `useAppContext` 解構 `categoryBudgets, setCategoryBudgets`：

```tsx
const { categoryBudgets, setCategoryBudgets } = useAppContext();
```

在 `CategoryManager` 下方，`donutData.length === 0` 條件前，加入預算設定區塊：

```tsx
{/* 類別預算設定 */}
{customCategories.length > 0 && (
  <div className="mb-6">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">月預算設定</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {customCategories.map((cat, i) => {
        const spent = expenseItems
          .filter(e => e.customCategory === cat)
          .reduce((s, e) => s + e.amount, 0);
        const budget = categoryBudgets[cat] ?? 0;
        const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
        const color = getCategoryColor(cat, customCategories);
        return (
          <div key={cat} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color }}>{cat}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">預算</span>
                <input
                  type="number"
                  value={budget || ''}
                  onChange={e => setCategoryBudgets(prev => ({
                    ...prev,
                    [cat]: Number(e.target.value) || 0,
                  }))}
                  placeholder="未設定"
                  className="w-20 text-xs text-right border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-300"
                />
              </div>
            </div>
            {budget > 0 && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : color,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>已用 {showValues ? spent.toLocaleString() : '****'}</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 3: 手動驗證**

```
1. 到收支管理 → 類別分析 Tab
2. 新增自訂類別（例：餐飲）
3. 幫支出項目指定類別
4. 在預算設定中輸入金額 → 出現進度條
5. 進度條顏色：< 70% 類別色，70-90% 橘，> 90% 紅
```

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx src/app/cashflow/page.tsx
git commit -m "feat: add per-category monthly budget with progress bars"
```

---

## Task 7：現金流圖表月份 Drill-down

**Files:**
- Modify: `src/app/cashflow/page.tsx`

**目標：** 點擊 12 個月趨勢圖中某月份 → 彈出 Modal 顯示該月收支明細。

- [ ] **Step 1: 加入 selectedMonth 狀態**

在 `CashFlowPage` function 頂部（`isAddingIncome` 旁）加入：

```tsx
const [selectedMonth, setSelectedMonth] = useState<{ label: string; income: number; expense: number; net: number } | null>(null);
```

- [ ] **Step 2: 讓 BarChart 支援點擊事件**

找到 `<BarChart data={monthTrend} ...>` 加入 `onClick` prop：

```tsx
<BarChart
  data={monthTrend}
  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
  barCategoryGap="30%"
  onClick={(data) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      setSelectedMonth(data.activePayload[0].payload);
    }
  }}
  style={{ cursor: 'pointer' }}
>
```

- [ ] **Step 3: 加入 Drill-down Modal**

在 CashFlowPage return 的最末端（`<AnnualTracker />` 下方），加入：

```tsx
{selectedMonth && (
  <div
    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    onClick={() => setSelectedMonth(null)}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">{selectedMonth.label} 收支摘要</h3>
        <button onClick={() => setSelectedMonth(null)} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">收入</span>
          <span className="font-bold text-emerald-600">{formatCurrency(selectedMonth.income)}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">支出</span>
          <span className="font-bold text-rose-600">{formatCurrency(selectedMonth.expense)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm font-bold text-gray-900">淨盈餘</span>
          <span className={`font-bold text-lg ${selectedMonth.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {formatCurrency(selectedMonth.net)}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">儲蓄率：{selectedMonth.income > 0 ? ((selectedMonth.net / selectedMonth.income) * 100).toFixed(1) : 0}%</p>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: 手動驗證**

```
1. 到收支管理頁
2. 點擊 12 個月趨勢圖中任意月份的柱狀
3. 出現 Modal 顯示該月收入/支出/淨盈餘/儲蓄率
4. 點 X 或點 Modal 外部 → Modal 關閉
```

- [ ] **Step 5: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat: add month drill-down modal to cashflow chart"
```

---

## Task 8：股票頁面 - 最後更新時間 + 投資組合 KPI

**Files:**
- Modify: `src/app/stocks/page.tsx`

- [ ] **Step 1: 找到股票報價刷新的觸發點**

在 `src/app/stocks/page.tsx` 中找到報價刷新相關邏輯（`refreshQuotes` 或類似函數）。加入 `lastRefreshed` 狀態：

```tsx
const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
```

在刷新完成後（quotes 更新後），設定：
```tsx
setLastRefreshed(new Date());
```

- [ ] **Step 2: 在頁面頂部加入「最後更新」顯示**

在股票頁面 `<h1>` 標題旁，加入：

```tsx
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">投資追蹤</h1>
    <p className="text-sm text-gray-500 mt-1">
      管理您的股票投資組合
      {lastRefreshed && (
        <span className="ml-2 text-xs text-gray-400">
          · 報價更新於 {lastRefreshed.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </p>
  </div>
  <button
    onClick={() => { /* 觸發刷新 */; setLastRefreshed(new Date()); }}
    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
  >
    <RotateCcw className="w-4 h-4" />
    更新報價
  </button>
</div>
```

（將既有的刷新按鈕邏輯整合進此按鈕）

- [ ] **Step 3: 加入投資組合總覽 KPI**

在股票列表上方，加入總覽卡片：

```tsx
{stockItems.length > 0 && (() => {
  const totalCost = stockItems.reduce((s, item) => s + item.avgCost * item.shares, 0);
  const totalMarket = stockItems.reduce((s, item) => {
    const quote = stockQuotes[item.symbol];
    return s + (quote ? quote.price * item.shares : item.avgCost * item.shares);
  }, 0);
  const pnl = totalMarket - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">持倉成本</p>
        <p className="font-bold text-gray-900 text-lg">{formatCurrency(totalCost)}</p>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">市值</p>
        <p className="font-bold text-gray-900 text-lg">{formatCurrency(totalMarket)}</p>
      </div>
      <div className={`rounded-2xl p-4 border shadow-sm ${pnl >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">損益</p>
        <p className={`font-bold text-lg ${pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(pnl)}</p>
      </div>
      <div className={`rounded-2xl p-4 border shadow-sm ${pnlPct >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">報酬率</p>
        <p className={`font-bold text-lg ${pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pnlPct.toFixed(2)}%</p>
      </div>
    </div>
  );
})()}
```

**注意：** 需要確認 `stockQuotes` 的存取方式（可能來自 `useStockContext()`），調整變數名稱。

- [ ] **Step 4: 手動驗證**

```
1. 股票頁面頂部出現 4 個 KPI 卡片（成本/市值/損益/報酬率）
2. 報價更新後右上角顯示「報價更新於 HH:MM」
3. 損益正數 → 綠色，負數 → 紅色
```

- [ ] **Step 5: Commit**

```bash
git add src/app/stocks/page.tsx
git commit -m "feat: add portfolio KPI cards and last-refresh time to stocks page"
```

---

## Task 9：首次使用引導精靈（Onboarding Wizard）

**Files:**
- Create: `src/components/OnboardingWizard.tsx`
- Modify: `src/components/ClientLayout.tsx`
- Modify: `src/context/AppContext.tsx`（新增 onboardingDone state）

- [ ] **Step 1: 在 AppContext 加入 onboardingDone 狀態**

```tsx
const [onboardingDone, setOnboardingDone] = useStickyState<boolean>(false, 'assetdash-onboarding-done');
```

在 Context value 加入：
```tsx
onboardingDone,
setOnboardingDone,
```

在 Context type 加入：
```tsx
onboardingDone: boolean;
setOnboardingDone: (v: boolean) => void;
```

- [ ] **Step 2: 建立 OnboardingWizard.tsx**

```tsx
"use client";

import { useState } from 'react';
import { LayoutDashboard, Wallet, BarChart3, Check, ChevronRight, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const STEPS = [
  {
    icon: LayoutDashboard,
    title: '歡迎使用 AssetDash！',
    desc: '這是您的個人財務儀表板，所有資料都安全地存在您的設備上，不會上傳到任何伺服器。',
    action: '開始設定',
  },
  {
    icon: Wallet,
    title: '第一步：登錄您的資產',
    desc: '前往「總覽」頁面，在資產分佈區域新增您的現金、投資、房產等資產項目。點擊各類別卡片的「新增項目」即可開始。',
    action: '了解了',
  },
  {
    icon: BarChart3,
    title: '第二步：記錄每月收支',
    desc: '在「收支管理」頁面登錄固定的月收入與支出，系統會自動計算您的儲蓄率與現金流狀況。',
    action: '完成設定',
  },
];

export function OnboardingWizard() {
  const { onboardingDone, setOnboardingDone, assets } = useAppContext();
  const [step, setStep] = useState(0);

  const isDemoData = assets.some(cat => cat.items.some(item => item.id === 'l1'));
  if (onboardingDone || isDemoData) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={() => setOnboardingDone(true)}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors ${i <= step ? 'bg-indigo-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-5">
          <Icon className="w-7 h-7 text-indigo-600" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">{current.desc}</p>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{step + 1} / {STEPS.length}</span>
          <button
            onClick={() => {
              if (isLast) setOnboardingDone(true);
              else setStep(s => s + 1);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            {isLast ? <><Check className="w-4 h-4" /> {current.action}</> : <>{current.action} <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 ClientLayout 注入 OnboardingWizard**

在 `src/components/ClientLayout.tsx` 中 import 並加入：

```tsx
import { OnboardingWizard } from './OnboardingWizard';
```

在 Layout 的 children 後面加入：
```tsx
<OnboardingWizard />
```

- [ ] **Step 4: 手動驗證**

```
1. 清空 localStorage（或 DevTools > Application > Clear storage）
2. 重新整理頁面 → 出現引導精靈
3. 點「開始設定」→ 進到第二頁
4. 點「了解了」→ 第三頁
5. 點「完成設定」→ 精靈關閉，不再出現
6. 有 Demo 資料時 → 不顯示引導精靈
```

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingWizard.tsx src/components/ClientLayout.tsx src/context/AppContext.tsx
git commit -m "feat: add onboarding wizard for first-time users"
```

---

## Task 10：FIRE 計算機即時計算

**Files:**
- Modify: `src/app/fire/page.tsx`

**目標：** 目前 FIRE 計算機的輸入若有「提交」或「計算」按鈕，改為即時（onChange）觸發計算，讓用戶調整參數時立即看到結果變化。

- [ ] **Step 1: 讀取 fire/page.tsx 找出計算觸發方式**

先確認目前是「按鈕觸發計算」還是「已有即時計算」。若已是 `useMemo`/即時計算，跳過此 Task。

- [ ] **Step 2: 若有「計算」按鈕，改為 useMemo 即時計算**

找到 FIRE 計算結果相關的 `useState`（例如 `const [result, setResult] = useState(null)`），改為：

```tsx
const result = useMemo(() => {
  // 原本按鈕 onClick 裡的計算邏輯移到這裡
  return calculateFireProjection(fireSettings);
}, [fireSettings]);
```

刪除觸發計算的 button，若 button 只是計算，移除或改為「重設」按鈕。

- [ ] **Step 3: 每個輸入框加入 `type="range"` 搭配 `type="number"` 雙模式（可選）**

對「預期報酬率」「安全提領率」「目標年齡」等關鍵參數，加入 range slider：

```tsx
<div className="space-y-1">
  <label className="text-xs text-gray-500">預期年報酬率</label>
  <div className="flex items-center gap-3">
    <input
      type="range"
      min="1" max="20" step="0.5"
      value={fireSettings.expectedReturn}
      onChange={e => setFireSettings(prev => ({ ...prev, expectedReturn: Number(e.target.value) }))}
      className="flex-1 accent-indigo-600"
    />
    <span className="text-sm font-bold text-indigo-600 w-12 text-right">{fireSettings.expectedReturn}%</span>
  </div>
</div>
```

- [ ] **Step 4: 手動驗證**

```
1. 到 FIRE 計算機頁面
2. 拖動「預期報酬率」滑桿 → 退休年齡數字立即更新
3. 修改任何參數 → 結果即時變化，無需點擊「計算」
```

- [ ] **Step 5: Commit**

```bash
git add src/app/fire/page.tsx
git commit -m "feat: make FIRE calculator recalculate on every input change"
```

---

## 自我審查

### Spec 覆蓋率對照

| 分析報告建議 | 對應 Task |
|------------|----------|
| 導覽標籤 | Task 4 ✅ |
| 首次使用引導 | Task 9 ✅ |
| 備份狀態常態顯示 | Task 3 ✅ |
| 儀表板注意事項 | Task 5 ✅ |
| 手機觸控優化 | Task 2 ✅ |
| 現金流預算 vs 實績 | Task 6 ✅ |
| 圖表 drill-down | Task 7 ✅ |
| 資產卡片折疊 | Task 1 ✅ |
| 股票頁 KPI + 更新時間 | Task 8 ✅ |
| FIRE 即時計算 | Task 10 ✅ |

### 潛在風險

- Task 8 的 `stockQuotes` 存取方式需依 `stocks/page.tsx` 實際結構調整，計劃中已加 NOTE 提醒
- Task 5 的 `stakingItems.pledgeRatio` 欄位可能不存在，已提供保守替代方案
- Task 10 需先讀 `fire/page.tsx` 確認現有計算方式，避免重複工作

### 執行建議

Tasks 1-4 為獨立 UI 改動，可並行分配。Tasks 5-10 各自獨立，建議依 1→2→3→4→5→6→7→8→9→10 順序執行以方便 review。

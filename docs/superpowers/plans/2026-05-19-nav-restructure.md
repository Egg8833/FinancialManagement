# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將導航從 9 頁縮減為 6 頁，刪除 `/chart`，將 `/annual` 合併進 Cashflow，重命名 `/staking` 為 `/debt`，並將 Settings 移出頂層導航。

**Architecture:** 純 UI/Route 重組，不改動 AppContext 資料結構。刪除頁面前先將功能移植，再刪除原頁面，最後加 redirect 確保舊書籤不失效。

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Lucide React

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/Navbar.tsx` | 重組連結，Settings 改圖示 |
| Modify | `src/app/page.tsx` | 新增快照管理 UI（移自 chart） |
| Modify | `src/app/cashflow/page.tsx` | 新增「年度總覽」tab（移自 annual） |
| Rename | `src/app/staking/` → `src/app/debt/` | 路由重命名 |
| Delete | `src/app/chart/page.tsx` | 刪除頁面 |
| Delete | `src/app/annual/page.tsx` | 刪除頁面 |
| Modify | `next.config.ts` | 加 redirects |

---

### Task 1：新增快照管理到 Dashboard（移植自 `/chart`）

**Files:**
- Modify: `src/app/page.tsx`

先看現有 Dashboard 的快照相關 code：
- [ ] **Step 1: 確認 AppContext 快照 API**

```bash
grep -n "assetSnapshots\|takeSnapshot\|deleteSnapshot" src/context/AppContext.tsx | head -30
```

Expected: 找到 `assetSnapshots` array、`takeSnapshot` function、刪除功能（可能叫 `removeSnapshot` 或 `deleteSnapshot`）。

- [ ] **Step 2: 確認 `/chart` 頁的快照 UI 實作**

```bash
cat src/app/chart/page.tsx
```

找到：Snapshot 列表 render、刪除按鈕邏輯、空狀態 UI。

- [ ] **Step 3: 在 Dashboard 底部新增 SnapshotManager 摺疊區塊**

在 `src/app/page.tsx` 找到最後一個主要區塊（通常是 NetWorthChart 或 FinancialGoals 之後），加入：

```tsx
{/* 快照管理 */}
<div className="mt-6">
  <details className="group">
    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none">
      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
      快照紀錄（{assetSnapshots.length} 筆）
    </summary>
    <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
      {assetSnapshots.length === 0 ? (
        <p className="p-4 text-sm text-gray-400 text-center">尚無快照，點擊右上角「拍快照」開始紀錄</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">日期</th>
              <th className="px-4 py-2 text-right text-gray-500 font-medium">淨資產</th>
              <th className="px-4 py-2 text-right text-gray-500 font-medium">健康分數</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {[...assetSnapshots].reverse().map((snap, idx) => (
              <tr key={snap.date} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{snap.date}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-800">
                  {showValues ? `NT$${snap.totalAssets?.toLocaleString() ?? '-'}` : '●●●●●'}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {snap.healthScore ?? '-'}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`確定刪除 ${snap.date} 的快照？`)) {
                        deleteSnapshot(snap.date)
                      }
                    }}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </details>
</div>
```

確認 `deleteSnapshot`（或現有刪除 function 名稱）已從 AppContext 解構，確認 `ChevronDown`、`Trash2` 已 import from `lucide-react`。

- [ ] **Step 4: 將 takeSnapshot 按鈕移至 Dashboard header**

找到 Dashboard header 區域（通常有淨資產標題、隱藏金額 toggle），新增：

```tsx
<button
  onClick={takeSnapshot}
  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
>
  <Camera className="w-4 h-4" />
  拍快照
</button>
```

確認 `Camera` 已 import from `lucide-react`。

- [ ] **Step 5: 手動測試快照功能**

```
1. 開啟 Dashboard
2. 點擊「拍快照」
3. 確認快照出現在「快照紀錄」摺疊區塊
4. 點擊刪除圖示，確認 confirm 對話框出現，確認後快照消失
```

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): move snapshot manager from /chart page"
```

---

### Task 2：刪除 `/chart` 頁面

**Files:**
- Delete: `src/app/chart/page.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: 確認 Dashboard 快照功能正常後刪除 chart 頁**

```bash
rm src/app/chart/page.tsx
```

若有 `src/app/chart/` 資料夾但只含 `page.tsx`，也刪除資料夾：

```bash
rm -rf src/app/chart/
```

- [ ] **Step 2: 確認沒有其他地方 import chart 頁的內容**

```bash
grep -rn "from.*chart\|import.*chart" src/ --include="*.tsx" --include="*.ts"
```

Expected: 無結果（或只有自身路徑）。

- [ ] **Step 3: 從 Navbar 移除 Chart 連結**

在 `src/components/Navbar.tsx` 找到 Chart 的導航連結（通常是 `<Link href="/chart">` 或 NavItem），刪除該項目。

- [ ] **Step 4: 確認 build 成功**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`，無 `chart` 相關錯誤。

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(nav): remove /chart page, redirect handled in next step"
```

---

### Task 3：將 Annual 合併進 Cashflow

**Files:**
- Modify: `src/app/cashflow/page.tsx`
- Delete: `src/app/annual/page.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: 確認 Annual 頁面的完整實作**

```bash
cat src/app/annual/page.tsx
```

記錄：使用的 state、components、AppContext 欄位（通常是 `annualItems` 或 `cashFlowItems` + 月份計算）。

- [ ] **Step 2: 確認 AnnualTracker component 是否獨立存在**

```bash
ls src/components/ | grep -i annual
```

若 `AnnualTracker.tsx` 已存在，確認其 props interface。若 annual 邏輯全在 `annual/page.tsx`，需先抽出 component（Step 3）。

- [ ] **Step 3（若需要）：將 Annual 邏輯抽出為 component**

若 annual 邏輯直接在 page，建立 `src/components/AnnualTracker.tsx`：

```tsx
'use client'
// 將 annual/page.tsx 的 JSX 完整複製過來
// 改為 export default function AnnualTracker() { ... }
// 移除 page-level 的 metadata 或 layout 相關 code
```

- [ ] **Step 4: 在 Cashflow 新增第三個 Tab「年度總覽」**

在 `src/app/cashflow/page.tsx` 找到 Tab 切換邏輯（通常是 `activeTab` state），新增：

```tsx
// 在 tab 按鈕列新增
<button
  onClick={() => setActiveTab('annual')}
  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
    activeTab === 'annual'
      ? 'bg-white shadow text-gray-900'
      : 'text-gray-500 hover:text-gray-700'
  }`}
>
  年度總覽
</button>

// 在 tab 內容區新增
{activeTab === 'annual' && (
  <AnnualTracker />
)}
```

確認 `AnnualTracker` 已 import。

- [ ] **Step 5: 手動測試**

```
1. 開啟 /cashflow
2. 點擊「年度總覽」tab
3. 確認年度表格與圖表正常顯示
4. 確認資料與舊 /annual 頁一致
```

- [ ] **Step 6: 刪除 Annual 頁面，移除 Navbar 連結**

```bash
rm src/app/annual/page.tsx
# 若是資料夾
rm -rf src/app/annual/
```

在 `src/components/Navbar.tsx` 移除 Annual 連結。

- [ ] **Step 7: Commit**

```bash
git add src/app/cashflow/page.tsx src/components/AnnualTracker.tsx src/components/Navbar.tsx
git commit -m "feat(cashflow): merge annual view as third tab, remove /annual route"
```

---

### Task 4：重命名 `/staking` 為 `/debt`

**Files:**
- Rename: `src/app/staking/` → `src/app/debt/`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: 建立新路由資料夾**

```bash
# Windows PowerShell
Copy-Item -Path "src/app/staking" -Destination "src/app/debt" -Recurse
```

- [ ] **Step 2: 確認所有 import 路徑**

```bash
grep -rn "staking" src/ --include="*.tsx" --include="*.ts" | grep -v "StakingItem\|stakingItems\|staking-"
```

記錄哪些地方有 `/staking` 路徑引用（href、Link）。

- [ ] **Step 3: 更新頁面標題和 metadata**

在 `src/app/debt/page.tsx` 找到頁面標題：

```tsx
// 修改前
<h1>質押 & 借貸</h1>
// 或任何標題文字

// 修改後
<h1>負債 & 生息資產</h1>
```

若有 `<title>` 或 Next.js metadata，一併更新。

- [ ] **Step 4: 更新 Navbar**

在 `src/components/Navbar.tsx` 找到 staking 連結：

```tsx
// 修改前
<Link href="/staking">質押</Link>

// 修改後
<Link href="/debt">負債管理</Link>
```

- [ ] **Step 5: 確認 AppContext 中 StakingItem 命名不需改動**

AppContext 的 state 名稱（`stakingItems`, `StakingItem` type）是資料層，不需跟 route 同步。保持不變。

- [ ] **Step 6: 確認 /debt 路由正常，再刪除 /staking**

```bash
# 先測試 /debt 正常運作，再刪除舊資料夾
rm -rf src/app/staking/
```

- [ ] **Step 7: Commit**

```bash
git add src/app/debt/ src/components/Navbar.tsx
git commit -m "feat(nav): rename /staking to /debt, update navbar label"
```

---

### Task 5：Settings 移出頂層導航

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: 確認現有 Navbar 結構**

```bash
cat src/components/Navbar.tsx
```

找到：Settings 的 Link/NavItem、icon 引用、目前 layout（flex row）。

- [ ] **Step 2: 移除 Settings 文字連結，新增齒輪圖示**

在 `Navbar.tsx` 找到 Settings Link，替換為：

```tsx
// 移除原本的 Settings NavItem

// 在 Navbar 右側（通常有 flex-1 spacer 之後）新增
<Link
  href="/settings"
  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
  title="設定"
>
  <Settings className="w-5 h-5" />
</Link>
```

確認 `Settings` icon 已 import from `lucide-react`。

- [ ] **Step 3: 確認最終 Navbar 項目數量**

```
導航項目：Dashboard | 現金流 | FIRE | 股票 | 健康 | 負債  [⚙]
```

計算連結數量，確認只有 6 個主要頁面 + 齒輪圖示。

- [ ] **Step 4: 手動測試**

```
1. 開啟任意頁面
2. 確認頂部導航只顯示 6 個項目 + 齒輪圖示
3. 點擊齒輪，確認跳轉至 /settings
4. 確認 /settings 頁面正常運作
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(nav): move Settings to gear icon, finalize 6-item navbar"
```

---

### Task 6：新增 Redirects

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: 確認現有 next.config.ts 內容**

```bash
cat next.config.ts
```

- [ ] **Step 2: 新增 redirects**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/chart',
        destination: '/',
        permanent: true,
      },
      {
        source: '/annual',
        destination: '/cashflow',
        permanent: true,
      },
      {
        source: '/staking',
        destination: '/debt',
        permanent: true,
      },
    ]
  },
  // ...其他現有設定保持不變
}

export default nextConfig
```

- [ ] **Step 3: 測試 redirects**

```bash
npm run dev
```

在瀏覽器開啟：
- `http://localhost:3000/chart` → 應跳轉至 `/`
- `http://localhost:3000/annual` → 應跳轉至 `/cashflow`
- `http://localhost:3000/staking` → 應跳轉至 `/debt`

- [ ] **Step 4: Build 確認**

```bash
npm run build 2>&1 | grep -E "error|Error|✓"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add next.config.ts
git commit -m "feat(nav): add redirects for removed/renamed routes"
```

---

### Task 7：最終驗證

- [ ] **Step 1: 完整 build 測試**

```bash
npm run build && echo "BUILD OK"
```

- [ ] **Step 2: TypeScript 檢查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 無 error 輸出。

- [ ] **Step 3: 手動驗收 checklist**

```
□ Navbar 顯示：Dashboard / 現金流 / FIRE / 股票 / 健康 / 負債 / ⚙
□ /chart 跳轉至 /
□ /annual 跳轉至 /cashflow
□ /staking 跳轉至 /debt
□ /cashflow 有三個 tab（月度 / 分類 / 年度）
□ 年度總覽功能與舊 annual 頁一致
□ Dashboard 有「快照紀錄」摺疊區塊
□ Dashboard header 有「拍快照」按鈕
□ /debt 頁面正常（原 staking 功能）
□ /settings 可透過齒輪圖示進入
```

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "chore(nav): complete navigation restructure - 9 pages to 6"
```

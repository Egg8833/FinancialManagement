# Cashflow Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Cashflow 頁新增月份摘要卡、篩選 Bar、強化類別管理可發現性、修復 Budget 超出 100% 顯示，以及 Annual Tab 的點擊視覺提示。

**Architecture:** 所有新功能使用 local component state（`useState`），不修改 AppContext。篩選邏輯為 pure function，在 render 時計算，不需 useEffect。

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Lucide React

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/app/cashflow/page.tsx` | 月份摘要卡、篩選 bar、類別管理按鈕位置 |
| Modify | `src/components/AnnualTracker.tsx` | Annual 格子 hover 視覺提示（合並 nav-restructure 計畫後） |

---

### Task 1：月份摘要卡

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: 確認現有月份摘要計算邏輯**

```bash
grep -n "income\|expense\|monthly\|total" src/app/cashflow/page.tsx | head -20
```

確認已有計算月收入/月支出的 code（避免重複計算）。

- [ ] **Step 2: 計算儲蓄率**

在 Cashflow page 找到計算 `monthlyIncome` 和 `monthlyExpense` 的位置（若已有就直接用），確保以下變數可用：

```tsx
// 這些通常已存在
const monthlyIncome = cashFlowItems
  .filter(i => i.type === 'income')
  .reduce((sum, i) => sum + (i.amount || 0), 0)

const monthlyExpense = cashFlowItems
  .filter(i => i.type === 'expense')
  .reduce((sum, i) => sum + (i.amount || 0), 0)

const monthlyNet = monthlyIncome - monthlyExpense

// 新增：儲蓄率
const savingsRate = monthlyIncome > 0
  ? Math.round((monthlyNet / monthlyIncome) * 100)
  : 0
```

- [ ] **Step 3: 在月份導航下方加入摘要卡**

在月份導航（`← 5月 →`）和 Tab 之間插入：

```tsx
{/* 月份摘要卡 */}
<div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4">
  <div className="flex flex-wrap gap-4 items-center justify-between">
    <div className="flex gap-6">
      <div>
        <p className="text-xs text-gray-500 mb-0.5">收入</p>
        <p className="text-lg font-bold text-green-700">
          {showValues ? `+NT$${monthlyIncome.toLocaleString()}` : '●●●●'}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">支出</p>
        <p className="text-lg font-bold text-red-600">
          {showValues ? `-NT$${monthlyExpense.toLocaleString()}` : '●●●●'}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">結餘</p>
        <p className={`text-lg font-bold ${monthlyNet >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
          {showValues ? `${monthlyNet >= 0 ? '+' : ''}NT$${monthlyNet.toLocaleString()}` : '●●●●'}
        </p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-xs text-gray-500 mb-1">儲蓄率</p>
      <div className="flex items-center gap-2">
        <div className="w-24 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              savingsRate >= 30 ? 'bg-green-500' :
              savingsRate >= 15 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
          />
        </div>
        <span className={`text-sm font-bold ${
          savingsRate >= 30 ? 'text-green-700' :
          savingsRate >= 15 ? 'text-yellow-700' : 'text-red-700'
        }`}>{savingsRate}%</span>
      </div>
    </div>
  </div>
</div>
```

確認 `showValues` 從 AppContext 解構。

- [ ] **Step 4: 手動確認摘要卡**

```
1. 開啟 /cashflow
2. 確認摘要卡顯示正確收入/支出/結餘
3. 切換月份，確認數字更新
4. 開啟「隱藏金額」，確認顯示 ●●●●
```

- [ ] **Step 5: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): add monthly summary card with savings rate"
```

---

### Task 2：篩選 Bar

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: 新增篩選 state**

在 Cashflow page component 頂部新增：

```tsx
const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
const [filterCategory, setFilterCategory] = useState<string>('all')
const [filterKeyword, setFilterKeyword] = useState<string>('')
const [debouncedKeyword, setDebouncedKeyword] = useState<string>('')
```

- [ ] **Step 2: 實作 keyword debounce**

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedKeyword(filterKeyword)
  }, 200)
  return () => clearTimeout(timer)
}, [filterKeyword])
```

- [ ] **Step 3: 篩選邏輯**

在計算 `monthlyIncome`/`monthlyExpense` 之前，先算 filteredItems：

```tsx
const filteredItems = cashFlowItems.filter(item => {
  const typeMatch = filterType === 'all' || item.type === filterType
  const categoryMatch = filterCategory === 'all' || item.category === filterCategory
  const keywordMatch = debouncedKeyword === '' ||
    item.name.toLowerCase().includes(debouncedKeyword.toLowerCase())
  return typeMatch && categoryMatch && keywordMatch
})

// 月份摘要仍用全部 cashFlowItems（不受篩選影響）
// 但列表顯示改用 filteredItems
```

- [ ] **Step 4: 取得動態類別列表**

```tsx
// 從現有 cashFlowItems 取出所有類別（去重）
const allCategories = Array.from(
  new Set(cashFlowItems.map(i => i.category).filter(Boolean))
)
```

- [ ] **Step 5: 在月份摘要卡下方加入篩選 Bar**

```tsx
{/* 篩選 Bar */}
<div className="flex flex-wrap gap-2 items-center">
  {/* 類型篩選 */}
  <select
    value={filterType}
    onChange={e => setFilterType(e.target.value as 'all' | 'income' | 'expense')}
    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
  >
    <option value="all">全部類型</option>
    <option value="income">收入</option>
    <option value="expense">支出</option>
  </select>

  {/* 類別篩選 */}
  <select
    value={filterCategory}
    onChange={e => setFilterCategory(e.target.value)}
    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
  >
    <option value="all">全部類別</option>
    {allCategories.map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>

  {/* 關鍵字搜尋 */}
  <div className="relative flex-1 min-w-32">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
    <input
      type="text"
      placeholder="搜尋項目名稱..."
      value={filterKeyword}
      onChange={e => setFilterKeyword(e.target.value)}
      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
    />
  </div>

  {/* 清除按鈕 */}
  {(filterType !== 'all' || filterCategory !== 'all' || filterKeyword !== '') && (
    <button
      onClick={() => {
        setFilterType('all')
        setFilterCategory('all')
        setFilterKeyword('')
      }}
      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
    >
      <X className="w-3.5 h-3.5" />
      清除
    </button>
  )}
</div>

{/* 篩選結果計數 */}
{(filterType !== 'all' || filterCategory !== 'all' || debouncedKeyword !== '') && (
  <p className="text-xs text-gray-500">
    找到 {filteredItems.length} 項
    {filteredItems.length === 0 && '，請嘗試其他條件'}
  </p>
)}
```

確認 `Search`, `X` 已 import from `lucide-react`。

- [ ] **Step 6: 將 cashFlowItems 列表渲染改為 filteredItems**

找到收入/支出項目的 `.map()` 渲染：

```tsx
// 修改前：cashFlowItems.filter(i => i.type === 'income').map(...)
// 修改後：filteredItems.filter(i => i.type === 'income').map(...)

{filteredItems.filter(i => i.type === 'income').map(item => (
  <div key={item.id}>...</div>
))}

{filteredItems.filter(i => i.type === 'expense').map(item => (
  <div key={item.id}>...</div>
))}
```

- [ ] **Step 7: 空狀態**

若 `filteredItems.length === 0`：

```tsx
{filteredItems.length === 0 && (filterType !== 'all' || filterCategory !== 'all' || debouncedKeyword !== '') && (
  <div className="py-12 text-center text-gray-400">
    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
    <p className="text-sm">沒有符合「{debouncedKeyword || filterCategory}」的項目</p>
  </div>
)}
```

- [ ] **Step 8: 手動測試篩選功能**

```
1. 開啟 /cashflow（月度現金流 tab）
2. 選擇「支出」類型 → 只顯示支出項目
3. 選擇一個類別 → 進一步篩選
4. 輸入關鍵字 → 即時過濾（200ms debounce）
5. 點「清除」→ 回到全部顯示
6. 篩選後顯示「找到 X 項」
```

- [ ] **Step 9: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): add filter bar with type, category, and keyword search"
```

---

### Task 3：類別管理可發現性

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: 找到現有類別管理按鈕**

```bash
grep -n "類別\|category\|manage\|Manager" src/app/cashflow/page.tsx | head -20
```

確認：現有觸發類別管理的按鈕位置、Modal 開關的 state 名稱。

- [ ] **Step 2: 移動類別管理按鈕至 Tab Bar 右側**

找到 Tab 按鈕列的 wrapper，修改為：

```tsx
<div className="flex items-center gap-2">
  {/* Tab 按鈕 */}
  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-1">
    <button onClick={() => setActiveTab('flow')} className={`...`}>月度現金流</button>
    <button onClick={() => setActiveTab('category')} className={`...`}>分類分析</button>
    <button onClick={() => setActiveTab('annual')} className={`...`}>年度總覽</button>
  </div>

  {/* 類別管理按鈕（新位置） */}
  <button
    onClick={() => setShowCategoryManager(true)}
    className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors bg-white"
  >
    <Settings2 className="w-4 h-4" />
    <span className="hidden sm:inline">管理類別</span>
  </button>
</div>
```

確認 `Settings2` 或 `Settings` 已 import from `lucide-react`。

- [ ] **Step 3: 手動確認**

```
1. 開啟 /cashflow
2. 確認 Tab Bar 右側有「管理類別」按鈕
3. 點擊按鈕，類別管理 Modal 正常開啟
4. 在手機（390px）：按鈕只顯示圖示，不顯示文字
```

- [ ] **Step 4: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "feat(cashflow): move category manager button to visible tab bar position"
```

---

### Task 4：Budget 超出 100% 修復

**Files:**
- Modify: `src/app/cashflow/page.tsx`

- [ ] **Step 1: 找到 Budget 進度條渲染**

```bash
grep -n "budget\|Budget\|progress" src/app/cashflow/page.tsx | head -20
```

找到進度條 `width` 計算和顏色邏輯。

- [ ] **Step 2: 修復超出 100% 顯示**

找到進度條 style：

```tsx
{/* 修改前（width 可能超過 100%） */}
style={{ width: `${(item.amount / item.budget) * 100}%` }}

{/* 修改後 */}
{(() => {
  const used = item.amount || 0
  const budget = item.budget || 0
  const percent = budget > 0 ? Math.round((used / budget) * 100) : 0
  const overAmount = used - budget

  return (
    <div>
      {/* 進度條 */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percent >= 100 ? 'bg-red-500' :
            percent >= 80 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      {/* 數字 */}
      <div className="flex justify-between text-xs mt-0.5">
        <span className="text-gray-500">{percent}% 已用</span>
        {overAmount > 0 ? (
          <span className="text-red-600 font-medium">⚠ 超出 NT${overAmount.toLocaleString()}</span>
        ) : (
          <span className="text-gray-400">剩 NT${(budget - used).toLocaleString()}</span>
        )}
      </div>
    </div>
  )
})()}
```

- [ ] **Step 3: 確認超出情況正確顯示**

```
1. 在 /cashflow 找到有設定 budget 的支出類別
2. 暫時輸入一個超過 budget 的金額
3. 確認進度條停在 100%（不溢出）
4. 確認顯示「⚠ 超出 NT$X」
```

- [ ] **Step 4: Commit**

```bash
git add src/app/cashflow/page.tsx
git commit -m "fix(cashflow): cap budget progress bar at 100%, show overflow amount"
```

---

### Task 5：Annual Tab 格子可發現性（合併後適用）

此 task 依賴 nav-restructure plan 的 Annual 合併完成。

**Files:**
- Modify: `src/components/AnnualTracker.tsx`（或 annual 邏輯所在位置）

- [ ] **Step 1: 找到 Annual 表格格子的 onClick**

```bash
grep -n "onClick\|cell\|td\|格子" src/components/AnnualTracker.tsx 2>/dev/null || \
grep -n "onClick\|cell\|td" src/app/annual/page.tsx
```

找到可點擊格子的 element。

- [ ] **Step 2: 加入 hover 視覺提示**

```tsx
{/* 修改前：無視覺提示的 td */}
<td onClick={() => openModal(month, category)} className="...">
  {hasItems ? `NT$${total}` : ''}
</td>

{/* 修改後：加 hover 樣式和 + 提示 */}
<td
  onClick={() => openModal(month, category)}
  className="... group cursor-pointer hover:bg-blue-50 transition-colors relative"
>
  {hasItems ? (
    <span className="text-gray-800">{showValues ? `NT$${total.toLocaleString()}` : '●●●'}</span>
  ) : (
    <span className="text-gray-300 group-hover:text-blue-400 transition-colors">+</span>
  )}
  {/* 有資料時的小圓點 */}
  {hasItems && (
    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />
  )}
</td>
```

- [ ] **Step 3: 加入表格說明 tooltip**

在表格 header 或表格上方加入說明：

```tsx
<p className="text-xs text-gray-400 mb-2">
  💡 點擊格子可新增當月一次性收支項目
</p>
```

- [ ] **Step 4: 手動確認**

```
1. 開啟 /cashflow → 年度總覽 tab
2. Hover 空格子 → 顯示藍色 + 號
3. Hover 有資料的格子 → 背景變藍
4. 有資料的格子右上角有小圓點
5. 點擊格子 → Modal 正常開啟
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AnnualTracker.tsx
git commit -m "feat(cashflow): add hover visual cues for annual table clickable cells"
```

---

### Task 6：最終驗證

- [ ] **Step 1: TypeScript 檢查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | grep -E "error|✓" | head -10
```

- [ ] **Step 3: 手動驗收 checklist**

```
□ 月份摘要卡：收入/支出/結餘/儲蓄率正確
□ 切換月份：摘要數字更新
□ 類型篩選：選「支出」只顯示支出項目
□ 類別篩選：動態顯示現有類別
□ 關鍵字搜尋：200ms debounce，即時過濾
□ 清除按鈕：重置所有篩選
□ 無結果：顯示空狀態
□ 「管理類別」按鈕在 Tab Bar 右側明顯可見
□ Budget 超出 100%：進度條停在 100%，顯示超出金額
□ Annual 格子 hover 有視覺提示
```

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "feat(cashflow): complete enhancements - summary, filter, discoverability, budget fix"
```

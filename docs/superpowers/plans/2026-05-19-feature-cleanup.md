# Feature Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 FIRE 頁的 `window.prompt()` Life Events、Dashboard 的 `NetWorthMilestones`，將 Stocks 質押欄位設為預設隱藏，統一一次性現金流資料來源。

**Architecture:** 各項清理互相獨立，可依任意順序執行。每項清理先確認功能位置，再精準刪除，不影響相鄰功能。

**Tech Stack:** Next.js 15 App Router, TypeScript, React, AppContext (localStorage)

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/app/fire/page.tsx` | 移除 Life Events 區塊和 prompt() handler |
| Modify | `src/app/page.tsx` | 移除 `<NetWorthMilestones />` |
| Modify | `src/app/stocks/page.tsx` | 質押欄位預設隱藏 |
| Modify | `src/app/settings/page.tsx` | 新增「啟用質押追蹤」開關 |
| Modify | `src/context/AppContext.tsx` | 新增 `enablePledgeTracking` 設定（若需要） |

---

### Task 1：移除 FIRE Life Events 功能

**Files:**
- Modify: `src/app/fire/page.tsx`

- [ ] **Step 1: 找出 Life Events 所有相關 code**

```bash
grep -n "lifeEvent\|LifeEvent\|life_event\|prompt\|window.prompt" src/app/fire/page.tsx
```

記錄：state 宣告行號、handler function 行號、render 區塊行號。

- [ ] **Step 2: 確認 Life Events 是否存在 AppContext**

```bash
grep -n "lifeEvent\|LifeEvent" src/context/AppContext.tsx
```

若存在，記錄欄位名稱（後續 Task 決定是否清除）。

- [ ] **Step 3: 移除 Life Events UI 區塊**

在 `src/app/fire/page.tsx` 找到並刪除 Life Events 的 render 部分。通常是：

```tsx
{/* 刪除這整個區塊 */}
<div className="...">  {/* Life Events section */}
  <h3>生涯事件</h3>
  ...
  <button onClick={addLifeEvent}>新增事件</button>
  ...
</div>
```

- [ ] **Step 4: 移除 Life Events state 和 handlers**

刪除以下 code（依實際行號調整）：

```tsx
// 刪除 state
const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([])

// 刪除 handler
const addLifeEvent = () => {
  const name = window.prompt('事件名稱')
  // ...
}

// 刪除 type（若在同檔案）
type LifeEvent = { ... }
```

- [ ] **Step 5: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit 2>&1 | grep "fire"
```

Expected: 無 fire 相關錯誤。

- [ ] **Step 6: 手動確認 FIRE 頁正常**

```
1. 開啟 /fire
2. 確認頁面載入，無 console error
3. 確認 FIRE 計算、圖表、Monte Carlo 正常運作
4. 確認頁面無 Life Events 相關 UI
```

- [ ] **Step 7: Commit**

```bash
git add src/app/fire/page.tsx
git commit -m "feat(fire): remove incomplete life events feature (used window.prompt)"
```

---

### Task 2：移除 Dashboard 的 NetWorthMilestones

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 確認 NetWorthMilestones 使用位置**

```bash
grep -n "NetWorthMilestones" src/app/page.tsx
grep -n "NetWorthMilestones" src/app/fire/page.tsx
```

確認：Dashboard（page.tsx）有用、FIRE 頁是否也有用。

- [ ] **Step 2: 從 Dashboard 移除 NetWorthMilestones**

在 `src/app/page.tsx` 找到：

```tsx
import NetWorthMilestones from '@/components/NetWorthMilestones'
```

和：

```tsx
<NetWorthMilestones ... />
```

刪除 import 行和 JSX 使用。

注意：**不刪除** `src/components/NetWorthMilestones.tsx` 檔案本身，因為 FIRE 頁可能仍使用。

- [ ] **Step 3: 確認 FIRE 頁是否仍使用**

```bash
grep -rn "NetWorthMilestones" src/ --include="*.tsx"
```

若只剩 `NetWorthMilestones.tsx` 本身，表示沒有其他地方用，可選擇保留（不刪）或刪除 component 檔（若確定不用）。

- [ ] **Step 4: 確認 Dashboard 版面正常**

```bash
npm run dev
```

開啟 `http://localhost:3000`，確認：
- 沒有 NetWorthMilestones 區塊
- 頁面其他區塊正常顯示
- 無 console error

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): remove NetWorthMilestones (duplicated in FIRE page)"
```

---

### Task 3：質押追蹤預設隱藏

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/stocks/page.tsx`（或相關 stocks component）

- [ ] **Step 1: 確認 AppContext Settings 型別**

```bash
grep -n "Settings\|settings\|UserSettings\|AppSettings" src/context/AppContext.tsx | head -20
```

找到 settings 相關的 type 定義和 state。

- [ ] **Step 2: 在 Settings 型別新增 enablePledgeTracking**

在 `AppContext.tsx` 找到 settings type，新增欄位：

```typescript
// 找到類似這樣的 type
type AppSettings = {
  // ...現有欄位
  enablePledgeTracking: boolean  // 新增這行
}
```

若無獨立 Settings type，找到 `useStickyState` 的初始值，確保包含：

```typescript
const [settings, setSettings] = useStickyState({
  // ...現有設定
  enablePledgeTracking: false,  // 預設 false
}, 'app-settings')
```

- [ ] **Step 3: 在 Settings 頁新增開關**

在 `src/app/settings/page.tsx` 找到合適位置（建議在「進階設定」或「顯示設定」區塊），新增：

```tsx
<div className="flex items-center justify-between py-3 border-b border-gray-100">
  <div>
    <p className="font-medium text-gray-800">質押追蹤</p>
    <p className="text-sm text-gray-500">在股票頁面顯示質押欄位與警示（台股融資功能）</p>
  </div>
  <button
    onClick={() => updateSettings({ enablePledgeTracking: !settings.enablePledgeTracking })}
    className={`relative w-12 h-6 rounded-full transition-colors ${
      settings.enablePledgeTracking ? 'bg-blue-500' : 'bg-gray-200'
    }`}
  >
    <span
      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        settings.enablePledgeTracking ? 'translate-x-7' : 'translate-x-1'
      }`}
    />
  </button>
</div>
```

確認 `settings.enablePledgeTracking` 和 `updateSettings` 從 AppContext 正確解構。

- [ ] **Step 4: Stocks 頁依設定隱藏質押欄位**

在 `src/app/stocks/page.tsx`（或 stocks 相關 component），找到質押欄位的顯示邏輯：

```tsx
// 找到質押相關的 input/column
// 加上條件渲染

// 在表格 header
{settings.enablePledgeTracking && <th>質押</th>}

// 在表格 row
{settings.enablePledgeTracking && <td>{stock.collateral ? '是' : '否'}</td>}

// 在 add/edit form
{settings.enablePledgeTracking && (
  <div>
    <label>質押設定</label>
    <input ... />
  </div>
)}
```

- [ ] **Step 5: PledgeAlertBanner 依設定隱藏**

```bash
grep -n "PledgeAlertBanner" src/app/page.tsx src/app/stocks/page.tsx
```

找到 PledgeAlertBanner 使用位置，加條件：

```tsx
{settings.enablePledgeTracking && <PledgeAlertBanner ... />}
```

- [ ] **Step 6: 測試開關功能**

```
1. 開啟 /settings
2. 確認「質押追蹤」開關預設為關閉
3. 開啟 /stocks，確認無質押欄位
4. 回 /settings 開啟質押追蹤
5. 回 /stocks，確認質押欄位出現
6. 確認 PledgeAlertBanner 跟隨設定顯示/隱藏
```

- [ ] **Step 7: Commit**

```bash
git add src/context/AppContext.tsx src/app/settings/page.tsx src/app/stocks/page.tsx
git commit -m "feat(stocks): make collateral/pledge tracking opt-in via settings (default off)"
```

---

### Task 4：統一一次性現金流資料來源

**Files:**
- Modify: `src/context/AppContext.tsx`（確認 state 統一）
- Modify: `src/app/cashflow/page.tsx`（若有重複 state）

- [ ] **Step 1: 盤點所有一次性項目的 state**

```bash
grep -n "annualItem\|oneTimeItem\|oneTime\|one_time" src/context/AppContext.tsx
grep -n "annualItem\|oneTimeItem\|oneTime\|one_time" src/app/cashflow/page.tsx
grep -n "annualItem\|oneTimeItem\|oneTime\|one_time" src/app/annual/page.tsx 2>/dev/null || echo "annual page deleted"
```

確認有幾個不同的 state 存儲一次性項目。

- [ ] **Step 2: 確認 Cashflow 的 one-time 區塊存取哪個 state**

在 cashflow 頁找到「一次性項目」的 section，確認它用的是 `annualItems`（AppContext）還是 local state。

- [ ] **Step 3: 若有重複，統一到 AppContext 的 `annualItems`**

若 cashflow 頁有獨立的 local state 存一次性項目：

```typescript
// 刪除 local state
// const [oneTimeItems, setOneTimeItems] = useState(...)

// 改從 AppContext 使用
const { annualItems, addAnnualItem, removeAnnualItem } = useAppContext()
```

更新所有使用 local state 的地方改用 AppContext 版本。

- [ ] **Step 4: 確認資料不會重複計算**

在 Cashflow 月份摘要計算中，確認不會同時加計 `cashFlowItems` 和 `annualItems` 的同一筆資料：

```bash
grep -n "reduce\|sum\|total" src/app/cashflow/page.tsx | head -20
```

確認計算邏輯只用一個來源。

- [ ] **Step 5: TypeScript 和功能確認**

```bash
npx tsc --noEmit 2>&1 | grep -E "error|Error" | head -10
npm run dev
```

在 `/cashflow` 測試：新增一次性項目，確認年度總覽 tab 也顯示同一筆資料。

- [ ] **Step 6: Commit**

```bash
git add src/context/AppContext.tsx src/app/cashflow/page.tsx
git commit -m "refactor(cashflow): unify one-time items to single AppContext state"
```

---

### Task 5：最終驗證

- [ ] **Step 1: TypeScript 完整檢查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 無 error。

- [ ] **Step 2: Build 確認**

```bash
npm run build 2>&1 | grep -E "error|Error|✓" | head -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: 手動驗收 checklist**

```
□ /fire 無 Life Events UI 和 window.prompt() 呼叫
□ Dashboard 無 NetWorthMilestones 區塊
□ /stocks 預設不顯示質押欄位
□ /settings 有「質押追蹤」開關，預設關閉
□ 開啟質押追蹤後 /stocks 出現質押欄位
□ PledgeAlertBanner 跟隨設定顯示
□ Cashflow 一次性項目存入 AppContext（Annual tab 可看到）
```

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "chore: complete feature cleanup - remove half-finished UIs"
```

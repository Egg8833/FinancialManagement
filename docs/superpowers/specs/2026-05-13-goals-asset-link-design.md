# 財務目標自動連結資產 — Design Spec

Date: 2026-05-13  
Status: Approved

## Overview

讓用戶在財務目標中選擇連結特定 asset items，`currentAmount` 自動加總連結 items 的金額，無需手動更新進度。現有手動輸入模式保留（無連結時）。

## Data Model

### `FinancialGoal` 型別（src/context/AppContext.tsx）

新增一個 optional 欄位：

```ts
linkedAssetItemIds?: string[]  // 連結的 AssetItem id 清單；undefined 或空陣列 = 手動模式
```

`currentAmount` 欄位保留，僅在無連結（手動模式）時使用。

### Derived Logic

不在 state 中儲存 derived 的 currentAmount。渲染時即時計算：

```ts
function resolveCurrentAmount(goal: FinancialGoal, assets: AssetCategory[]): number {
  if (!goal.linkedAssetItemIds?.length) return goal.currentAmount;
  const allItems = assets.flatMap(cat => cat.items);
  return goal.linkedAssetItemIds.reduce((sum, id) => {
    const item = allItems.find(i => i.id === id);
    return sum + (item?.amount ?? 0);
  }, 0);
}
```

孤兒 id（asset item 已被刪除）靜默 skip（`item?.amount ?? 0`），無需清理邏輯。

### 排他性規則

每個 AssetItem 只能被一個目標連結。UI 層強制：選擇清單中已被其他目標佔用的 item 顯示為 disabled。

```ts
function getLinkedItemIds(goals: FinancialGoal[], excludeGoalId?: string): Set<string> {
  return new Set(
    goals
      .filter(g => g.id !== excludeGoalId)
      .flatMap(g => g.linkedAssetItemIds ?? [])
  );
}
```

## UI 結構

### GoalCard — 卡片視圖（非編輯）

進度條下方新增連結 item chip 列（僅 `linkedAssetItemIds?.length > 0` 時顯示）：

- 每個 chip：`{item.name}  ${item.amount.toLocaleString()}`
- 最多顯示 3 個 chip，超過顯示 `+N 個`
- `showValues` 遮罩邏輯不變（金額顯示受 `showValues` 控制）

### GoalCard — 編輯表單

在「目標日期」欄位後新增「連結資產」區塊：

- 標題：`連結資產（選填）`
- 依 `AssetCategory` 分組，category `title` 當 section header
- 每個 AssetItem 顯示 checkbox + 名稱 + 金額
- 已被其他目標佔用的 item：`disabled`，右側標示 `已連結：{目標名稱}`，文字灰色
- 有勾選時：「目前已存」輸入欄隱藏，改顯示唯讀加總文字
- 無勾選時：顯示「目前已存」數字輸入欄（現有行為）

### 新增目標表單（isAdding）

同樣加入「連結資產」區塊，邏輯相同。

## 改動範圍

| 檔案 | 改動 |
|------|------|
| `src/context/AppContext.tsx` | `FinancialGoal` 加 `linkedAssetItemIds?: string[]` |
| `src/components/FinancialGoals.tsx` | GoalCard 編輯表單 + 新增表單加連結資產區塊；卡片 chip 顯示；使用 `goalUtils` helper |
| `src/lib/goalUtils.ts`（新增） | `resolveCurrentAmount`、`getLinkedItemIds` 純函數 |
| `src/lib/goalUtils.test.ts`（新增） | Vitest 測試覆蓋所有 helper |

不改動：DataManager（`linkedAssetItemIds` 自動隨 `goals` 備份/還原）、其他頁面。

## 測試範圍

### `resolveCurrentAmount`

- 無連結（`linkedAssetItemIds` undefined）→ 回傳 `goal.currentAmount`
- 空陣列 → 回傳 `goal.currentAmount`
- 有連結 → 正確加總 items 金額
- 孤兒 id（item 已不存在）→ 靜默 skip，不影響其他 items 加總

### `getLinkedItemIds`

- 單一目標有連結 → 回傳正確 Set
- 排除當前目標自己（`excludeGoalId`）
- 多目標連結 → 聚合所有 id
- 無連結的目標 → 不貢獻任何 id

## 不在範圍

- 連結 asset category（整個類別）：只支援 item 級別連結
- 部分金額連結（只取 item 金額的一部分）：不支援
- 自動解除連結（asset item 刪除時）：靜默 skip 即可，不需清理

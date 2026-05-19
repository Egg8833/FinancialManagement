# Cashflow 類別分析升級 — Design Spec

Date: 2026-05-13  
Status: Approved

## Overview

在現有 cashflow 頁新增「自訂類別」標籤系統與「類別分析」tab，讓用戶看到當月各類別消費佔比與近 12 個月堆疊趨勢。現有 needs/wants/savings（50-30-20）邏輯不動。

## Data Model

### `CashFlowItem` 型別（src/context/AppContext.tsx）

新增一個 optional 欄位：

```ts
customCategory?: string   // 用戶自訂類別，如 '餐飲'、'交通'；undefined = 不分類
```

### AppContext 新增狀態

```ts
customCategories: string[]          // 自訂類別清單，useStickyState 存 localStorage
setCustomCategories: Dispatch<SetStateAction<string[]>>
```

預設值：`['餐飲', '交通', '房租', '娛樂', '醫療', '購物', '其他']`

**刪除類別行為：** 呼叫 `setCustomCategories` 移除後，同步將 `expenseItems` 中持有該 category 的項目的 `customCategory` 設為 `undefined`。不刪除 item 本身。

## UI 結構

### cashflow/page.tsx — 3-tab bar

| Tab | 內容 |
|-----|------|
| `收支管理` | 現有收入/支出清單；新增/編輯表單加 customCategory 欄位 |
| `50-30-20` | 現有標籤分析 + 12 月趨勢柱狀圖（程式碼原封不動） |
| `類別分析` | 新 tab（見下） |

### 新增/編輯 Expense Item 表單

在現有欄位後新增：

- Label：`類別`
- 元件：`<select>` 顯示 `customCategories` 清單
- 末尾選項：`＋ 新增類別` → 點擊後顯示 inline `<input>` + 確認鈕
- 空白選項（預設）= 不分類

### 類別分析 Tab

#### 類別管理列（tab 頂部）

- 現有類別以 chip 呈現，各有 `×` 刪除鈕
- 右側：text input + `＋` 按鈕新增類別
- 重複名稱忽略

#### 甜甜圈圖（當月佔比）

- 資料：`expenseItems` 依 `customCategory` group，加總金額
- 無 customCategory 項目 → 歸入「未分類」bucket
- 元件：Recharts `PieChart` with `innerRadius`（donut 樣式）
- Tooltip 顯示：類別名稱、金額、百分比

#### 月趨勢堆疊柱狀圖（近 12 個月）

- 資料來源：`expenseItems` 各項目的固定月費 × 12 個月（方案 A，不需歷史記錄）
- X 軸：近 12 個月（YYYY/MM 格式）
- Y 軸：金額（元）
- 每條柱按 `customCategory` 堆疊（stacked bar）
- 無類別項目堆疊為「未分類」層
- 元件：Recharts `BarChart` with `stackId="a"`

## 顏色系統

使用固定色盤，依 `customCategories` index 循環分配：

```ts
const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#94a3b8',
]
```

「未分類」固定使用 `#d1d5db`。

## 改動範圍

| 檔案 | 改動 |
|------|------|
| `src/context/AppContext.tsx` | 新增 `customCategories` state；`CashFlowItem` 加 `customCategory` 欄位 |
| `src/app/cashflow/page.tsx` | 加 3-tab bar；expense form 加 category 欄位；新增類別分析 tab |

不新增檔案。不改動其他頁面。

## 不在範圍

- 收入項目不需要 customCategory
- 支援類別重新命名：chip 上雙擊 / 點鉛筆圖示進入 inline edit；儲存後同步更新所有持有該舊名稱的 `expenseItems.customCategory`
- 不需要類別排序

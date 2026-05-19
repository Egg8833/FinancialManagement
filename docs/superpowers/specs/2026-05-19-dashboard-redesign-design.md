# Dashboard Command Center Redesign

**Date:** 2026-05-19  
**Status:** Approved  
**Goal:** 將 Dashboard 從靜態資產快照轉型為行動導向指揮中心，讓使用者一眼掌握財務狀況並知道下一步。

---

## Problem Statement

現有 Dashboard 展示資產、負債、圖表，但：
1. 沒有告訴使用者「現在要做什麼」
2. 現金流狀況需要跳到 Cashflow 頁才能看到
3. FIRE 進度完全不在首頁
4. `NetWorthMilestones` 重複 FIRE 頁面的成就感，浪費空間
5. Snapshot 需要去 `/chart` 頁操作（即將被刪除，需移回 Dashboard）

---

## Target Layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER: 淨資產 NT$X  [拍快照]  [隱藏金額 👁]        │
├──────────────┬──────────────┬───────────────────────┤
│  健康分數    │  本月現金流  │  FIRE 進度             │
│  82 良好 ↑3  │ +$15K / -$8K │  84% 距目標 $240萬    │
│  [查看詳情]  │  [查看明細]  │  [查看計畫]            │
├──────────────┴──────────────┴───────────────────────┤
│  ALERTS（若有）                                      │
│  ⚠ 餐飲類別超出預算 120%  [調整預算]                  │
│  ⚠ 質押比例超過 30%       [查看股票]                  │
├─────────────────────────────────────────────────────┤
│  資產配置                    負債總覽                  │
│  [Donut Chart]              [Liability Cards]        │
├─────────────────────────────────────────────────────┤
│  財務目標進度                                         │
│  [Goal Cards — horizontal scroll]                   │
├─────────────────────────────────────────────────────┤
│  淨資產歷史                  快照管理（摺疊）           │
│  [Line Chart]                [▼ 管理快照]            │
└─────────────────────────────────────────────────────┘
```

---

## Component Changes

### 移除
- `NetWorthMilestones` — 刪除引用與 import（功能由 FIRE 頁承擔）

### 新增

**1. 三欄摘要 KPI 列（Summary Row）**

取代或補充現有 HeroKPI，新增：

| 卡片 | 顯示內容 | 數據來源 | CTA |
|------|---------|---------|-----|
| 健康分數 | 分數 + 等級 + 與上次差異 | `AppContext.healthScore` | → `/health` |
| 本月現金流 | 本月收入 - 支出 = 淨額 | cashflow items × current month | → `/cashflow` |
| FIRE 進度 | % 完成 + 距目標金額 | `netWorth / fireTarget` | → `/fire` |

健康分數差異（`+3` / `-2`）從 `assetSnapshots` 最後兩筆 `healthScore` 計算。

**2. 智慧警示列（Smart Alerts）**

現有 alerts 已有基礎邏輯，強化為：
- 每個 alert 有明確 CTA 按鈕，點擊直接跳到相關頁面
- Alert 類型：
  - `cashflow`: 預算超出類別（超過 100%）→ `/cashflow`
  - `stock`: 單股集中度 > 30% → `/stocks`  
  - `health`: 健康分數下降超過 5 分 → `/health`
  - `fire`: 本月儲蓄率低於 FIRE 計畫需求 → `/fire`
- 最多顯示 3 個 alert，多的可展開

**3. 快照管理（Snapshot Manager）**

從 `/chart` 移過來：
- Dashboard 底部新增摺疊區塊「快照紀錄」
- 顯示快照列表（日期、淨資產、健康分數）
- 每列有刪除按鈕（確認 Dialog）
- `takeSnapshot()` 按鈕移至 Dashboard header

---

## Calculation Logic

### 本月現金流
```typescript
const currentMonth = new Date().getMonth()
const currentYear = new Date().getFullYear()

const monthlyIncome = cashFlowItems
  .filter(i => i.type === 'income')
  .reduce((sum, i) => sum + i.amount, 0)

const monthlyExpense = cashFlowItems
  .filter(i => i.type === 'expense')
  .reduce((sum, i) => sum + i.amount, 0)

// + one-time items for current month
const oneTimeNet = annualItems
  .filter(i => i.year === currentYear && i.month === currentMonth)
  .reduce((sum, i) => sum + (i.type === 'income' ? i.amount : -i.amount), 0)
```

### FIRE 進度
```typescript
const fireProgress = Math.min(100, (netWorth / fireSettings.targetAmount) * 100)
const gapAmount = Math.max(0, fireSettings.targetAmount - netWorth)
```

### 健康分數差異
```typescript
const snapshots = assetSnapshots.filter(s => s.healthScore !== undefined)
const lastTwo = snapshots.slice(-2)
const scoreDiff = lastTwo.length >= 2 
  ? lastTwo[1].healthScore! - lastTwo[0].healthScore!
  : 0
```

---

## Data Dependencies

| 功能 | 需要 AppContext 中 |
|------|-----------------|
| 健康分數卡 | `healthScore`, `assetSnapshots[].healthScore` |
| 本月現金流卡 | `cashFlowItems`, `annualItems` |
| FIRE 進度卡 | `netWorth`, `fireSettings.targetAmount` |
| Budget alerts | `cashFlowItems[].budget`, `cashFlowItems[].amount` |
| 快照管理 | `assetSnapshots`, `takeSnapshot()` |

`fireSettings.targetAmount` 需確認 AppContext 有此欄位（FIRE 頁面設定的退休目標金額）。

---

## Visual Design Notes

- 三欄摘要卡：各有主色（健康=綠、現金流=藍、FIRE=橘）
- Alert 列：黃色背景（warning），紅色（danger）
- 快照管理預設摺疊（`<details>` 或 state toggle）

---

## Success Criteria

- [ ] Dashboard 有健康分數、本月現金流、FIRE 進度三個摘要卡
- [ ] 每個摘要卡有 CTA 連結至對應頁面
- [ ] Alert 有具體 CTA 按鈕
- [ ] `NetWorthMilestones` 不再出現
- [ ] 快照管理功能在 Dashboard 可操作（原 `/chart` 功能）
- [ ] `takeSnapshot()` 按鈕在 Dashboard header 可見

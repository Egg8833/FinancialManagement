# Cashflow Enhancements Design

**Date:** 2026-05-19  
**Status:** Approved  
**Goal:** 強化 Cashflow 頁的搜尋/篩選能力與功能可發現性，解決「找不到特定費用」和「不知道有哪些功能」兩個核心問題。

---

## Problem Statement

Cashflow 是使用者最高頻操作的頁面，但：
1. **無搜尋**：找「上個月餐費多少」需要手動翻頁數算
2. **無篩選**：無法按類別、類型快速過濾項目
3. **功能隱藏**：類別管理入口藏在小按鈕，多數使用者找不到
4. **可發現性差**：「點擊格子可新增項目」沒有視覺提示

---

## Feature 1：篩選 Bar

### 位置
月份導航下方，Tab 上方。

### 篩選選項

```
[類型: 全部 ▼]  [類別: 全部 ▼]  [關鍵字搜尋___________]  [清除]
```

**類型下拉：**
- 全部
- 收入
- 支出

**類別下拉（動態）：**
- 全部
- 根據 AppContext `expenseCategories` 動態生成
- 收入類別也包含

**關鍵字搜尋：**
- 即時過濾（不需按 Enter）
- 對比項目 `name` 欄位
- debounce 200ms

### 過濾邏輯
```typescript
const filteredItems = cashFlowItems.filter(item => {
  const typeMatch = filterType === 'all' || item.type === filterType
  const categoryMatch = filterCategory === 'all' || item.category === filterCategory
  const keywordMatch = keyword === '' || item.name.includes(keyword)
  return typeMatch && categoryMatch && keywordMatch
})
```

### 結果顯示
- 過濾後：顯示「找到 X 項」
- 無結果：顯示空狀態（「沒有符合條件的項目」）
- 篩選 bar 有內容時：「清除」按鈕出現，重置所有篩選

### UI Notes
- 篩選 bar 在手機上折疊為「篩選」按鈕，點擊展開
- 篩選狀態持久在同一 session（切換 tab 後回來保留）

---

## Feature 2：類別管理可發現性

### 現狀
類別管理按鈕存在但不明顯。

### 修改

**Tab 區域調整：**
```
月度現金流  |  分類分析  |  年度總覽          [⚙ 管理類別]
```
- 「管理類別」按鈕移至 Tab 列右側，帶齒輪圖示
- 樣式：`outline` 按鈕（不搶主要 CTA）

**類別管理 Modal（強化）：**
- 開啟全螢幕（手機）或 450px 寬 Modal（桌機）
- 顯示現有類別列表（名稱 + 顏色圓點）
- 每列：[名稱輸入] [顏色選擇] [刪除按鈕]
- 底部：[+ 新增類別] 按鈕
- 顏色選擇：6 個預設顏色色塊（不用 color picker）

---

## Feature 3：Annual Tab 的可發現性（合併後）

Annual 表格格子「點擊可新增一次性項目」現無視覺提示。

### 修改
- 每個可點擊格子：hover 時顯示 `+` 圖示 + 背景色微變
- 格子右下角小角標：若有一次性項目，顯示 `●` 點（有資料指示）
- Table header 加 tooltip：「點擊格子可新增當月一次性收支」

---

## Feature 4：Budget 進度視覺強化

### 現狀
進度條顏色已有（綠/橙/紅），但超過 100% 時進度條溢出。

### 修改
- 超過 100%：進度條固定為 100%，右側顯示「⚠ +NT$X」（超出金額）
- 進度條加 transition animation（載入時從 0 到實際值）
- 手機版本：進度條高度從 4px 降至 3px，節省空間

---

## Feature 5：月份摘要卡

### 新功能：Tab 上方加月份摘要

```
┌───────────────────────────────────────────────┐
│  2025年5月  ←  →                               │
│  收入 NT$85,000  支出 NT$42,000  結餘 NT$43,000 │
│  儲蓄率 50.6%  ████████████░░░░░░░░  良好       │
└───────────────────────────────────────────────┘
```

- 每月切換時自動更新
- 儲蓄率 = 結餘 / 收入，顏色：≥30% 綠、≥15% 橙、<15% 紅
- 不需要點擊任何東西就能看到當月全貌

---

## Data Model Notes

不需要修改 AppContext 型別。所有計算基於現有 `cashFlowItems`：

```typescript
// 月份摘要計算
const monthIncome = cashFlowItems
  .filter(i => i.type === 'income')
  .reduce((sum, i) => sum + i.amount, 0)
  
const monthExpense = cashFlowItems
  .filter(i => i.type === 'expense')  
  .reduce((sum, i) => sum + i.amount, 0)

const savingsRate = monthIncome > 0 ? (monthIncome - monthExpense) / monthIncome : 0
```

---

## Implementation Priority

1. **月份摘要卡** — 最高視覺衝擊，最少代碼
2. **篩選 Bar** — 高頻需求，中等實作量
3. **類別管理可發現性** — UI 調整，低風險
4. **Annual 可發現性** — 視覺細節，最低優先

---

## Success Criteria

- [ ] 月份摘要卡顯示收入、支出、結餘、儲蓄率
- [ ] 可按類型（收入/支出）篩選項目
- [ ] 可按類別篩選項目
- [ ] 關鍵字搜尋即時過濾（debounce）
- [ ] 「管理類別」按鈕在 Tab 區域明顯可見
- [ ] Annual 表格可點擊格子有 hover 視覺提示
- [ ] Budget 超出 100% 正確顯示超出金額

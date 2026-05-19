# Feature Cleanup & Simplification Design

**Date:** 2026-05-19  
**Status:** Approved  
**Goal:** 移除半成品功能、假精確度 UI、以及重複功能，讓產品顯示完整性而非功能量。

---

## Items to Remove / Fix

### 1. FIRE：移除 Life Events 的 `window.prompt()`

**問題：** `window.prompt()` 是瀏覽器原生對話框，在 Next.js 應用中：
- 外觀無法客製化（不符合 UI 風格）
- 在某些瀏覽器被封鎖
- 給使用者感覺像 bug 或舊版網站

**決策：** 移除整個 Life Events 功能（v1 不做）。

**原因：** FIRE 頁面已有：
- 情境模擬（悲觀/中性/樂觀）
- What-if 額外儲蓄滑桿
- Monte Carlo 模擬
- SWR 敏感度分析

Life Events 的「大額一次性事件」在功能上重疊且未完成，移除比做到一半更好。

**修改：**
- `src/app/fire/page.tsx` — 移除 Life Events 區塊的 render
- 移除 `life_events` 相關 state（若在 AppContext）
- 移除觸發 `prompt()` 的 handler function
- 若 UI 有「Life Events」按鈕，移除該按鈕

### 2. Dashboard：移除 `NetWorthMilestones`

**問題：** 里程碑徽章（10% / 25% / 50% / 100%）：
- FIRE 頁面已有相同的 milestone 顯示
- Dashboard 空間應用於行動導向資訊（現金流、FIRE 進度）
- 對新使用者（淨資產 < 0）顯示「0% 完成」無激勵效果

**修改：**
- `src/app/page.tsx` — 移除 `<NetWorthMilestones />` 引用
- 不刪除 `src/components/NetWorthMilestones.tsx` 檔案（FIRE 頁可能仍使用）
- 確認 FIRE 頁是否引用此組件，若有保留其在 FIRE 頁的使用

### 3. Stocks：移除 Collateral（質押追蹤）欄位

**問題：**
- UI 有「質押設定」輸入欄位，但僅記錄 boolean/數量，無真實計算
- 非台股使用者完全不了解此功能用途
- `PledgeAlertBanner` 警示邏輯依賴此欄位，但警示條件不透明

**決策：** 移至進階設定，預設隱藏。

**修改方案（保守做法，不直接刪除）：**
- `src/app/stocks/page.tsx` — 新增欄位隱藏/顯示 toggle
- 在 Settings 頁加入「進階功能 → 啟用質押追蹤」開關，預設 `false`
- `PledgeAlertBanner` 在設定關閉時不顯示
- AppContext 保留 `collateral` 欄位（不破壞現有資料）

若開關關閉（預設）：stocks 表格不顯示質押欄，add/edit form 不顯示質押輸入。

### 4. Cashflow：合併「一次性項目」邏輯

**問題：** 使用者有兩個地方可以輸入一次性費用：
- Cashflow 頁的 `Annual One-time` 區塊
- Annual 頁的月份 modal

這兩者儲存在不同 state key，造成資料分裂。

**決策：** 合併為同一資料來源。

**修改：**
- 確認 `annualItems`（或等價 state）是唯一存取點
- Cashflow 的 one-time 輸入 → 存進同一 state
- Annual tab（合併後）讀同一 state
- 移除重複的 state 宣告

### 5. 健康分數：通用建議 → 具體數字

**問題（已在 health-score-cta spec 中定義，確認實作到位）：**
- 建議如「提高儲蓄率」無法操作
- 需要顯示：現在值 → 目標值 → 需要的行動金額 → 預估分數增加

**確認項目：**
- `src/app/health/page.tsx` Action Plan 區塊
- 每個建議是否有 `currentValue`, `targetValue`, `requiredAction`, `scoreGain`
- CTA 按鈕是否連結到對應頁面

若 health-score-cta 計畫尚未執行，此 cleanup 包含執行此項。

---

## 不移除的項目（確認保留）

| 功能 | 理由保留 |
|------|---------|
| Staking APY 計算 | 生息資產核心功能，只是頁面重命名 |
| DividendCalendar | 台股投資者常用，保留在 Stocks |
| PortfolioRebalance | 有用功能，保留在 Stocks |
| EmailReportSender | 自動報告是差異化功能，保留 |
| OnboardingWizard | 產品留存關鍵，保留並強化 |
| BackupBanner | 資料保護提示，保留 |

---

## Success Criteria

- [ ] FIRE 頁面無 `window.prompt()` 呼叫
- [ ] FIRE 頁面無 Life Events UI 區塊
- [ ] Dashboard 無 `NetWorthMilestones` 組件
- [ ] Stocks 質押欄位預設隱藏，Settings 可開啟
- [ ] `PledgeAlertBanner` 在質押追蹤關閉時不顯示
- [ ] 一次性現金流項目統一來自同一 AppContext state
- [ ] Health Score 行動建議顯示具體數字與 CTA

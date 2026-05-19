# Navigation Restructure Design

**Date:** 2026-05-19  
**Status:** Approved  
**Goal:** Reduce navigation from 9 pages to 6, eliminate redundancy, fix naming confusion.

---

## Problem Statement

現有 9 個頂層頁面對產品使用者造成認知負擔：
- `/chart` 功能 100% 與 Dashboard 重複
- `/annual` 是 Cashflow 的年度視圖，卻獨立成頁
- `/staking` 命名誤導非加密幣使用者（頁面主體是借貸/還款）
- Settings 佔用頂層導航位置，慣例應為圖示/選單

---

## Target State

| Before | After | Action |
|--------|-------|--------|
| `/` Dashboard | `/` Dashboard | 強化（另有 spec） |
| `/cashflow` | `/cashflow` | 新增 Annual tab |
| `/fire` | `/fire` | 保留 |
| `/stocks` | `/stocks` | 保留 |
| `/health` | `/health` | 保留 |
| `/staking` | `/debt` | 重命名 + 重組 |
| `/chart` | ❌ | 刪除，功能移至 Dashboard |
| `/annual` | ❌ | 合併進 `/cashflow` |
| `/settings` | Settings icon | 移出頂層導航 |

---

## Detailed Changes

### 1. 刪除 `/chart` 頁面

**移植邏輯：**
- Net Worth 趨勢圖 → Dashboard 已有 `NetWorthChart`，無需移植
- Asset Category Stacked Area → Dashboard 已有 `AssetAllocationChart`，無需移植
- Snapshot 列表（含刪除）→ 移至 Dashboard 一個 "快照管理" 摺疊區塊或 modal
- `takeSnapshot()` 按鈕 → 移至 Dashboard header 右上角

**刪除檔案：**
- `src/app/chart/page.tsx`

**修改檔案：**
- `src/app/page.tsx` — 新增快照管理 UI（列表 + 刪除 + 拍照按鈕）
- `src/components/Navbar.tsx` — 移除 Chart 連結

### 2. 合併 `/annual` 進 `/cashflow`

**做法：**
- `src/app/cashflow/page.tsx` 現有 Tab：`月度現金流` | `分類分析`
- 新增第三個 Tab：`年度總覽`
- Tab 內容 = 現在 `annual/page.tsx` 的完整實作（表格 + 圖表 + 年份選擇器）
- Annual 的資料存取邏輯不變（同 AppContext），只是 UI 移動

**刪除檔案：**
- `src/app/annual/page.tsx`

**修改檔案：**
- `src/app/cashflow/page.tsx` — 新增 Annual tab
- `src/components/AnnualTracker.tsx` — 抽出成 component（若尚未抽出）
- `src/components/Navbar.tsx` — 移除 Annual 連結

### 3. 重命名 `/staking` → `/debt`

**命名策略：**
- Route: `/staking` → `/debt`
- Navbar 顯示：「負債管理」
- 頁面標題：「負債 & 生息資產」

**功能重組（同一頁面內）：**
- Tab 1：「借款 & 貸款」（現有 LoanItem、DebtPayoffStrategy）
- Tab 2：「生息資產」（現有 StakingItem — earn 類型）
- Tab 3：「雪球 / 雪崩法」（現有 DebtPayoffStrategy）

**修改檔案：**
- `src/app/staking/` 資料夾 → 重命名為 `src/app/debt/`
- `src/components/Navbar.tsx` — 更新路徑與顯示名稱

### 4. Settings 移出頂層導航

**做法：**
- Navbar 右側新增齒輪圖示（`Settings` icon from lucide）
- 點擊直接導向 `/settings`
- 移除 Navbar 的 Settings 文字連結

**修改檔案：**
- `src/components/Navbar.tsx`

---

## Navbar Final State

```
[ Dashboard ]  [ 現金流 ]  [ FIRE ]  [ 股票 ]  [ 健康 ]  [ 負債 ]     ⚙
```

6 個主要頁面 + 右側設定圖示。

---

## Data & State Impact

- 所有功能僅移動 UI，不改變 AppContext 資料結構
- LocalStorage key 不變，無資料遷移需求
- Annual 資料本就從 cashflow items 計算，合併後無需修改

---

## Redirects

舊路徑仍可能被使用者書籤，需加 redirect：
- `/chart` → `/`（Dashboard）
- `/annual` → `/cashflow`
- `/staking` → `/debt`

在 `next.config.ts` 加 `redirects()` 設定。

---

## Success Criteria

- [ ] Navbar 只顯示 6 個項目 + 設定圖示
- [ ] `/chart` 頁面不存在（訪問自動跳轉 Dashboard）
- [ ] `/annual` 不存在（訪問跳轉 Cashflow）
- [ ] `/staking` redirect 至 `/debt`
- [ ] Cashflow 頁有「年度總覽」tab，功能與舊 annual 一致
- [ ] Snapshot 管理功能在 Dashboard 可存取

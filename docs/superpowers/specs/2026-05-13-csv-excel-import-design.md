# CSV / Excel 批量匯入 — Design Spec

Date: 2026-05-13  
Status: Approved

## Overview

在 DataManager 加入「匯入」按鈕，觸發 ImportModal。支援 CSV 與 .xlsx 格式，覆蓋三種資料類型：股票庫存、資產項目、收支項目。採用「預覽後確認」流程，降低誤操作風險。同步修復 DataManager 現有 bug（handleCSVImport 嵌套 + 缺 readAsText）。

## Dependencies

安裝 `xlsx` (SheetJS) — 統一解析 .csv 與 .xlsx，不需自寫 parser。

```bash
npm install xlsx
```

## 改動範圍

| 檔案 | 改動 |
|------|------|
| `src/components/ImportModal.tsx` | 新增：主要 modal 元件 |
| `src/components/DataManager.tsx` | 修 bug；移除舊 CSV 按鈕；加「匯入」按鈕 |
| `package.json` | 加 `xlsx` dependency |

不改動：AppContext、types.ts、其他頁面。

## Modal 流程（3 步驟）

```
Step 1: 選類型      Step 2: 上傳解析        Step 3: 預覽確認
─────────────────   ──────────────────────   ──────────────────────────
Stocks              drag & drop 或 click      表格顯示解析結果
資產                自動判斷 csv / xlsx        無效行整行紅色 + ⚠
收入                解析失敗顯示錯誤訊息       摘要：共 N 筆，M 筆有誤
支出                                           「確認匯入 N 筆有效資料」
```

步驟間可返回上一步。

## 匯入行為

- **Stocks**：`symbol` 相同 → 更新 shares / avgCost；否則 append
- **資產**：直接 append 至對應 category（依 `類別` 欄位名稱比對 category.title）
- **收入 / 支出**：直接 append 至 incomeItems / expenseItems
- 解析後無效行不寫入，只有效行才 append

## CSV 模板格式

### 股票（Stocks）

```
代號,名稱,股數,平均成本,平台,質押股數,產業,備注,購買日期
2330.TW,台積電,2000,600,元大,500,科技,,2023-01-15
AAPL,Apple,100,150,,,科技,,
```

| 欄位 | 必填 | 對應 StockItem 欄位 |
|------|------|---------------------|
| 代號 | ✓ | symbol |
| 名稱 | — | （用於顯示，不存入 StockItem） |
| 股數 | ✓ | shares |
| 平均成本 | — | avgCost（預設 0） |
| 平台 | — | platform |
| 質押股數 | — | collateralShares |
| 產業 | — | sector（需符合 StockSector union） |
| 備注 | — | notes |
| 購買日期 | — | purchaseDate（YYYY-MM-DD） |

### 資產（Assets）

```
類別,名稱,金額
流動資金,銀行活存,300000
投資,台股基金,100000
固定資產,自用住宅,1200000
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| 類別 | ✓ | 比對 assets[].title；不存在的類別整行標紅並跳過 |
| 名稱 | ✓ | AssetItem.name |
| 金額 | ✓ | AssetItem.amount（需為正數） |

### 收支（Income / Expense）

```
類型,名稱,金額,類別,週期性,月預算
income,薪資收入,80000,Salary,true,
expense,房租,20000,Housing,true,25000
expense,伙食費,15000,Food,true,
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| 類型 | ✓ | `income` 或 `expense` |
| 名稱 | ✓ | CashFlowItem.name |
| 金額 | ✓ | CashFlowItem.amount |
| 類別 | — | CashFlowItem.category（預設空字串） |
| 週期性 | — | isRecurring（`true`/`false`，預設 `true`） |
| 月預算 | — | budget（僅 expense 有效） |

## 預覽表格規格

- 頂部摘要列：「共解析 N 筆，其中 M 筆有誤，將匯入 N-M 筆」
- 顯示前 50 筆（超出顯示「...以及 K 筆更多」）
- 無效行：整行 `bg-red-50` + ⚠ 圖示 + hover 顯示錯誤原因
- 有效行：正常顯示
- 底部按鈕：「確認匯入 N 筆有效資料」（disabled 若 N=0）+ 「取消」

## 模板下載

每個類型 Step 2 頁面有「下載模板」按鈕：
- 生成對應格式含 header + 1 筆範例資料的 CSV blob
- 檔名：`assetdash-template-{type}.csv`

## DataManager Bug 修復

現有 `DataManager.tsx` 問題：

1. `handleCSVImport` 定義在 `handleImport` 的 `reader.onload` 內（巢狀函式）
2. `handleImport` 缺少 `reader.readAsText(file)` 呼叫 → JSON 匯入實際上壞掉

修復方式：
- 將兩個 handler 拆出為獨立函式
- 補上 `reader.readAsText(file)`
- 移除舊的 CSV 匯入按鈕與 `csvRef`（由新 ImportModal 取代）

## 錯誤處理

| 情境 | 處理 |
|------|------|
| 檔案格式不支援 | Step 2 顯示錯誤文字，不進入 Step 3 |
| 空白檔案 / 只有 header | Step 3 顯示「無有效資料」，確認按鈕 disabled |
| 金額為非數字 | 整行標紅，錯誤原因：「金額格式錯誤」 |
| 資產類別不存在 | 整行標紅，錯誤原因：「類別「XXX」不存在」 |
| 所有行皆無效 | 確認按鈕 disabled，不可匯入 |

## 不在範圍

- 收入項目 customCategory 欄位（cashflow category 功能屬另一 spec）
- 質押、貸款的 CSV 匯入
- 年度特殊收支（annualEntries）匯入
- 匯出成 CSV（現有 JSON 匯出保留）
- 重複股票的 merge 策略設定（固定為更新 shares/avgCost）
